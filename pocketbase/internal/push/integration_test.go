package push

import (
	"bytes"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/tools/router"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type captureClient struct {
	status, calls           int
	body                    []byte
	authorization, encoding string
}

func (c *captureClient) Do(r *http.Request) (*http.Response, error) {
	c.calls++
	c.body, _ = io.ReadAll(r.Body)
	c.authorization = r.Header.Get("Authorization")
	c.encoding = r.Header.Get("Content-Encoding")
	return &http.Response{StatusCode: c.status, Body: io.NopCloser(strings.NewReader("")), Header: http.Header{}}, nil
}

func TestPushIntegration(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	migrations, _ := filepath.Abs("../../pb_migrations")
	jsvm.MustRegister(app, jsvm.Config{MigrationsDir: migrations, HooksDir: t.TempDir(), HooksWatch: false})
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	defer app.ResetBootstrapState()
	if err := app.RunAllMigrations(); err != nil {
		t.Fatal(err)
	}
	save := func(name string, fields map[string]any) *core.Record {
		t.Helper()
		collection, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Fatal(err)
		}
		record := core.NewRecord(collection)
		for k, v := range fields {
			record.Set(k, v)
		}
		if err := app.Save(record); err != nil {
			t.Fatal(name, err)
		}
		return record
	}
	user := save("users", map[string]any{"email": "push@example.test", "password": "Local-testing-only-123", "passwordConfirm": "Local-testing-only-123"})
	other := save("users", map[string]any{"email": "other@example.test", "password": "Local-testing-only-123", "passwordConfirm": "Local-testing-only-123"})
	family := save("families", map[string]any{"name": "Push test", "slug": "push-test", "owner_user": user.Id, "timezone": "Europe/Amsterdam"})
	member := save("family_members", map[string]any{"family": family.Id, "user": user.Id, "role": "parent", "display_name": "Parent", "active": true})
	otherMember := save("family_members", map[string]any{"family": family.Id, "user": other.Id, "role": "adult", "display_name": "Other", "active": true})
	item := save("items", map[string]any{"family": family.Id, "created_by": otherMember.Id, "owner": otherMember.Id, "kind": "event", "category": "family", "priority": "normal", "visibility": "family", "title": "Private medical detail", "timezone": "Europe/Amsterdam"})
	private, public, _ := webpush.GenerateVAPIDKeys()
	client := &captureClient{status: 201}
	service := &Service{app: app, config: Config{public, private, "mailto:admin@example.test"}, client: client}
	key, _ := ecdh.P256().GenerateKey(rand.Reader)
	secret := base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	input := subscriptionInput{Endpoint: "https://web.push.apple.com/Q/test", Secret: secret, Keys: webpush.Keys{P256dh: base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()), Auth: base64.RawURLEncoding.EncodeToString(make([]byte, 16))}, Label: "Test device"}
	call := func(auth *core.Record, body any, handler func(*core.RequestEvent) error) (*httptest.ResponseRecorder, error) {
		data, _ := json.Marshal(body)
		req := httptest.NewRequest("POST", "/api/familytime/push/test", bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		if auth != nil {
			token, _ := auth.NewAuthToken()
			req.Header.Set("Authorization", token)
		}
		response := httptest.NewRecorder()
		event := &core.RequestEvent{App: app, Auth: auth, Event: router.Event{Request: req, Response: response}}
		return response, handler(event)
	}
	response, err := call(user, input, service.subscribe)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]string
	json.Unmarshal(response.Body.Bytes(), &result)
	id := result["id"]
	sub, err := app.FindRecordById("push_subscriptions", id)
	if err != nil {
		t.Fatal(err)
	}
	sub.Set("enabled_at", time.Now().Add(-time.Minute))
	if err := app.Save(sub); err != nil {
		t.Fatal(err)
	}
	t.Run("endpoint cannot be hijacked", func(t *testing.T) {
		if _, err := call(other, input, service.subscribe); err == nil {
			t.Fatal("different account captured endpoint")
		}
		bad := input
		bad.Secret = base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{1}, 32))
		if _, err := call(user, bad, service.subscribe); err == nil {
			t.Fatal("same user without device secret captured endpoint")
		}
	})
	notice := func(kind string) *core.Record {
		return save("notifications", map[string]any{"family": family.Id, "recipient_member": member.Id, "recipient_user": user.Id, "item": item.Id, "type": kind, "title": "Sensitive title", "body": "Sensitive body"})
	}
	delivery := func(n *core.Record) *core.Record {
		t.Helper()
		if err := service.collect(); err != nil {
			t.Fatal(err)
		}
		records, err := app.FindRecordsByFilter("push_deliveries", "notification='"+n.Id+"'", "", 10, 0)
		if err != nil || len(records) != 1 {
			t.Fatalf("delivery count: %d %v", len(records), err)
		}
		return records[0]
	}
	t.Run("idempotent enqueue and encrypted send", func(t *testing.T) {
		n := notice("assignment.created")
		d := delivery(n)
		delivery(n)
		if err := service.deliver(d); err != nil {
			t.Fatal(err)
		}
		if d.GetString("state") != "sent" || client.calls != 1 {
			t.Fatal("not delivered")
		}
		if client.encoding != "aes128gcm" || client.authorization == "" || len(client.body) < 100 || bytes.Contains(client.body, []byte("Sensitive")) {
			t.Fatal("missing encryption/VAPID")
		}
		jwt := strings.Split(strings.TrimPrefix(client.authorization, "vapid t="), ",")[0]
		parts := strings.Split(jwt, ".")
		if len(parts) != 3 {
			t.Fatal("invalid VAPID token")
		}
		payload, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			t.Fatal(err)
		}
		var claims map[string]any
		if err := json.Unmarshal(payload, &claims); err != nil {
			t.Fatal(err)
		}
		if claims["sub"] != "mailto:admin@example.test" || claims["aud"] != "https://web.push.apple.com" {
			t.Fatalf("invalid VAPID contact/audience: %v", claims)
		}
	})
	t.Run("visibility rechecked after enqueue", func(t *testing.T) {
		n := notice("event.changed")
		d := delivery(n)
		before := client.calls
		item.Set("visibility", "private")
		if err := app.Save(item); err != nil {
			t.Fatal(err)
		}
		if err := service.deliver(d); err != nil {
			t.Fatal(err)
		}
		if d.GetString("state") != "skipped" || client.calls != before {
			t.Fatal("private item leaked")
		}
		item.Set("visibility", "family")
		app.Save(item)
	})
	t.Run("inactive membership and credential revocation", func(t *testing.T) {
		n := notice("event.reminder")
		d := delivery(n)
		member.Set("active", false)
		app.Save(member)
		service.deliver(d)
		if d.GetString("state") != "skipped" {
			t.Fatal("inactive member notified")
		}
		member.Set("active", true)
		app.Save(member)
		d = delivery(notice("assignment.approved"))
		sub.Set("token_key_hash", "revoked")
		app.Save(sub)
		service.deliver(d)
		if d.GetString("state") != "skipped" {
			t.Fatal("revoked credentials notified")
		}
		sub.Set("token_key_hash", digest(user.TokenKey()))
		app.Save(sub)
	})
	t.Run("bounded retries survive dispatcher restart", func(t *testing.T) {
		d := delivery(notice("assignment.rejected"))
		client.status = 503
		service.deliver(d)
		if d.GetString("state") != "pending" || d.GetInt("attempts") != 1 || !d.GetDateTime("next_at").Time().After(time.Now()) {
			t.Fatal("retry not persisted")
		}
		next := &Service{app: app, config: service.config, client: client}
		persisted, _ := app.FindRecordById("push_deliveries", d.Id)
		client.status = 201
		next.deliver(persisted)
		if persisted.GetString("state") != "sent" {
			t.Fatal("restart lost delivery")
		}
	})
	t.Run("read inbox entries do not send", func(t *testing.T) {
		n := notice("assignment.created")
		d := delivery(n)
		n.Set("read_at", time.Now())
		app.Save(n)
		service.deliver(d)
		if d.GetString("state") != "skipped" {
			t.Fatal("read notice sent")
		}
	})
	t.Run("expired session does not receive push", func(t *testing.T) {
		d := delivery(notice("assignment.created"))
		sub.Set("expires_at", time.Now().Add(-time.Minute))
		app.Save(sub)
		service.deliver(d)
		if d.GetString("state") != "skipped" {
			t.Fatal("expired session notified")
		}
		sub.Set("expires_at", time.Now().Add(time.Hour))
		app.Save(sub)
	})
	t.Run("completed reminder is suppressed", func(t *testing.T) {
		occurrence := save("item_occurrences", map[string]any{"family": family.Id, "item": item.Id, "kind": "task", "title_snapshot": "Task", "category_snapshot": "family", "status": "done"})
		n := notice("event.reminder")
		n.Set("occurrence", occurrence.Id)
		app.Save(n)
		d := delivery(n)
		service.deliver(d)
		if d.GetString("state") != "skipped" {
			t.Fatal("completed reminder sent")
		}
	})
	t.Run("provider gone deletes device and deliveries", func(t *testing.T) {
		second := input
		second.Endpoint = "https://web.push.apple.com/Q/gone"
		response, err := call(user, second, service.subscribe)
		if err != nil {
			t.Fatal(err)
		}
		var data map[string]string
		json.Unmarshal(response.Body.Bytes(), &data)
		if err := enqueue(app, data["id"], ""); err != nil {
			t.Fatal(err)
		}
		records, _ := app.FindRecordsByFilter("push_deliveries", "subscription='"+data["id"]+"'", "", 1, 0)
		client.status = 410
		service.deliver(records[0])
		client.status = 201
		if _, err := app.FindRecordById("push_subscriptions", data["id"]); err == nil {
			t.Fatal("gone endpoint retained")
		}
	})
	t.Run("revocation secret required and logout cascades", func(t *testing.T) {
		d := delivery(notice("assignment.created"))
		call(nil, deviceInput{ID: id, Secret: base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{2}, 32))}, service.revoke)
		if _, err := app.FindRecordById("push_subscriptions", id); err != nil {
			t.Fatal("wrong secret revoked")
		}
		if _, err := call(nil, deviceInput{ID: id, Secret: secret}, service.revoke); err != nil {
			t.Fatal(err)
		}
		if _, err := app.FindRecordById("push_subscriptions", id); err == nil {
			t.Fatal("logout retained subscription")
		}
		if _, err := app.FindRecordById("push_deliveries", d.Id); err == nil {
			t.Fatal("logout retained delivery")
		}
	})
	t.Run("collections are server only", func(t *testing.T) {
		for _, name := range []string{"push_subscriptions", "push_deliveries"} {
			c, _ := app.FindCollectionByNameOrId(name)
			if c.ListRule != nil || c.ViewRule != nil || c.CreateRule != nil || c.UpdateRule != nil || c.DeleteRule != nil {
				t.Fatal(fmt.Sprint(name, " publicly writable"))
			}
		}
	})
}
