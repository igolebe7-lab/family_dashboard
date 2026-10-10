package media

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/hook"
)

const initialFiles = "__initial_work_photos"
const initialLinks = "__initial_work_links"
const avatarAuth = "__avatar_request_auth"
const avatarOtherChanges = "__avatar_request_other_changes"

func Register(app core.App) {
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/api/familytime/work/{occurrence}/media", readMedia).Bind(apis.RequireAuth("users"))
		e.Router.POST("/api/familytime/work/{occurrence}/media", saveMedia).Bind(apis.RequireAuth("users"), apis.BodyLimit(22*1024*1024))
		return e.Next()
	})
	app.OnRecordUpdateRequest("family_members").BindFunc(guardAvatar)
	app.OnRecordCreateRequest("family_members").BindFunc(guardAvatar)
	app.OnRecordUpdateExecute("family_members").Bind(&hook.Handler[*core.RecordEvent]{Priority: -100, Func: func(e *core.RecordEvent) error {
		previous := e.Record.Original().GetString("avatar")
		avatarTouched := e.Record.GetString(avatarAuth) != "" || len(e.Record.GetUnsavedFiles("avatar")) > 0 || e.Record.GetString("avatar") != previous
		original := e.App
		defer func() { e.App = original }()
		return original.RunInTransaction(func(tx core.App) error {
			current, err := tx.FindRecordById("family_members", e.Record.Id)
			if err != nil {
				return err
			}
			// Reject stale replacements before uploading: otherwise concurrent B/C
			// both clean the old A, leaving the superseded B in storage.
			if avatarTouched && current.GetString("avatar") != previous {
				return apis.NewApiError(409, "Фото уже изменено. Обновите профиль и повторите.", nil)
			}
			if !avatarTouched {
				e.Record.Set("avatar", current.GetString("avatar"))
			}
			if user := e.Record.GetString(avatarAuth); user != "" {
				actors, err := tx.FindRecordsByFilter("family_members", "family={:family} && user={:user} && active=true", "id", 20, 0, dbx.Params{"family": current.GetString("family"), "user": user})
				if err != nil {
					return err
				}
				allowed := false
				for _, actor := range actors {
					allowed = allowed || canManageAvatar(actor, current)
				}
				if !allowed {
					return apis.NewApiError(403, "Права на изменение фото отозваны.", nil)
				}
				if e.Record.GetBool(avatarOtherChanges) {
					family, err := tx.FindRecordById("families", current.GetString("family"))
					if err != nil || family.GetString("owner_user") != user {
						return apis.NewApiError(403, "Права на изменение профиля отозваны.", nil)
					}
				}
			}
			// Do not restore unrelated stale role/managed_by/color fields.
			e.Record.IgnoreUnchangedFields(true)
			e.App = tx
			return e.Next()
		})
	}})
	app.OnRecordCreateRequest("items").BindFunc(func(e *core.RecordRequestEvent) error {
		info, err := e.RequestInfo()
		if err != nil {
			return err
		}
		files := e.Record.GetUnsavedFiles("attachments")
		linksValue, present := info.Body["work_links_json"]
		if len(files) == 0 && !present {
			return e.Next()
		}
		if e.Record.GetString("kind") != "task" && e.Record.GetString("kind") != "assignment" {
			return e.BadRequestError("Вложения доступны для дел", nil)
		}
		links, err := decodeLinks(linksValue)
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}
		if err := validateImages(files, 1600); err != nil {
			return e.BadRequestError(err.Error(), nil)
		}
		e.Record.Set(initialFiles, files)
		e.Record.Set(initialLinks, links)
		e.Record.Set("attachments", []string{})
		return e.Next()
	})
	// Enclose the existing JS item lifecycle so the initial occurrence and media
	// commit together, before the CRUD handler can send a successful response.
	app.OnRecordCreateExecute("items").Bind(&hook.Handler[*core.RecordEvent]{Priority: -100, Func: func(e *core.RecordEvent) error {
		files, _ := e.Record.Get(initialFiles).([]*filesystem.File)
		links, _ := e.Record.Get(initialLinks).([]Link)
		if len(files) == 0 && len(links) == 0 {
			return e.Next()
		}
		original := e.App
		defer func() { e.App = original }()
		return original.RunInTransaction(func(tx core.App) error {
			e.App = tx
			if err := e.Next(); err != nil {
				return err
			}
			rows, err := tx.FindRecordsByFilter("item_occurrences", "item={:item} && status!='done' && status!='approved' && status!='cancelled' && status!='skipped'", "due_at,id", 1, 0, dbx.Params{"item": e.Record.Id})
			if err != nil {
				return err
			}
			if len(rows) == 0 {
				return errors.New("У дела нет ближайшего выполнения для вложений")
			}
			c, err := tx.FindCollectionByNameOrId("work_media")
			if err != nil {
				return err
			}
			r := core.NewRecord(c)
			r.Set("family", e.Record.GetString("family"))
			r.Set("item", e.Record.Id)
			r.Set("occurrence", rows[0].Id)
			r.Set("photos", files)
			r.Set("links_json", links)
			return tx.Save(r)
		})
	}})
	app.OnRecordUpdateRequest("items").BindFunc(func(e *core.RecordRequestEvent) error {
		if len(e.Record.GetUnsavedFiles("attachments")) > 0 || !reflect.DeepEqual(e.Record.GetStringSlice("attachments"), e.Record.Original().GetStringSlice("attachments")) {
			return e.BadRequestError("Добавьте фото к конкретному выполнению дела", nil)
		}
		return e.Next()
	})
	app.OnRecordUpdateExecute("item_occurrences").Bind(&hook.Handler[*core.RecordEvent]{Priority: -100, Func: func(e *core.RecordEvent) error {
		if e.Record.GetString("status") == e.Record.Original().GetString("status") {
			return e.Next()
		}
		item, err := e.App.FindRecordById("items", e.Record.GetString("item"))
		if err != nil {
			return err
		}
		if !finalPhotos(e.Record.GetString("status"), item.GetBool("approval_required")) {
			return e.Next()
		}
		original := e.App
		defer func() { e.App = original }()
		return original.RunInTransaction(func(tx core.App) error {
			e.App = tx
			if err := e.Next(); err != nil {
				return err
			}
			r, err := tx.FindFirstRecordByFilter("work_media", "occurrence={:occ}", dbx.Params{"occ": e.Record.Id})
			if errors.Is(err, sql.ErrNoRows) {
				return nil
			}
			if err != nil {
				return err
			}
			if len(r.GetStringSlice("photos")) == 0 {
				return nil
			}
			r.Set("photos", []string{})
			return tx.Save(r)
		})
	}})
}

func guardAvatar(e *core.RecordRequestEvent) error {
	info, err := e.RequestInfo()
	if err != nil {
		return err
	}
	target := e.Record.Original()
	if e.Record.IsNew() {
		target = e.Record
	}
	_, requested := info.Body["avatar"]
	if !requested && len(e.Record.GetUnsavedFiles("avatar")) == 0 && e.Record.GetString("avatar") == target.GetString("avatar") {
		return e.Next()
	}
	if e.Auth == nil {
		return e.ForbiddenError("Нужен вход в аккаунт", nil)
	}
	actors, err := e.App.FindRecordsByFilter("family_members", "family={:family} && user={:user} && active=true", "id", 20, 0, dbx.Params{"family": target.GetString("family"), "user": e.Auth.Id})
	if err != nil {
		return err
	}
	allowed := false
	for _, actor := range actors {
		if canManageAvatar(actor, target) {
			allowed = true
			break
		}
	}
	if !allowed {
		return e.ForbiddenError("Можно менять своё фото или фото управляемого ребёнка", nil)
	}
	family, err := e.App.FindRecordById("families", target.GetString("family"))
	if err != nil {
		return err
	}
	otherChanges := false
	if !e.Record.IsNew() {
		for _, field := range e.Record.Collection().Fields {
			if field.GetName() != "avatar" && !reflect.DeepEqual(e.Record.Get(field.GetName()), target.Get(field.GetName())) {
				otherChanges = true
			}
		}
	}
	if otherChanges && family.GetString("owner_user") != e.Auth.Id {
		return e.ForbiddenError("В этом запросе можно менять только фото", nil)
	}
	e.Record.Set(avatarAuth, e.Auth.Id)
	e.Record.Set(avatarOtherChanges, otherChanges)
	if err := validateImages(e.Record.GetUnsavedFiles("avatar"), 1024); err != nil {
		return e.BadRequestError(err.Error(), nil)
	}
	return e.Next()
}

func readMedia(e *core.RequestEvent) error {
	occ, err := e.App.FindRecordById("item_occurrences", e.Request.PathValue("occurrence"))
	if err != nil {
		return e.NotFoundError("Дело недоступно", nil)
	}
	item, err := e.App.FindRecordById("items", occ.GetString("item"))
	if err != nil {
		return e.NotFoundError("Дело недоступно", nil)
	}
	actor, err := actorFor(e.App, e.Auth, item.GetString("family"), e.Request.Header.Get("X-Family-Member-Id"))
	if err != nil || !canView(e.App, actor, item) {
		return e.NotFoundError("Дело недоступно", nil)
	}
	allowed, err := e.App.CanAccessRecord(item, &core.RequestInfo{Auth: e.Auth, Method: "GET"}, item.Collection().ViewRule)
	if err != nil || !allowed {
		return e.NotFoundError("Дело недоступно", nil)
	}
	r, err := e.App.FindFirstRecordByFilter("work_media", "occurrence={:occ}", dbx.Params{"occ": occ.Id})
	if errors.Is(err, sql.ErrNoRows) {
		return e.JSON(200, nil)
	}
	if err != nil {
		return err
	}
	if r.GetString("family") != item.GetString("family") || r.GetString("item") != item.Id {
		return e.NotFoundError("Вложения недоступны", nil)
	}
	return e.JSON(200, r.PublicExport())
}

func saveMedia(e *core.RequestEvent) error {
	photos, err := e.FindUploadedFiles("photos")
	if err != nil && !errors.Is(err, http.ErrMissingFile) {
		return e.BadRequestError("Не удалось прочитать фото", nil)
	}
	if err := validateImages(photos, 1600); err != nil {
		return e.BadRequestError(err.Error(), nil)
	}
	info, err := e.RequestInfo()
	if err != nil {
		return err
	}
	var links []Link
	value, linksPresent := info.Body["links_json"]
	if linksPresent {
		links, err = decodeLinks(value)
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}
	}
	var expectedLinks []Link
	expectedValue, expectedPresent := info.Body["expected_links_json"]
	if expectedPresent {
		expectedLinks, err = decodeLinks(expectedValue)
		if err != nil {
			return e.BadRequestError("Некорректная версия ссылок", nil)
		}
	}
	var remove []string
	if value, ok := info.Body["remove_photos_json"]; ok {
		var b []byte
		if s, ok := value.(string); ok {
			b = []byte(s)
		} else {
			b, _ = json.Marshal(value)
		}
		if len(b) > 3000 || json.Unmarshal(b, &remove) != nil || len(remove) > 10 {
			return e.BadRequestError("Некорректный список фото", nil)
		}
	}
	var result *core.Record
	err = e.App.RunInTransaction(func(tx core.App) error {
		occ, err := tx.FindRecordById("item_occurrences", e.Request.PathValue("occurrence"))
		if err != nil {
			return e.NotFoundError("Дело недоступно", nil)
		}
		item, err := tx.FindRecordById("items", occ.GetString("item"))
		if err != nil {
			return err
		}
		actor, err := actorFor(tx, e.Auth, item.GetString("family"), e.Request.Header.Get("X-Family-Member-Id"))
		if err != nil {
			return e.ForbiddenError("Нет доступа к профилю", nil)
		}
		canView, err := tx.CanAccessRecord(item, &core.RequestInfo{Auth: e.Auth, Method: "GET"}, item.Collection().ViewRule)
		if err != nil || !canView || !canEdit(tx, actor, item, occ) || (item.GetString("kind") != "task" && item.GetString("kind") != "assignment") {
			return e.ForbiddenError("Нет прав менять вложения этого выполнения", nil)
		}
		r, err := tx.FindFirstRecordByFilter("work_media", "occurrence={:occ}", dbx.Params{"occ": occ.Id})
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if r == nil {
			c, err := tx.FindCollectionByNameOrId("work_media")
			if err != nil {
				return err
			}
			r = core.NewRecord(c)
			r.Set("family", item.GetString("family"))
			r.Set("item", item.Id)
			r.Set("occurrence", occ.Id)
			r.Set("links_json", []Link{})
		}
		if r.GetString("family") != item.GetString("family") || r.GetString("item") != item.Id {
			return errors.New("Некорректная принадлежность вложений")
		}
		if linksPresent && expectedPresent {
			currentLinks, err := decodeLinks(r.GetString("links_json"))
			if err != nil {
				return err
			}
			if !reflect.DeepEqual(expectedLinks, currentLinks) {
				return apis.NewApiError(409, "Ссылки изменены другим участником. Обновите вложения.", nil)
			}
		}
		files := r.GetStringSlice("photos")
		removed := map[string]bool{}
		for _, name := range remove {
			found := false
			for _, existing := range files {
				if name == existing {
					found = true
				}
			}
			if !found {
				return e.BadRequestError("Фото уже изменено, обновите запись", nil)
			}
			removed[name] = true
		}
		kept := []any{}
		for _, name := range files {
			if !removed[name] {
				kept = append(kept, name)
			}
		}
		if len(kept)+len(photos) > 10 {
			return e.BadRequestError("Не более 10 фотографий", nil)
		}
		for _, photo := range photos {
			kept = append(kept, photo)
		}
		r.Set("photos", kept)
		if linksPresent {
			r.Set("links_json", links)
		}
		if err := tx.Save(r); err != nil {
			return err
		}
		result = r
		return nil
	})
	if err != nil {
		return err
	}
	return e.JSON(200, result.PublicExport())
}
