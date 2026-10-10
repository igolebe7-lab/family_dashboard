package birthdays

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"path/filepath"
	"testing"
	"time"
)

func TestReminderWindow(t *testing.T) {
	for _, tc := range []struct {
		now, zone, date string
		want            bool
	}{
		{"2026-12-29T06:59:59Z", "Europe/Moscow", "2027-01-01", false},
		{"2026-12-29T07:00:00Z", "", "2027-01-01", true},
		{"2026-12-29T19:59:00Z", "Europe/Moscow", "2027-01-01", true},
		{"2026-12-29T20:00:00Z", "Europe/Moscow", "2027-01-01", false},
		{"2026-12-30T07:00:00Z", "Europe/Moscow", "2027-01-01", false},
		{"2026-12-29T07:00:00Z", "Europe/Amsterdam", "2027-01-01", false},
		{"2026-12-29T09:00:00Z", "Europe/Amsterdam", "2027-01-01", true},
		{"2026-03-27T09:00:00Z", "Europe/Amsterdam", "2026-03-30", true},
		{"2028-02-26T07:00:00Z", "Europe/Moscow", "2028-02-29", true},
		{"2027-02-26T07:00:00Z", "Europe/Moscow", "2027-02-29", false},
	} {
		now, _ := time.Parse(time.RFC3339, tc.now)
		if got := InDeliveryWindow(tc.date, tc.zone, now); got != tc.want {
			t.Errorf("%+v: got %v", tc, got)
		}
	}
}

func TestBirthdayPushExpiresBeforeNight(t *testing.T) {
	for _, tc := range []struct {
		now  string
		want int
	}{
		{"2026-12-29T07:00:00Z", 3600},
		{"2026-12-29T19:30:00Z", 1800},
		{"2026-12-29T19:59:30Z", 30},
		{"2026-12-29T20:00:00Z", 0},
	} {
		now, _ := time.Parse(time.RFC3339, tc.now)
		if got := WindowTTL("2027-01-01", "Europe/Moscow", now); got != tc.want {
			t.Errorf("%s: TTL %d want %d", tc.now, got, tc.want)
		}
	}
}

func TestBirthdayReminderIntegration(t *testing.T) {
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
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Fatal(err)
		}
		r := core.NewRecord(col)
		for k, v := range fields {
			r.Set(k, v)
		}
		if err := app.Save(r); err != nil {
			t.Fatal(name, err)
		}
		return r
	}
	owner := save("users", map[string]any{"email": "birthday-owner@example.test", "password": "Local-testing-123", "passwordConfirm": "Local-testing-123"})
	child := save("users", map[string]any{"email": "birthday-child@example.test", "password": "Local-testing-123", "passwordConfirm": "Local-testing-123", "timezone": "Europe/Amsterdam"})
	family := save("families", map[string]any{"name": "Birthday", "slug": "birthday-test", "owner_user": owner.Id, "timezone": "UTC"})
	adult := save("family_members", map[string]any{"family": family.Id, "user": owner.Id, "display_name": "Adult", "role": "owner", "active": true})
	kid := save("family_members", map[string]any{"family": family.Id, "user": child.Id, "display_name": "Child", "role": "child", "active": true})
	save("family_members", map[string]any{"family": family.Id, "display_name": "Managed", "role": "child", "active": true})
	b := save("day_annotations", map[string]any{"family": family.Id, "created_by": adult.Id, "kind": "birthday", "title": "День рождения · Ева", "person_name": "Ева", "birth_date": "2018-01-01", "month": 1, "day": 1, "recurrence": "yearly", "color": "peach", "tone": "positive", "visibility": "family", "source": "manual"})
	run := func(clock string) {
		t.Helper()
		now, _ := time.Parse(time.RFC3339, clock)
		if err := NewService(app).Run(now); err != nil {
			t.Fatal(err)
		}
	}
	count := func(want int) []*core.Record {
		t.Helper()
		rows, err := app.FindRecordsByFilter("notifications", "type='birthday.reminder'", "", 0, 0)
		if err != nil || len(rows) != want {
			t.Fatalf("notices %d want %d: %v", len(rows), want, err)
		}
		return rows
	}
	run("2026-12-29T06:59:00Z")
	count(0)
	run("2026-12-29T07:00:00Z")
	rows := count(1)
	if rows[0].GetString("recipient_member") != adult.Id || rows[0].GetString("annotation_date") != "2027-01-01" || rows[0].GetString("annotation") != b.Id {
		t.Fatal("wrong recipient/date")
	}
	run("2026-12-29T07:01:00Z")
	count(1)
	run("2026-12-29T09:00:00Z")
	rows = count(2)
	clock, _ := time.Parse(time.RFC3339, "2026-12-29T09:00:00Z")
	for _, r := range rows {
		if !CanDeliver(app, r, clock) || CanDeliver(app, r, clock.Add(24*time.Hour)) {
			t.Fatal("push reminder window")
		}
	}
	for _, r := range rows {
		if r.GetString("recipient_member") != adult.Id && r.GetString("recipient_member") != kid.Id {
			t.Fatal("managed child duplicate")
		}
	}
	run("2026-12-29T22:00:00Z")
	count(2)
	b.Set("visibility", "private")
	if err := app.Save(b); err != nil {
		t.Fatal(err)
	}
	notice := rows[0]
	if notice.GetString("recipient_user") != child.Id {
		notice = rows[1]
	}
	if CanDeliver(app, notice, clock) {
		t.Fatal("queued private birthday leaked")
	}
	ok, err := app.CanAccessRecord(notice, &core.RequestInfo{Auth: child, Method: "GET"}, notice.Collection().ViewRule)
	if err != nil || ok {
		t.Fatalf("private birthday notification leaked: %v %v", ok, err)
	}
	ok, err = app.CanAccessRecord(b, &core.RequestInfo{Auth: child, Method: "GET"}, b.Collection().ViewRule)
	if err != nil || ok {
		t.Fatalf("private calendar birthday leaked: %v %v", ok, err)
	}
	// Independent scheduler instances must not double-send across a restart/race.
	clock2, _ := time.Parse(time.RFC3339, "2027-12-29T09:00:00Z")
	errors := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() { errors <- NewService(app).Run(clock2) }()
	}
	for i := 0; i < 2; i++ {
		if err := <-errors; err != nil {
			t.Fatal(err)
		}
	}
	count(3)
	b.Set("visibility", "adults")
	app.Save(b)
	if CanDeliver(app, notice, clock) {
		t.Fatal("queued adult birthday leaked to child")
	}
	otherFamily := save("families", map[string]any{"name": "Other", "slug": "birthday-other", "owner_user": child.Id, "timezone": "UTC"})
	save("family_members", map[string]any{"family": otherFamily.Id, "user": child.Id, "display_name": "Other owner", "role": "owner", "active": true})
	ok, err = app.CanAccessRecord(b, &core.RequestInfo{Auth: child, Method: "GET"}, b.Collection().ViewRule)
	if err != nil || ok {
		t.Fatalf("adult role from another family bypassed calendar visibility: %v %v", ok, err)
	}
	b.Set("visibility", "family")
	b.Set("day", 2)
	app.Save(b)
	if CanDeliver(app, notice, clock) {
		t.Fatal("old date pushed after rescheduling")
	}
	b.Set("day", 1)
	b.Set("visibility", "adults")
	app.Save(b)
	run("2028-12-29T09:00:00Z")
	count(4)
	adult.Set("active", false)
	app.Save(adult)
	run("2029-12-29T09:00:00Z")
	count(4)
	if err := app.Delete(b); err != nil {
		t.Fatal(err)
	}
	count(0)
}
