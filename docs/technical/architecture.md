# Целевая архитектура FamilyTime

## Схема production

```txt
Browser / installed PWA
  -> HTTPS
  -> Caddy
       -> static SvelteKit build for /, /app/* and assets
       -> reverse_proxy /api/* to PocketBase
       -> reverse_proxy /_/* to PocketBase admin UI with extra protection
  -> PocketBase
       -> SQLite
       -> pb_data file storage
       -> pb_hooks business rules
       -> pb_migrations schema
       -> realtime/SSE
       -> cron jobs
```

## Frontend boundaries

Целевой frontend — static SvelteKit SPA/PWA. По актуальной документации SvelteKit для SPA direct-route fallback нужен `@sveltejs/adapter-static` с `fallback: '200.html'`, а SSR отключается на root layout через `export const ssr = false`.

Рекомендуемая структура:

```txt
apps/web/
  src/
    lib/
      api/           # PocketBase wrappers
      components/    # small Svelte components
      constants/     # collection names, roles, categories, routes
      design/        # tokens.css, icon registry
      stores/        # session, family, calendar, realtime
      types/         # domain and PocketBase types
      utils/         # date, recurrence, permissions, validation
    routes/
    service-worker.ts
  static/
    icons/
    manifest.webmanifest
```

## Backend boundaries

PocketBase отвечает за auth, storage, realtime, SQLite schema, API rules и server-side validation. Вся критичная логика прав живет в `pb_hooks`, а не только в клиенте.

Рекомендуемая структура:

```txt
pocketbase/
  pb_hooks/
    _shared/
      auth.pb.js
      permissions.pb.js
      validation.pb.js
      activity.pb.js
      notifications.pb.js
      recurrence.pb.js
    items.pb.js
    occurrences.pb.js
    reminders.pb.js
  pb_migrations/
  pb_public/
  README.md
```

По актуальной документации PocketBase JSVM hooks регистрируются в `.pb.js` файлах из `pb_hooks`; record request hooks используются для create/update validation, а cron jobs регистрируются через `cronAdd(...)` внутри `pb_hooks`.

## Data model rule

Все семейные данные должны быть family-scoped:

```txt
families
family_members
items
item_occurrences
item_comments
item_activity
notifications
invitations
push_subscriptions
chore_templates
```

Календарь и Today не читают `items` за все время. Они читают `item_occurrences` по range и при необходимости expand parent item/member/category data.

## Realtime rule

Подписки открываются только для активного контекста:

- Today: today range + attention notifications;
- Calendar: visible range;
- Feed: active family activity;
- Notifications: текущий `recipient_member`.

При смене route, active family, active member или range подписка закрывается и создается новая.

## Deployment

Caddy должен сначала отдавать PocketBase API/admin routes через reverse proxy, а потом применять static fallback. По документации Caddy для такой схемы подходит `route`/`handle`, чтобы `reverse_proxy` не был перехвачен `try_files`.

Целевые deployment-файлы:

```txt
deploy/
  Caddyfile
  family-pocketbase.service
  backup.sh
  restore.md
```

Production artifacts:

- `apps/web/build` копируется в `/var/www/familytime`;
- PocketBase работает как systemd service;
- `pb_data` регулярно архивируется;
- бинарник PocketBase не хранится в git.
