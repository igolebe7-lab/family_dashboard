package push

import (
	"crypto/ecdh"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	webpush "github.com/SherClockHolmes/webpush-go"
	"net/url"
	"strings"
)

func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func validEndpoint(value string) bool {
	u, err := url.Parse(value)
	if err != nil || len(value) > 4096 || u.Scheme != "https" || u.User != nil || u.Fragment != "" || (u.Port() != "" && u.Port() != "443") {
		return false
	}
	host := u.Hostname()
	return host == "fcm.googleapis.com" || host == "web.push.apple.com" ||
		host == "updates.push.services.mozilla.com" || strings.HasSuffix(host, ".notify.windows.com")
}

func validKeys(keys webpush.Keys) bool {
	auth, err := base64.RawURLEncoding.DecodeString(keys.Auth)
	if err != nil || len(auth) != 16 {
		return false
	}
	public, err := base64.RawURLEncoding.DecodeString(keys.P256dh)
	if err != nil {
		return false
	}
	_, err = ecdh.P256().NewPublicKey(public)
	return err == nil
}

func disposition(status int) string {
	if status >= 200 && status < 300 {
		return "sent"
	}
	if status == 404 || status == 410 {
		return "gone"
	}
	if status == 0 || status == 429 || status >= 500 {
		return "retry"
	}
	return "failed"
}
