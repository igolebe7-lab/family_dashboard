package push

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	webpush "github.com/SherClockHolmes/webpush-go"
	"testing"
)

func TestEndpointValidation(t *testing.T) {
	for _, endpoint := range []string{"http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://fcm.googleapis.com.evil.test/a", "https://fcm.googleapis.com:8443/a", "https://user@web.push.apple.com/a", "https://localhost/a"} {
		if validEndpoint(endpoint) {
			t.Errorf("accepted unsafe endpoint %s", endpoint)
		}
	}
	for _, endpoint := range []string{"https://fcm.googleapis.com/fcm/send/a", "https://web.push.apple.com/Q/a", "https://updates.push.services.mozilla.com/wpush/v2/a", "https://wns2-db5p.notify.windows.com/w/?token=a"} {
		if !validEndpoint(endpoint) {
			t.Errorf("rejected provider %s", endpoint)
		}
	}
}

func TestSubscriptionKeys(t *testing.T) {
	key, _ := ecdh.P256().GenerateKey(rand.Reader)
	good := webpush.Keys{P256dh: base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()), Auth: base64.RawURLEncoding.EncodeToString(make([]byte, 16))}
	if !validKeys(good) {
		t.Fatal("valid subscription rejected")
	}
	good.P256dh = base64.RawURLEncoding.EncodeToString(make([]byte, 65))
	if validKeys(good) {
		t.Fatal("invalid curve point accepted")
	}
}

func TestDeliveryDisposition(t *testing.T) {
	for _, status := range []int{200, 201, 202} {
		if disposition(status) != "sent" {
			t.Fatal(status)
		}
	}
	for _, status := range []int{404, 410} {
		if disposition(status) != "gone" {
			t.Fatal(status)
		}
	}
	for _, status := range []int{0, 429, 500, 503} {
		if disposition(status) != "retry" {
			t.Fatal(status)
		}
	}
	if disposition(400) != "failed" {
		t.Fatal("permanent failure retried")
	}
}
