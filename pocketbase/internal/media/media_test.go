package media

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func TestLinksRejectUnsafeSchemes(t *testing.T) {
	for _, url := range []string{"javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "https://user:password@example.org", "https://", "//example.org"} {
		if _, err := ValidateLinks([]Link{{ID: "one", Title: "Link", URL: url}}); err == nil {
			t.Errorf("accepted %q", url)
		}
	}
	links, err := ValidateLinks([]Link{{ID: "one", Title: " Recipe ", URL: " https://example.org/recipe?q=1 "}})
	if err != nil || links[0].Title != "Recipe" || links[0].URL != "https://example.org/recipe?q=1" {
		t.Fatal(links, err)
	}
	if _, err := ValidateLinks([]Link{{ID: "one", URL: "https://example.org"}, {ID: "one", URL: "https://example.org"}}); err == nil {
		t.Fatal("duplicate ids")
	}
}

func TestFinalPhotoStatus(t *testing.T) {
	for _, tc := range []struct {
		status          string
		approval, final bool
	}{
		{"todo", false, false}, {"done", false, true}, {"done", true, false},
		{"approved", true, true}, {"rejected", true, false}, {"cancelled", false, false},
	} {
		if finalPhotos(tc.status, tc.approval) != tc.final {
			t.Fatal(tc)
		}
	}
}

func TestAvatarAuthorization(t *testing.T) {
	collection := core.NewBaseCollection("family_members")
	collection.Fields.Add(&core.TextField{Name: "family"}, &core.TextField{Name: "user"}, &core.TextField{Name: "role"}, &core.BoolField{Name: "active"}, &core.JSONField{Name: "managed_by"})
	member := func(id, user, role, family string, managed []string) *core.Record {
		r := core.NewRecord(collection)
		r.Id = id
		r.Set("user", user)
		r.Set("role", role)
		r.Set("family", family)
		r.Set("active", true)
		r.Set("managed_by", managed)
		return r
	}
	parent := member("parent", "user", "parent", "family", nil)
	child := member("child", "kid", "child", "family", []string{"parent"})
	adult := member("adult", "other", "adult", "family", nil)
	if !canManageAvatar(parent, parent) || !canManageAvatar(parent, child) || canManageAvatar(parent, adult) || canManageAvatar(child, parent) {
		t.Fatal("avatar policy")
	}
	child.Set("family", "other")
	if canManageAvatar(parent, child) {
		t.Fatal("cross-family")
	}
}
