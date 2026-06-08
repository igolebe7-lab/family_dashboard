# PocketBase

PocketBase backend lives here.

The local smoke target is PocketBase `v0.38.2` (`darwin_arm64` on the current
development machine). Keep the binary local only.

Expected local run after installing the PocketBase binary manually:

```bash
cd pocketbase
./pocketbase serve --http=127.0.0.1:8090
```

Do not commit the PocketBase binary, `pb_data`, or `pb_logs`.

## Structure

```txt
pb_hooks/
pb_migrations/
pb_public/
```

## Local verification

Syntax-only check from repo root:

```bash
node --check pocketbase/pb_migrations/20260608230000_init_collections.js
node --check pocketbase/pb_hooks/items.pb.js
node --check pocketbase/pb_hooks/occurrences.pb.js
```

Full verification requires a local PocketBase binary:

```bash
cd pocketbase
./pocketbase migrate up
./pocketbase serve --http=127.0.0.1:8090
```

In another terminal from the repository root:

```bash
node scripts/smoke-pocketbase-stage4.mjs
```

The smoke script creates disposable local records in ignored `pb_data` and checks:

- event validation and occurrence materialization;
- assignment assignee validation;
- assignment notification creation;
- child visibility restrictions for `adults` and `private` items.
