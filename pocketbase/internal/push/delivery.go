package push

import (
	"context"
	"encoding/json"
	"fmt"
	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"io"
	"strings"
	"time"
)

func enqueue(app core.App, subscription, notification string) error {
	collection, err := app.FindCollectionByNameOrId("push_deliveries")
	if err != nil {
		return err
	}
	record := core.NewRecord(collection)
	record.Set("subscription", subscription)
	record.Set("notification", notification)
	record.Set("state", "pending")
	record.Set("next_at", time.Now().UTC())
	return app.Save(record)
}

func (s *Service) collect() error {
	return s.app.RunInTransaction(func(tx core.App) error {
		notices, err := tx.FindRecordsByFilter("notifications", "push_enqueued=false", "created", 100, 0)
		if err != nil {
			return err
		}
		for _, notice := range notices {
			if time.Since(notice.GetDateTime("created").Time()) < 24*time.Hour && notice.GetString("recipient_user") != "" && notice.GetString("read_at") == "" {
				subscriptions, err := tx.FindRecordsByFilter("push_subscriptions", "user={:user} && enabled_at<={:created}", "", 10, 0, dbx.Params{"user": notice.GetString("recipient_user"), "created": notice.GetString("created")})
				if err != nil {
					return err
				}
				for _, sub := range subscriptions {
					if err := enqueue(tx, sub.Id, notice.Id); err != nil {
						return err
					}
				}
			}
			notice.Set("push_enqueued", true)
			if err := tx.Save(notice); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Service) run() {
	if !s.mu.TryLock() {
		return
	}
	defer s.mu.Unlock()
	if err := s.collect(); err != nil {
		s.app.Logger().Error("Push collection failed", "error", err.Error())
		return
	}
	records, err := s.app.FindRecordsByFilter("push_deliveries", "state='pending' && next_at<={:now}", "next_at", 32, 0, dbx.Params{"now": time.Now().UTC().Format("2006-01-02 15:04:05.000Z")})
	if err != nil {
		s.app.Logger().Error("Push queue read failed", "error", err.Error())
		return
	}
	for _, record := range records {
		if err := s.deliver(record); err != nil {
			s.app.Logger().Error("Push delivery state failed", "id", record.Id, "error", err.Error())
		}
	}
}

func (s *Service) allowed(sub, notice *core.Record) bool {
	user, err := s.app.FindRecordById("users", sub.GetString("user"))
	if err != nil || digest(user.TokenKey()) != sub.GetString("token_key_hash") || !sub.GetDateTime("expires_at").Time().After(time.Now()) {
		return false
	}
	if notice == nil {
		return true
	}
	if notice.GetString("recipient_user") != user.Id || notice.GetString("read_at") != "" {
		return false
	}
	ok, err := s.app.CanAccessRecord(notice, &core.RequestInfo{Auth: user, Method: "GET", Context: core.RequestInfoContextDefault}, notice.Collection().ViewRule)
	if !ok || err != nil {
		return false
	}
	if occurrence := notice.GetString("occurrence"); occurrence != "" && (strings.Contains(notice.GetString("type"), "reminder") || strings.Contains(notice.GetString("type"), "due_soon")) {
		record, err := s.app.FindRecordById("item_occurrences", occurrence)
		if err != nil {
			return false
		}
		switch record.GetString("status") {
		case "done", "approved", "cancelled", "skipped":
			return false
		}
	}
	return true
}

func (s *Service) deliver(record *core.Record) error {
	finish := func(state string) error { record.Set("state", state); return s.app.Save(record) }
	sub, err := s.app.FindRecordById("push_subscriptions", record.GetString("subscription"))
	if err != nil {
		return nil
	} // Cascade deletion revokes queued work.
	var notice *core.Record
	if id := record.GetString("notification"); id != "" {
		notice, err = s.app.FindRecordById("notifications", id)
		if err != nil {
			return finish("skipped")
		}
	}
	if time.Since(record.GetDateTime("created").Time()) > 24*time.Hour || !s.allowed(sub, notice) {
		return finish("skipped")
	}
	path := "/app/notifications"
	body := "Откройте приложение, чтобы посмотреть обновление."
	if notice != nil && notice.GetString("item") != "" {
		path = "/app/items/" + notice.GetString("item")
	}
	if notice == nil {
		body = "Уведомления на этом устройстве работают."
	}
	payload, _ := json.Marshal(map[string]string{"title": "FamilyTime", "body": body, "url": path, "subscriptionId": sub.Id, "tag": "familytime-" + record.Id})
	subscription := webpush.Subscription{Endpoint: sub.GetString("endpoint"), Keys: webpush.Keys{P256dh: sub.GetString("p256dh"), Auth: sub.GetString("auth")}}
	if !validEndpoint(subscription.Endpoint) || !validKeys(subscription.Keys) {
		return finish("failed")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	response, sendErr := webpush.SendNotificationWithContext(ctx, payload, &subscription, &webpush.Options{HTTPClient: s.client, Subscriber: s.config.Subject, VAPIDPublicKey: s.config.PublicKey, VAPIDPrivateKey: s.config.PrivateKey, TTL: 3600, Topic: record.Id, Urgency: webpush.UrgencyNormal})
	status := 0
	if response != nil {
		status = response.StatusCode
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		response.Body.Close()
	}
	if sendErr != nil {
		status = 0
	}
	record.Set("last_status", fmt.Sprint(status))
	attempts := record.GetInt("attempts") + 1
	record.Set("attempts", attempts)
	switch disposition(status) {
	case "sent":
		return finish("sent")
	case "gone":
		return s.app.Delete(sub)
	case "retry":
		if attempts >= 6 {
			return finish("failed")
		}
		record.Set("next_at", time.Now().UTC().Add(time.Duration(1<<attempts)*time.Minute))
		return s.app.Save(record)
	default:
		return finish("failed")
	}
}

func (s *Service) cleanup() {
	// Bounded deletion avoids long SQLite write locks on the shared small VPS.
	cutoff := time.Now().UTC().Add(-7 * 24 * time.Hour).Format("2006-01-02 15:04:05.000Z")
	records, err := s.app.FindRecordsByFilter("push_deliveries", "created<{:cutoff}", "created", 500, 0, dbx.Params{"cutoff": cutoff})
	if err == nil {
		for _, record := range records {
			if err := s.app.Delete(record); err != nil {
				break
			}
		}
	}
	expired, err := s.app.FindRecordsByFilter("push_subscriptions", "expires_at<{:cutoff}", "expires_at", 100, 0, dbx.Params{"cutoff": cutoff})
	if err == nil {
		for _, record := range expired {
			if err := s.app.Delete(record); err != nil {
				break
			}
		}
	}
}
