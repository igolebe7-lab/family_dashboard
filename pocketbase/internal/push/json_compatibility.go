//go:build goexperiment.jsonv2

package push

// PocketBase 0.38.2 Collection.UnmarshalJSON recurses with Go 1.27 JSON v2.
// Fail at build time instead of crashing while applying production migrations.
var _ = buildWithGOEXPERIMENT_nojsonv2
