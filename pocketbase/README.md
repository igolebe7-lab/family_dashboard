# PocketBase

PocketBase backend lives here.

## Stage 14: собственная сборка

Для Web Push используется `main.go` с PocketBase 0.38.2, стандартными JS plugins
и `internal/push`. Из корня: `pnpm backend:build`, `pnpm backend:test`.
Go должен быть в PATH или указан в GO_BIN. Scripts включают GOEXPERIMENT=nojsonv2
для совместимости PocketBase с Go 1.27; обычный несовместимый build блокируется.
`./pocketbase vapid-keygen` генерирует ключи; они хранятся вне git.
Настройка: FAMILYTIME_VAPID_PUBLIC_KEY, FAMILYTIME_VAPID_PRIVATE_KEY,
FAMILYTIME_VAPID_SUBJECT (mailto с реальным контактом). Без всех трёх push отключён.
Запуск существующими командами ниже сохраняется. Старый стандартный бинарник
не имеет `/api/familytime/push/*`: для системных уведомлений нужен новый build.
Подробности: `../docs/technical/web-push.md` и `../deploy/README.md`.

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
node --check pocketbase/pb_migrations/20260610170000_day_annotations.js
node --check pocketbase/pb_hooks/items.pb.js
node --check pocketbase/pb_hooks/occurrences.pb.js
node --check pocketbase/pb_hooks/day_annotations.pb.js
node --check pocketbase/pb_hooks/_shared/day-annotations.pb.js
node scripts/verify-day-annotations-schema.mjs
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

## Backend security verification

From the repository root:

```bash
node --test scripts/smoke-cleanup.test.mjs
node scripts/smoke-backend-isolated.mjs
```

The isolated runner requires a free `127.0.0.1:8091`, creates its own temporary
database and superuser, applies the repository migrations, and stops its server
and removes only its temporary directory on exit. It disables schema
automigration so fault-injection tests cannot write migrations into the repo.
It never uses or wipes the application database on port 8090.

Coverage includes family isolation; private/adults/assignees visibility across
items, occurrences, feed, comments and notifications; inactive memberships;
managed-child actions; forged actor headers/relations/status metadata; parent
completion and approval; notification recipient protection; `expand=item`;
metadata-to-calendar title synchronization; and transaction rollback on a
notification persistence failure.

Stage4 cleanup now deletes only families/users created by that invocation and
their family-scoped descendants, including after a failed assertion. Email,
slug and title patterns are not proof of ownership and are no longer used.
`SMOKE_CLEANUP_BEFORE` has no effect; old smoke-looking records are retained.
`SMOKE_KEEP_DATA=1` still retains the current run for debugging.

## Applying access fixes to an existing local database

Stop the existing PocketBase process, preserving its data directory. Apply
`20260911090000_item_access_hardening.js` and
`20260911091000_relation_access_ids.js` with `migrate up`, then restart using the
same data directory and hooks. Example from `pocketbase/` when the existing
database is the default `pb_data`:

```bash
./pocketbase migrate up --dir=pb_data --hooksDir=pb_hooks --migrationsDir=pb_migrations
./pocketbase serve --http=127.0.0.1:8090 --dir=pb_data --hooksDir=pb_hooks --migrationsDir=pb_migrations
```

Use the actual prior `--dir` if it differs; do not initialize a replacement
database. The second migration corrects early hot-applied development rules
that compared member IDs to raw multi-relations instead of relation IDs.
Both migrations change access rules only and intentionally refuse an insecure
rollback. No record deletion/backfill is required. Read authorization is
evaluated against current item visibility and active membership, not stale
`visible_to` snapshots. Items retain immutable family, creator and kind;
metadata updates are restricted to the original creator. Occurrence creation
and deletion are server-only; clients can request permitted status transitions.

## Verified functional gaps

Исторический список раннего аудита ниже. Повторение, reschedule и reminder cron
в последующих Stage реализованы; актуальные ограничения см. `docs/technical/web-push.md`
и `docs/technical/2026-09-11-product-audit.md` из корня репозитория.

- Recurrence expansion is not implemented. Creation materializes one occurrence
  even when `recurrence_rule` is supplied. Tasks and assignments explicitly
  materialize a backlog occurrence without dates; no task should disappear
  merely because it has no deadline.
- Reminder offsets can be stored, but there is no reminder cron/delivery hook.
  Assignment creation/completion/review and event creation notifications work;
  scheduled reminders do not. Do not offer active repeat/reminder controls yet.
- Editing item date fields does not reschedule existing occurrences. The
  audited metadata path updates only title snapshots and visibility snapshots.
- Actual metadata edits (title, description, location) emit `item.updated` and
  event participant notifications without duplicates on unchanged requests.
  Rescheduling and comment creation do not yet emit all required feed events.
- This audit covers item-related access. Family onboarding/invitation policies,
  special-date visibility, protected attachment delivery and complete role
  management need their own audits before a broader security claim.
