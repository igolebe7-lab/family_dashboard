package media

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/hook"
)

func TestMediaIntegration(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	migrations, _ := filepath.Abs("../../pb_migrations")
	hooks, _ := filepath.Abs("../../pb_hooks")
	jsvm.MustRegister(app, jsvm.Config{MigrationsDir: migrations, HooksDir: hooks, HooksWatch: false})
	Register(app)
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	defer app.ResetBootstrapState()
	if err := app.RunAllMigrations(); err != nil {
		t.Fatal(err)
	}
	save := func(name string, data map[string]any) *core.Record {
		t.Helper()
		c, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Fatal(err)
		}
		r := core.NewRecord(c)
		for k, v := range data {
			r.Set(k, v)
		}
		if err := app.Save(r); err != nil {
			t.Fatal(name, err)
		}
		return r
	}
	user := func(email string) *core.Record {
		return save("users", map[string]any{"email": email, "password": "Media-tests-123", "passwordConfirm": "Media-tests-123"})
	}
	ownerUser, childUser, otherUser := user("media-owner@example.test"), user("media-child@example.test"), user("media-other@example.test")
	family := save("families", map[string]any{"name": "Media", "slug": "media", "owner_user": ownerUser.Id, "timezone": "Europe/Moscow"})
	member := func(u *core.Record, role string) *core.Record {
		return save("family_members", map[string]any{"family": family.Id, "user": u.Id, "role": role, "display_name": role, "active": true})
	}
	owner, child, other := member(ownerUser, "owner"), member(childUser, "child"), member(otherUser, "adult")
	child.Set("managed_by", []string{owner.Id})
	if err := app.Save(child); err != nil {
		t.Fatal(err)
	}
	baseRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.OnServe().Trigger(&core.ServeEvent{App: app, Router: baseRouter}); err != nil {
		t.Fatal(err)
	}
	mux, err := baseRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	picture := image.NewRGBA(image.Rect(0, 0, 32, 32))
	picture.Set(0, 0, color.RGBA{R: 255, A: 255})
	var photo bytes.Buffer
	if err := png.Encode(&photo, picture); err != nil {
		t.Fatal(err)
	}
	call := func(method, path string, auth *core.Record, body map[string]any, withPhoto bool) *httptest.ResponseRecorder {
		t.Helper()
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		for k, v := range body {
			data, _ := json.Marshal(v)
			if s, ok := v.(string); ok {
				writer.WriteField(k, s)
			} else {
				writer.WriteField(k, string(data))
			}
		}
		if withPhoto {
			field := "photos"
			if path == "/api/collections/items/records" {
				field = "attachments"
			}
			if bytes.Contains([]byte(path), []byte("family_members")) {
				field = "avatar"
			}
			part, _ := writer.CreateFormFile(field, "photo.png")
			part.Write(photo.Bytes())
		}
		writer.Close()
		req := httptest.NewRequest(method, path, &buf)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		if auth != nil {
			token, _ := auth.NewAuthToken()
			req.Header.Set("Authorization", token)
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec
	}
	assertStatus := func(response *httptest.ResponseRecorder, want int) {
		t.Helper()
		if response.Code != want {
			t.Fatalf("HTTP %d want %d: %s", response.Code, want, response.Body)
		}
	}
	// Avatar replacement removes the actual previous file, not only its record field.
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+owner.Id, ownerUser, nil, true), 200)
	owner, _ = app.FindRecordById("family_members", owner.Id)
	oldAvatar := filepath.Join(app.DataDir(), "storage", owner.BaseFilesPath(), owner.GetString("avatar"))
	if _, err := os.Stat(oldAvatar); err != nil {
		t.Fatal(err)
	}
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+owner.Id, ownerUser, nil, true), 200)
	if _, err := os.Stat(oldAvatar); !os.IsNotExist(err) {
		t.Fatal("old avatar retained", err)
	}
	staleOwner, _ := app.FindRecordById("family_members", owner.Id)
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+owner.Id, ownerUser, nil, true), 200)
	staleFile, _ := filesystem.NewFileFromBytes(photo.Bytes(), "stale.png")
	staleOwner.Set("avatar", staleFile)
	if err := app.Save(staleOwner); err == nil {
		t.Fatal("stale avatar replacement accepted")
	}
	entries, _ := os.ReadDir(filepath.Join(app.DataDir(), "storage", staleOwner.BaseFilesPath()))
	currentOwner, _ := app.FindRecordById("family_members", owner.Id)
	currentAvatar := currentOwner.GetString("avatar")
	countFiles := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			if entry.Name() == currentAvatar {
				countFiles++
			} else if entry.Name() != currentAvatar+".attrs" {
				t.Fatal("orphan avatar file", entry.Name())
			}
		}
	}
	if countFiles != 1 {
		t.Fatal("stale avatar left files", countFiles)
	}
	// A delayed non-photo edit must not restore the now-deleted previous avatar.
	latestAvatar := ""
	app.OnRecordUpdateExecute("family_members").Bind(&hook.Handler[*core.RecordEvent]{Id: "media-color-avatar-test", Priority: -101, Func: func(e *core.RecordEvent) error {
		if e.Record.Id == owner.Id && len(e.Record.GetUnsavedFiles("avatar")) == 0 && latestAvatar == "" {
			fresh, _ := app.FindRecordById("family_members", owner.Id)
			file, _ := filesystem.NewFileFromBytes(photo.Bytes(), "concurrent.png")
			fresh.Set("avatar", file)
			if err := app.Save(fresh); err != nil {
				return err
			}
			latestAvatar = fresh.GetString("avatar")
		}
		return e.Next()
	}})
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+owner.Id, ownerUser, map[string]any{"color_key": "green"}, false), 200)
	app.OnRecordUpdateExecute("family_members").Unbind("media-color-avatar-test")
	latestOwner, _ := app.FindRecordById("family_members", owner.Id)
	if latestOwner.GetString("avatar") != latestAvatar {
		t.Fatal("color update restored a stale avatar")
	}
	if _, err := os.Stat(filepath.Join(app.DataDir(), "storage", latestOwner.BaseFilesPath(), latestAvatar)); err != nil {
		t.Fatal("color update deleted the new avatar", err)
	}
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+child.Id, ownerUser, nil, true), 200)
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+child.Id, childUser, nil, true), 200)
	parentUser := user("media-parent@example.test")
	parent := member(parentUser, "parent")
	child.Set("managed_by", []string{owner.Id, parent.Id})
	if err := app.Save(child); err != nil {
		t.Fatal(err)
	}
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+child.Id, parentUser, nil, true), 200)
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+parent.Id, parentUser, nil, true), 200)
	app.OnRecordUpdateRequest("family_members").Bind(&hook.Handler[*core.RecordRequestEvent]{Id: "media-revoke-test", Priority: 50, Func: func(e *core.RecordRequestEvent) error {
		if e.Record.Id == child.Id && e.Auth != nil && e.Auth.Id == parentUser.Id {
			fresh, _ := app.FindRecordById("family_members", child.Id)
			fresh.Set("managed_by", []string{owner.Id})
			if err := app.Save(fresh); err != nil {
				return err
			}
		}
		return e.Next()
	}})
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+child.Id, parentUser, nil, true), 403)
	app.OnRecordUpdateRequest("family_members").Unbind("media-revoke-test")
	freshChild, _ := app.FindRecordById("family_members", child.Id)
	if len(freshChild.GetStringSlice("managed_by")) != 1 || freshChild.GetStringSlice("managed_by")[0] != owner.Id {
		t.Fatal("avatar upload restored revoked management")
	}
	freshChild.Set("managed_by", []string{owner.Id, parent.Id})
	if err := app.Save(freshChild); err != nil {
		t.Fatal(err)
	}
	app.OnRecordUpdateRequest("family_members").Bind(&hook.Handler[*core.RecordRequestEvent]{Id: "media-color-test", Priority: 50, Func: func(e *core.RecordRequestEvent) error {
		if e.Record.Id == child.Id && e.Auth != nil && e.Auth.Id == parentUser.Id {
			fresh, _ := app.FindRecordById("family_members", child.Id)
			fresh.Set("color_key", "blue")
			if err := app.Save(fresh); err != nil {
				return err
			}
		}
		return e.Next()
	}})
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+child.Id, parentUser, nil, true), 200)
	app.OnRecordUpdateRequest("family_members").Unbind("media-color-test")
	freshChild, _ = app.FindRecordById("family_members", child.Id)
	if freshChild.GetString("color_key") != "blue" {
		t.Fatal("avatar upload overwrote a concurrent color change")
	}
	if response := call("PATCH", "/api/collections/family_members/records/"+other.Id, parentUser, nil, true); response.Code < 400 {
		t.Fatal("parent changed adult avatar")
	}
	if response := call("PATCH", "/api/collections/family_members/records/"+other.Id, ownerUser, nil, true); response.Code < 400 {
		t.Fatal("owner changed other adult avatar")
	}
	if response := call("PATCH", "/api/collections/family_members/records/"+child.Id, childUser, map[string]any{"role": "owner"}, true); response.Code < 400 {
		t.Fatal("avatar upload escalated role")
	}
	currentChild, _ := app.FindRecordById("family_members", child.Id)
	if response := call("PATCH", "/api/collections/family_members/records/"+child.Id, childUser, map[string]any{"role": "owner", "avatar": currentChild.GetString("avatar")}, false); response.Code < 400 {
		t.Fatal("unchanged avatar escalated role")
	}
	assertStatus(call("PATCH", "/api/collections/family_members/records/"+child.Id, childUser, map[string]any{"avatar": ""}, false), 200)
	if response := call("PATCH", "/api/collections/family_members/records/"+child.Id, childUser, map[string]any{"role": "owner", "avatar": ""}, false); response.Code < 400 {
		t.Fatal("empty avatar escalated role")
	}
	// A normal task and its initial occurrence attachments are one atomic create.
	data := map[string]any{"family": family.Id, "kind": "task", "created_by": owner.Id, "owner": owner.Id, "title": "Media task", "category": "home", "priority": "normal", "visibility": "private", "timezone": "Europe/Moscow", "work_links_json": []Link{{ID: "link", Title: "Recipe", URL: "https://example.org/recipe"}}}
	response := call("POST", "/api/collections/items/records", ownerUser, data, true)
	assertStatus(response, 200)
	var created map[string]any
	json.Unmarshal(response.Body.Bytes(), &created)
	itemID := created["id"].(string)
	rows, err := app.FindRecordsByFilter("work_media", "item={:item}", "", 0, 0, map[string]any{"item": itemID})
	if err != nil || len(rows) != 1 {
		t.Fatal("missing initial media", err, len(rows))
	}
	media := rows[0]
	readPath := "/api/familytime/work/" + media.GetString("occurrence") + "/media"
	assertStatus(call("GET", readPath, nil, nil, false), 401)
	assertStatus(call("GET", readPath, otherUser, nil, false), 404)
	assertStatus(call("GET", readPath, ownerUser, nil, false), 200)
	assertStatus(call("POST", readPath, ownerUser, map[string]any{"links_json": []Link{{ID: "edited", Title: "Edited recipe", URL: "https://example.org/edited"}}}, false), 200)
	assertStatus(call("POST", readPath, ownerUser, map[string]any{"links_json": []Link{}, "expected_links_json": []Link{{ID: "link", Title: "Recipe", URL: "https://example.org/recipe"}}}, true), 409)
	media, _ = app.FindRecordById("work_media", media.Id)
	if !bytes.Contains([]byte(media.GetString("links_json")), []byte("Edited recipe")) {
		t.Fatal("stale draft removed a concurrent link")
	}
	if len(media.GetStringSlice("photos")) != 1 {
		t.Fatal("photos missing")
	}
	file := media.GetStringSlice("photos")[0]
	path := filepath.Join(app.DataDir(), "storage", media.BaseFilesPath(), file)
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
	assertStatus(call("GET", "/api/files/work_media/"+media.Id+"/"+file, nil, nil, false), 404)
	for _, recipient := range []*core.Record{ownerUser, otherUser} {
		tokenResponse := call("POST", "/api/files/token", recipient, nil, false)
		assertStatus(tokenResponse, 200)
		var tokenData map[string]string
		if err := json.Unmarshal(tokenResponse.Body.Bytes(), &tokenData); err != nil {
			t.Fatal(err)
		}
		want := 404
		if recipient.Id == ownerUser.Id {
			want = 200
		}
		assertStatus(call("GET", "/api/files/work_media/"+media.Id+"/"+file+"?token="+tokenData["token"], nil, nil, false), want)
	}
	allowed, err := app.CanAccessRecord(media, &core.RequestInfo{Auth: otherUser, Method: "GET"}, media.Collection().ViewRule)
	if err != nil || allowed {
		t.Fatal("private photo metadata leak", allowed, err)
	}
	assertStatus(call("POST", "/api/familytime/work/"+media.GetString("occurrence")+"/media", otherUser, nil, true), 403)
	assertStatus(call("PATCH", "/api/collections/item_occurrences/records/"+media.GetString("occurrence"), ownerUser, map[string]any{"status": "done"}, false), 200)
	media, _ = app.FindRecordById("work_media", media.Id)
	if len(media.GetStringSlice("photos")) != 0 || media.GetString("links_json") == "[]" {
		t.Fatal("final media cleanup or links retention")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("completed photo retained", err)
	}
	if response := call("POST", "/api/familytime/work/"+media.GetString("occurrence")+"/media", ownerUser, nil, true); response.Code < 400 {
		t.Fatal("upload to completed work")
	}
	// Invalid links reject the entire create: no task is left behind.
	before, _ := app.CountRecords("items", nil)
	data["work_links_json"] = []Link{{ID: "bad", URL: "javascript:alert(1)"}}
	if response := call("POST", "/api/collections/items/records", ownerUser, data, true); response.Code < 400 {
		t.Fatal("unsafe link accepted")
	}
	after, _ := app.CountRecords("items", nil)
	if before != after {
		t.Fatal("partial create left task")
	}
	// Approval retains evidence until the parent confirms, and only cleans its occurrence.
	data["kind"] = "assignment"
	data["assignees"] = []string{child.Id}
	delete(data, "owner")
	data["visibility"] = "assignees"
	data["approval_required"] = true
	data["work_links_json"] = []Link{}
	response = call("POST", "/api/collections/items/records", ownerUser, data, true)
	assertStatus(response, 200)
	json.Unmarshal(response.Body.Bytes(), &created)
	rows, _ = app.FindRecordsByFilter("work_media", "item={:item}", "", 0, 0, map[string]any{"item": created["id"]})
	media = rows[0]
	occ := media.GetString("occurrence")
	assertStatus(call("PATCH", "/api/collections/item_occurrences/records/"+occ, childUser, map[string]any{"status": "done"}, false), 200)
	media, _ = app.FindRecordById("work_media", media.Id)
	if len(media.GetStringSlice("photos")) != 1 {
		t.Fatal("photo removed before approval")
	}
	// Another execution of the same item keeps its own photos and links.
	otherOccurrence := save("item_occurrences", map[string]any{"family": family.Id, "item": created["id"], "kind": "assignment", "title_snapshot": "Next execution", "category_snapshot": "home", "status": "assigned", "due_at": "2026-10-15 10:00:00.000Z"})
	assertStatus(call("POST", "/api/familytime/work/"+otherOccurrence.Id+"/media", ownerUser, map[string]any{"links_json": []Link{{ID: "next", URL: "https://example.org/next"}}}, true), 200)
	nextMedia, err := app.FindFirstRecordByFilter("work_media", "occurrence={:occ}", map[string]any{"occ": otherOccurrence.Id})
	if err != nil {
		t.Fatal(err)
	}
	nextPath := filepath.Join(app.DataDir(), "storage", nextMedia.BaseFilesPath(), nextMedia.GetStringSlice("photos")[0])
	assertStatus(call("POST", "/api/familytime/work/"+otherOccurrence.Id+"/media", ownerUser, map[string]any{"remove_photos_json": nextMedia.GetStringSlice("photos")}, false), 200)
	if _, err := os.Stat(nextPath); !os.IsNotExist(err) {
		t.Fatal("removed photo still stored", err)
	}
	assertStatus(call("POST", "/api/familytime/work/"+otherOccurrence.Id+"/media", ownerUser, nil, true), 200)
	nextMedia, _ = app.FindRecordById("work_media", nextMedia.Id)
	nextPath = filepath.Join(app.DataDir(), "storage", nextMedia.BaseFilesPath(), nextMedia.GetStringSlice("photos")[0])
	assertStatus(call("PATCH", "/api/collections/item_occurrences/records/"+occ, ownerUser, map[string]any{"status": "approved"}, false), 200)
	media, _ = app.FindRecordById("work_media", media.Id)
	if len(media.GetStringSlice("photos")) != 0 {
		t.Fatal("approval did not clean photo")
	}
	nextMedia, _ = app.FindRecordById("work_media", nextMedia.Id)
	if len(nextMedia.GetStringSlice("photos")) != 1 {
		t.Fatal("approval removed another execution's photo")
	}
	if _, err := os.Stat(nextPath); err != nil {
		t.Fatal("another execution's file removed", err)
	}
	// Images are validated by content and dimensions, not client MIME alone.
	fake, _ := filesystem.NewFileFromBytes([]byte("not a photo"), "fake.jpg")
	if validateImages([]*filesystem.File{fake}, 1600) == nil {
		t.Fatal("fake JPEG accepted")
	}
}
