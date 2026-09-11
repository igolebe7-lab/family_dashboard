# Vendored runtime dependency

`rrule.cjs` is the unmodified UMD `dist/es5/rrule.min.js` distribution of
`rrule@2.8.1`, except its source-map reference is removed because PocketBase's
Goja loader treats a missing source map as a syntax error. License: BSD-3-Clause,
see `rrule.LICENCE`. Upstream: https://github.com/jkbrzt/rrule.

This backend-only file uses the same version already installed by the frontend.
It adds no Node runtime or dependency to the production server. Recurrence dates
are calculated by RRule in floating UTC form; PocketBase `DateTime` resolves each
wall-clock time in the item's IANA timezone.
