package media

import (
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	_ "golang.org/x/image/webp"
)

type Link struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

func ValidateLinks(links []Link) ([]Link, error) {
	if len(links) > 10 {
		return nil, errors.New("Не более 10 ссылок")
	}
	seen := map[string]bool{}
	for i := range links {
		link := &links[i]
		link.ID = strings.TrimSpace(link.ID)
		link.Title = strings.TrimSpace(link.Title)
		link.URL = strings.TrimSpace(link.URL)
		u, err := url.Parse(link.URL)
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil ||
			link.ID == "" || len(link.ID) > 64 || seen[link.ID] || utf8.RuneCountInString(link.Title) > 120 || len(link.URL) > 2048 {
			return nil, errors.New("Некорректная ссылка: используйте http или https без пароля")
		}
		if link.Title == "" {
			link.Title = u.Hostname()
		}
		seen[link.ID] = true
	}
	if links == nil {
		links = []Link{}
	}
	return links, nil
}

func decodeLinks(value any) ([]Link, error) {
	if value == nil {
		return []Link{}, nil
	}
	var data []byte
	if s, ok := value.(string); ok {
		data = []byte(s)
	} else {
		var err error
		data, err = json.Marshal(value)
		if err != nil {
			return nil, err
		}
	}
	if len(data) > 30000 {
		return nil, errors.New("Слишком много ссылок")
	}
	var links []Link
	if err := json.Unmarshal(data, &links); err != nil {
		return nil, errors.New("Некорректные ссылки")
	}
	return ValidateLinks(links)
}

func validateImages(files []*filesystem.File, maxDimension int) error {
	if len(files) > 10 {
		return errors.New("Не более 10 фотографий")
	}
	for _, f := range files {
		if f.Size <= 0 || f.Size > 2*1024*1024 {
			return errors.New("Фото должно быть не больше 2 МБ")
		}
		r, err := f.Reader.Open()
		if err != nil {
			return err
		}
		config, format, err := image.DecodeConfig(io.LimitReader(r, 2*1024*1024))
		r.Close()
		if err != nil || (format != "jpeg" && format != "png" && format != "webp") || config.Width < 1 || config.Height < 1 || config.Width > maxDimension || config.Height > maxDimension {
			return errors.New("Используйте JPEG, PNG или WebP допустимого размера")
		}
	}
	return nil
}

func managedBy(actor, target *core.Record) bool {
	if actor == nil || target == nil || !actor.GetBool("active") || !target.GetBool("active") || actor.GetString("family") != target.GetString("family") || (target.GetString("role") != "child" && target.GetString("role") != "teen") {
		return false
	}
	if actor.GetString("role") == "owner" {
		return true
	}
	if actor.GetString("role") != "parent" {
		return false
	}
	for _, id := range target.GetStringSlice("managed_by") {
		if id == actor.Id {
			return true
		}
	}
	return false
}

func canManageAvatar(actor, target *core.Record) bool {
	return actor != nil && target != nil && actor.GetBool("active") && target.GetBool("active") && actor.GetString("family") == target.GetString("family") && (actor.Id == target.Id || managedBy(actor, target))
}

func finalPhotos(status string, approval bool) bool {
	return status == "approved" || status == "done" && !approval
}

func actorFor(app core.App, auth *core.Record, family, requested string) (*core.Record, error) {
	if auth == nil {
		return nil, errors.New("Нужен вход в аккаунт")
	}
	actors, err := app.FindRecordsByFilter("family_members", "family={:family} && user={:user} && active=true", "id", 20, 0, dbx.Params{"family": family, "user": auth.Id})
	if err != nil {
		return nil, err
	}
	for _, actor := range actors {
		if requested == "" || requested == actor.Id {
			return actor, nil
		}
	}
	if requested != "" {
		target, err := app.FindRecordById("family_members", requested)
		if err == nil {
			for _, actor := range actors {
				if managedBy(actor, target) {
					return target, nil
				}
			}
		}
	}
	return nil, errors.New("Нет доступа к этому профилю")
}

func canView(app core.App, actor, item *core.Record) bool {
	if actor == nil || item.GetString("family") != actor.GetString("family") || !actor.GetBool("active") || item.GetBool("archived") {
		return false
	}
	switch item.GetString("visibility") {
	case "family":
		return true
	case "adults":
		return actor.GetString("role") == "owner" || actor.GetString("role") == "parent" || actor.GetString("role") == "adult"
	case "private":
		return actor.GetString("role") == "owner" || item.GetString("created_by") == actor.Id || item.GetString("owner") == actor.Id
	case "assignees":
		if actor.GetString("role") == "owner" || item.GetString("created_by") == actor.Id || item.GetString("owner") == actor.Id {
			return true
		}
		for _, id := range append(item.GetStringSlice("assignees"), item.GetStringSlice("participants")...) {
			if id == actor.Id {
				return true
			}
			if target, err := app.FindRecordById("family_members", id); err == nil && managedBy(actor, target) {
				return true
			}
		}
	}
	return false
}

func canEdit(app core.App, actor, item, occurrence *core.Record) bool {
	if !canView(app, actor, item) {
		return false
	}
	switch occurrence.GetString("status") {
	case "todo", "assigned", "accepted", "in_progress", "overdue", "rejected":
	default:
		return false
	}
	ids := append(item.GetStringSlice("assignees"), item.GetString("owner"), item.GetString("created_by"))
	for _, id := range ids {
		if id == actor.Id {
			return true
		}
	}
	for _, id := range append(item.GetStringSlice("assignees"), item.GetString("owner")) {
		if target, err := app.FindRecordById("family_members", id); err == nil && managedBy(actor, target) {
			return true
		}
	}
	return false
}
