# Целевая архитектура FamilyTime

## Схема production

```txt
Browser / installed PWA
  -> HTTPS
  -> Caddy
       -> static SvelteKit build for /, /app/* and assets
       -> reverse_proxy /api/* to PocketBase
       -> /_/* blocked publicly; admin via SSH tunnel
  -> PocketBase
       -> SQLite
       -> pb_data file storage
       -> pb_hooks business rules
       -> pb_migrations schema
       -> realtime/SSE
       -> cron jobs
       -> Go Web Push sender + SQLite push_deliveries (no separate worker service)
```

## Frontend boundaries

Stage 14: установленная PWA использует Web Push, IndexedDB device gate и same-origin
API. Go backend сохраняет JS hooks и миграции, версии закреплены. HTTPS по IP:
внешний короткоживущий ACME сертификат + Caddy, инструкция в `deploy/README.md`.
Подробности безопасности, очереди и ограничений: `docs/technical/web-push.md`.

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
day_annotations
item_comments
item_activity
notifications
invitations
push_subscriptions
chore_templates
```

Today не читает `items` за все время. Рабочие виды дня/недели/месяца читают `item_occurrences` по range и при необходимости expand parent item/member/category data.

Вкладка `Календарь` является годовым навигатором: она читает `day_annotations` для выбранного года и агрегированные маркеры по дням. Особые даты, дни рождения и государственные праздники не смешиваются с `item_occurrences`.

## Realtime rule

Подписки открываются только для активного контекста:

- Today: today range + attention notifications;
- Calendar: visible range;
- Feed: active family activity;
- Notifications: текущий `recipient_member`.

При смене route, active family, active member или range соответствующая подписка закрывается и создается новая. Подписки ленты и уведомлений не пересоздаются при смене дня внутри той же семьи/профиля. Всплески событий одной подписки объединяются в один callback за 120 мс; поздно открывшиеся подписки закрываются, если их контекст уже покинут.

## Ограниченные оптимизации клиента и повторов

- Today и Calendar монтируют только один responsive shell на breakpoint 768px, а не обе скрываемые CSS версии. Composer остаётся вне shell, поэтому изменение размера окна не уничтожает введённый черновик.
- При 768–1199px workspace использует компактную левую навигацию и modal-inspector по кнопке «Сводка»; от 1200px тот же экземпляр inspector становится постоянной колонкой. Action `workspaceInspector` меняет только режим native dialog, сохраняя slot и несохранённые формы. Документ и фон блокируются общим modal-focus helper только в modal-режиме.
- Touch-preview на планшете закрепляется рядом с календарным днём и открывается через showModal; телефонная шторка определяется шириной до 768px, а не наличием touch. При mouse pointer остаётся hover-preview. Высота окна/клавиатура не меняет breakpoint; узкий Split View переключается в телефонную компоновку.
- Today хранит в памяти своего route только один загруженный диапазон occurrences, не старше 60 секунд при навигации. Это TTL чтения, без фонового polling. День и неделя используют одну неделю; смена дня переиспользует её данные. Ключ включает family/member, часовой пояс и данные участников. Смена контекста, выход с route и неудачный refresh очищают кеш. Realtime, повторная загрузка и восстановление сети обновляют серверные данные, а не читают кеш.
- При archive/visibility/owner/participants/assignees изменениях hook внутри существующей транзакции обновляет только штатный `families.updated`. Это нейтральная family-scoped инвалидация без содержимого скрытой записи, доступная по существующему ViewRule семьи. Today немедленно очищает расписание/ленту/уведомления и сводку; Calendar закрывает preview и обновляет маркеры. Activity дополнительно обновляет диапазон при переносах за его границы. Повторный PB_CONNECT, focus и visibility-only возврат в PWA восстанавливают пропущенные данные с объединением событий и cleanup.
- Модель месяца строит только выбранный месяц; события группируются по дням один раз. Лента, уведомления и особые даты не загружаются заново на каждое переключение дня.
- Кеш Intl содержит максимум 64 неизменяемых правила форматирования, без пользовательских данных. Ключ включает locale и все опции, включая IANA timezone.
- PocketBase материализует серию в существующей транзакции: читает уже созданные ключи нужного диапазона страницами по 200 вместо запроса на каждую дату. Переносы идентифицируются исходным recurrence_key; отменённые и legacy occurrences также не дублируются. Схема SQLite и правила доступа не меняются.

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
