package push

import (
	"context"
	"crypto/ecdh"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"errors"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

type Config struct{ PublicKey, PrivateKey, Subject string }

func ConfigFromEnv() Config {
	return Config{os.Getenv("FAMILYTIME_VAPID_PUBLIC_KEY"), os.Getenv("FAMILYTIME_VAPID_PRIVATE_KEY"), os.Getenv("FAMILYTIME_VAPID_SUBJECT")}
}
func (c Config) enabled() bool { return c.PublicKey != "" && c.PrivateKey != "" && c.Subject != "" }
func (c Config) validate() error {
	if c.PublicKey == "" && c.PrivateKey == "" && c.Subject == "" {
		return nil
	}
	key, err := base64.RawURLEncoding.DecodeString(c.PrivateKey)
	if err != nil {
		return errors.New("invalid VAPID private key")
	}
	private, err := ecdh.P256().NewPrivateKey(key)
	if err != nil || !c.enabled() || base64.RawURLEncoding.EncodeToString(private.PublicKey().Bytes()) != c.PublicKey || !strings.HasPrefix(c.Subject, "mailto:") || !strings.Contains(c.Subject, "@") {
		return errors.New("VAPID requires matching P256 keys and a mailto contact")
	}
	return nil
}

type Service struct {
	app    core.App
	config Config
	client webpush.HTTPClient
	mu     sync.Mutex
}

func Register(app core.App, config Config) error {
	if err := config.validate(); err != nil {
		return err
	}
	service := &Service{app: app, config: config, client: secureClient()}
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/api/familytime/push/config", func(e *core.RequestEvent) error {
			e.Response.Header().Set("Cache-Control", "no-store")
			return e.JSON(200, map[string]any{"enabled": config.enabled(), "publicKey": config.PublicKey})
		})
		e.Router.PUT("/api/familytime/push/subscription", service.subscribe).Bind(apis.RequireAuth("users"), apis.BodyLimit(8192))
		e.Router.POST("/api/familytime/push/revoke", service.revoke).Bind(apis.BodyLimit(1024))
		e.Router.POST("/api/familytime/push/test", service.test).Bind(apis.RequireAuth("users"), apis.BodyLimit(1024))
		if config.enabled() {
			app.Cron().MustAdd("familytime-push", "* * * * *", service.run)
			app.Cron().MustAdd("familytime-push-cleanup", "17 3 * * *", service.cleanup)
			go service.run()
		}
		return e.Next()
	})
	app.OnRecordAfterCreateSuccess("notifications").BindFunc(func(e *core.RecordEvent) error {
		err := e.Next()
		if err == nil && config.enabled() {
			go service.run()
		}
		return err
	})
	return nil
}

func secureClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		for _, ip := range ips {
			if !ip.IP.IsGlobalUnicast() || ip.IP.IsPrivate() || ip.IP.IsLoopback() || ip.IP.IsLinkLocalUnicast() {
				return nil, errors.New("non-public push destination")
			}
		}
		for _, ip := range ips {
			conn, err := (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, net.JoinHostPort(ip.IP.String(), port))
			if err == nil {
				return conn, nil
			}
		}
		return nil, errors.New("push destination unreachable")
	}
	return &http.Client{Transport: transport, Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

type subscriptionInput struct {
	Endpoint string       `json:"endpoint"`
	Keys     webpush.Keys `json:"keys"`
	Secret   string       `json:"secret"`
	Label    string       `json:"label"`
}

func validSecret(secret string) bool {
	b, err := base64.RawURLEncoding.DecodeString(secret)
	return err == nil && len(b) == 32
}
func secretMatches(record *core.Record, secret string) bool {
	return validSecret(secret) && subtle.ConstantTimeCompare([]byte(record.GetString("secret_hash")), []byte(digest(secret))) == 1
}

func (s *Service) subscribe(e *core.RequestEvent) error {
	if !s.config.enabled() {
		return e.Error(503, "Push пока не настроен", nil)
	}
	input := subscriptionInput{}
	if err := e.BindBody(&input); err != nil {
		return e.BadRequestError("Некорректная подписка", nil)
	}
	if !validEndpoint(input.Endpoint) || !validKeys(input.Keys) || !validSecret(input.Secret) || len([]rune(input.Label)) > 80 {
		return e.BadRequestError("Некорректная подписка", nil)
	}
	claims, err := security.ParseUnverifiedJWT(strings.TrimPrefix(e.Request.Header.Get("Authorization"), "Bearer "))
	if err != nil {
		return e.BadRequestError("Некорректная сессия", nil)
	}
	expires, err := claims.GetExpirationTime()
	if err != nil || expires == nil {
		return e.BadRequestError("Некорректная сессия", nil)
	}
	var id string
	err = s.app.RunInTransaction(func(tx core.App) error {
		record, err := tx.FindFirstRecordByFilter("push_subscriptions", "endpoint_hash={:hash}", dbx.Params{"hash": digest(input.Endpoint)})
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if record != nil {
			if record.GetString("user") != e.Auth.Id || !secretMatches(record, input.Secret) {
				return e.ForbiddenError("Подписка принадлежит другой сессии", nil)
			}
		} else {
			count, err := tx.CountRecords("push_subscriptions", dbx.HashExp{"user": e.Auth.Id})
			if err != nil {
				return err
			}
			if count >= 10 {
				return e.BadRequestError("Достигнут лимит устройств", nil)
			}
			collection, err := tx.FindCollectionByNameOrId("push_subscriptions")
			if err != nil {
				return err
			}
			record = core.NewRecord(collection)
			record.Set("enabled_at", time.Now().UTC())
			record.Set("user", e.Auth.Id)
		}
		record.Set("endpoint", input.Endpoint)
		record.Set("endpoint_hash", digest(input.Endpoint))
		record.Set("p256dh", input.Keys.P256dh)
		record.Set("auth", input.Keys.Auth)
		record.Set("secret_hash", digest(input.Secret))
		record.Set("token_key_hash", digest(e.Auth.TokenKey()))
		record.Set("expires_at", expires.Time)
		record.Set("label", input.Label)
		if err := tx.Save(record); err != nil {
			return err
		}
		id = record.Id
		return nil
	})
	if err != nil {
		return err
	}
	return e.JSON(200, map[string]string{"id": id})
}

type deviceInput struct {
	ID     string `json:"id"`
	Secret string `json:"secret"`
}

func (s *Service) revoke(e *core.RequestEvent) error {
	input := deviceInput{}
	if err := e.BindBody(&input); err != nil || !validSecret(input.Secret) {
		return e.BadRequestError("Некорректный запрос", nil)
	}
	record, err := s.app.FindRecordById("push_subscriptions", input.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if record != nil && secretMatches(record, input.Secret) {
		if err := s.app.Delete(record); err != nil {
			return err
		}
	}
	return e.NoContent(204)
}

func (s *Service) test(e *core.RequestEvent) error {
	if !s.config.enabled() {
		return e.Error(503, "Push пока не настроен", nil)
	}
	input := deviceInput{}
	if err := e.BindBody(&input); err != nil {
		return e.BadRequestError("Некорректный запрос", nil)
	}
	err := s.app.RunInTransaction(func(tx core.App) error {
		record, err := tx.FindRecordById("push_subscriptions", input.ID)
		if err != nil || record.GetString("user") != e.Auth.Id || !secretMatches(record, input.Secret) {
			return e.ForbiddenError("Нет доступа к устройству", nil)
		}
		if time.Since(record.GetDateTime("last_test_at").Time()) < time.Minute {
			return e.TooManyRequestsError("Повторите через минуту", nil)
		}
		record.Set("last_test_at", time.Now().UTC())
		if err := tx.Save(record); err != nil {
			return err
		}
		return enqueue(tx, record.Id, "")
	})
	if err != nil {
		return err
	}
	go s.run()
	return e.JSON(202, map[string]bool{"queued": true})
}
