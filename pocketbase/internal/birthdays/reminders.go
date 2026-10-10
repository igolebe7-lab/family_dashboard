package birthdays

import (
	"fmt"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

const pageSize = 100

type Service struct {
	app    core.App
	mu     sync.Mutex
	cursor string
}

func NewService(app core.App) *Service { return &Service{app: app} }

func Register(app core.App) {
	service := NewService(app)
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		app.Cron().MustAdd("familytime-birthday-reminders", "* * * * *", func() {
			if err := service.Run(time.Now()); err != nil {
				app.Logger().Error("Birthday reminder delivery failed", "error", err.Error())
			}
		})
		return e.Next()
	})
}

func location(zone string) *time.Location {
	if zone == "" {
		zone = "Europe/Moscow"
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		loc, _ = time.LoadLocation("Europe/Moscow")
	}
	return loc
}

// Calendar days, not 72 hours: DST changes must not move the reminder date.
func InDeliveryWindow(birthdayDate, zone string, now time.Time) bool {
	birthday, err := time.Parse("2006-01-02", birthdayDate)
	if err != nil {
		return false
	}
	local := now.In(location(zone))
	return local.Hour() >= 10 && local.Hour() < 23 &&
		local.Format("2006-01-02") == birthday.AddDate(0, 0, -3).Format("2006-01-02")
}

// Providers may queue an offline device; never keep a birthday push past 23:00.
func WindowTTL(birthdayDate, zone string, now time.Time) int {
	if !InDeliveryWindow(birthdayDate, zone, now) {
		return 0
	}
	local := now.In(location(zone))
	end := time.Date(local.Year(), local.Month(), local.Day(), 23, 0, 0, 0, local.Location())
	seconds := int(end.Sub(now).Seconds())
	if seconds > 3600 {
		return 3600
	}
	return seconds
}

func dateMatches(annotation *core.Record, date string) bool {
	d, err := time.Parse("2006-01-02", date)
	if err != nil || annotation.GetString("kind") != "birthday" ||
		annotation.GetInt("month") != int(d.Month()) || annotation.GetInt("day") != d.Day() {
		return false
	}
	if birth := annotation.GetString("birth_date"); len(birth) >= 10 && date < birth[:10] {
		return false
	}
	return annotation.GetString("recurrence") == "yearly" ||
		(annotation.GetString("recurrence") == "one_time" && annotation.GetInt("year") == d.Year())
}

func canView(app core.App, annotation, member *core.Record) bool {
	if !member.GetBool("active") || annotation.GetString("family") != member.GetString("family") {
		return false
	}
	if linked := annotation.GetString("linked_member"); linked != "" {
		r, err := app.FindRecordById("family_members", linked)
		if err != nil || !r.GetBool("active") || r.GetString("family") != member.GetString("family") {
			return false
		}
	}
	switch annotation.GetString("visibility") {
	case "family":
		return true
	case "adults":
		return member.GetString("role") == "owner" || member.GetString("role") == "parent" || member.GetString("role") == "adult"
	case "private", "assignees":
		return annotation.GetString("created_by") == member.Id || annotation.GetString("linked_member") == member.Id
	}
	return false
}

// Rechecked by Web Push immediately before each attempt, including retries.
func CanDeliver(app core.App, notice *core.Record, now time.Time) bool {
	annotation, err := app.FindRecordById("day_annotations", notice.GetString("annotation"))
	if err != nil || annotation.GetString("family") != notice.GetString("family") || !dateMatches(annotation, notice.GetString("annotation_date")) {
		return false
	}
	member, err := app.FindRecordById("family_members", notice.GetString("recipient_member"))
	if err != nil || member.GetString("user") != notice.GetString("recipient_user") || !canView(app, annotation, member) {
		return false
	}
	user, err := app.FindRecordById("users", notice.GetString("recipient_user"))
	return err == nil && InDeliveryWindow(notice.GetString("annotation_date"), user.GetString("timezone"), now)
}

func (s *Service) Run(now time.Time) error {
	if !s.mu.TryLock() {
		return nil
	}
	defer s.mu.Unlock()
	members, err := s.app.FindRecordsByFilter("family_members", "active=true && user!='' && id>{:cursor}", "id", pageSize, 0, dbx.Params{"cursor": s.cursor})
	if err != nil {
		return err
	}
	var firstErr error
	for _, member := range members {
		if err := s.deliverMember(member.Id, now); err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("member %s: %w", member.Id, err)
			}
		}
		s.cursor = member.Id
	}
	if len(members) < pageSize {
		s.cursor = ""
	}
	return firstErr
}

func (s *Service) deliverMember(id string, now time.Time) error {
	member, err := s.app.FindRecordById("family_members", id)
	if err != nil {
		return err
	}
	user, err := s.app.FindRecordById("users", member.GetString("user"))
	if err != nil {
		return err
	}
	local := now.In(location(user.GetString("timezone")))
	if local.Hour() < 10 || local.Hour() >= 23 {
		return nil
	}
	// UTC civil coordinate avoids skipped midnights and leap-day normalization.
	civil, _ := time.Parse("2006-01-02", local.Format("2006-01-02"))
	birthday := civil.AddDate(0, 0, 3)
	rows, err := s.app.FindRecordsByFilter("day_annotations", "family={:family} && kind='birthday' && month={:month} && day={:day}", "id", 0, 0,
		dbx.Params{"family": member.GetString("family"), "month": int(birthday.Month()), "day": birthday.Day()})
	if err != nil {
		return err
	}
	for _, row := range rows {
		if err := s.createNotice(id, row.Id, birthday.Format("2006-01-02"), now); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) createNotice(memberID, annotationID, date string, now time.Time) error {
	return s.app.RunInTransaction(func(tx core.App) error {
		member, err := tx.FindRecordById("family_members", memberID)
		if err != nil {
			return err
		}
		annotation, err := tx.FindRecordById("day_annotations", annotationID)
		if err != nil {
			return err
		}
		user, err := tx.FindRecordById("users", member.GetString("user"))
		if err != nil {
			return err
		}
		if !dateMatches(annotation, date) || !canView(tx, annotation, member) || !InDeliveryWindow(date, user.GetString("timezone"), now) {
			return nil
		}
		existing, err := tx.FindRecordsByFilter("notifications", "type='birthday.reminder' && annotation={:annotation} && annotation_date={:date} && recipient_member={:member}", "", 1, 0,
			dbx.Params{"annotation": annotationID, "date": date, "member": memberID})
		if err != nil || len(existing) > 0 {
			return err
		}
		collection, err := tx.FindCollectionByNameOrId("notifications")
		if err != nil {
			return err
		}
		notice := core.NewRecord(collection)
		notice.Set("family", member.GetString("family"))
		notice.Set("recipient_member", memberID)
		notice.Set("recipient_user", user.Id)
		notice.Set("type", "birthday.reminder")
		notice.Set("annotation", annotationID)
		notice.Set("annotation_date", date)
		notice.Set("title", "День рождения через три дня")
		name := strings.TrimSpace(annotation.GetString("title"))
		notice.Set("body", name+" · "+birthdayText(date))
		notice.Set("delivered_at", now.UTC())
		return tx.Save(notice)
	})
}

func birthdayText(date string) string {
	d, _ := time.Parse("2006-01-02", date)
	months := []string{"", "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"}
	return fmt.Sprintf("%d %s", d.Day(), months[d.Month()])
}
