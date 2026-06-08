# FamilyTime Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить приватную семейную PWA FamilyTime с календарём, делами, поручениями, детским режимом, семейной лентой, in-app уведомлениями и лёгким PocketBase backend под ограниченный VPS.

**Architecture:** Static SvelteKit SPA/PWA отдаётся Caddy без Node SSR runtime. PocketBase остаётся единственным backend-процессом: SQLite, auth, file storage, realtime, `pb_hooks`, cron jobs и conservative API rules. Календарь строится вокруг материализованных `item_occurrences`, чтобы экраны Today/Calendar загружали только видимые date ranges.

**Tech Stack:** SvelteKit, TypeScript, Tailwind CSS, `@lucide/svelte`, PocketBase JS SDK, zod, date-fns, rrule, targeted GSAP, PocketBase + SQLite + JS hooks, Caddy, systemd, pnpm.

---

## Контрольные принципы

- Сначала mobile, затем desktop adaptation.
- Сначала local manual testing, затем staging-like проверка на сервере.
- Каждый этап заканчивается `pnpm check`, `pnpm test`, `pnpm build`, если команды уже существуют.
- Backend-этапы дополнительно проверяют family isolation, visibility и child/adult access.
- UI-этапы сравниваются с `docs/references/ui/*` и проверяются на mobile/desktop viewport.
- Новые зависимости добавляются только после проверки веса, необходимости и Svelte-friendly альтернатив.
- Git-коммиты делать после каждого тестируемого этапа.

## Stage 0: Git и проектная основа

**Цель:** сделать репозиторий управляемым и подготовить документацию для реализации.

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `docs/technical/project-analysis.md`
- Create: `docs/technical/architecture.md`
- Create: `docs/superpowers/plans/2026-06-08-familytime-development-plan.md`
- Move/normalize: `AGENTS.md`
- Copy: `docs/references/ui/image-1-mobile-today.png`
- Copy: `docs/references/ui/image-2-mobile-calendar-week.png`
- Copy: `docs/references/ui/image-3-desktop-week-dashboard.png`

- [x] Инициализировать git.
- [x] Добавить remote `origin https://github.com/igolebe7-lab/family_dashboard.git`.
- [x] Исключить `.serena/`, `.DS_Store`, build outputs, env files, `node_modules`, `pb_data`, PocketBase binary.
- [x] Сохранить анализ текущих файлов и целевую архитектуру.
- [x] Сделать initial planning commit.

**Manual test gate:**

- Проверить `git status --short --branch`.
- Проверить `git remote -v`.
- Открыть `README.md`, `docs/technical/project-analysis.md`, `docs/technical/architecture.md`, этот plan.

## Stage 1: Monorepo и SvelteKit static PWA shell

**Цель:** получить минимально запускаемый frontend без backend-зависимости.

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/web/package.json`
- Create: `apps/web/svelte.config.js`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/routes/+layout.ts`
- Create: `apps/web/src/routes/+layout.svelte`
- Create: `apps/web/src/routes/+page.svelte`
- Create: `apps/web/src/app.css`
- Create: `apps/web/static/manifest.webmanifest`
- Create: `apps/web/src/service-worker.ts` or selected SvelteKit-compatible PWA plugin config

- [x] Scaffold SvelteKit app in `apps/web` with TypeScript.
- [x] Configure root workspace scripts: `dev`, `check`, `lint`, `test`, `build`.
- [x] Configure `@sveltejs/adapter-static` with SPA fallback `200.html`.
- [x] Disable SSR at root layout with `export const ssr = false`.
- [x] Add warm background, base typography and initial app shell.
- [x] Add PWA manifest with Russian description and `start_url: /app/today`.

**Automated checks:**

- `pnpm install`
- `pnpm check`
- `pnpm build`

**Manual local test gate:**

- Run `pnpm dev`.
- Open mobile viewport and direct URL `/app/today`; refresh must not 404 in dev.
- Build preview/static check: direct route fallback must work through local static preview.
- Verify app opens without PocketBase running and shows a friendly shell/loading state.

## Stage 2: Design tokens, UI primitives, app shell

**Цель:** заложить визуальную систему до бизнес-логики.

**Files:**
- Create: `apps/web/src/lib/design/tokens.css`
- Create: `apps/web/src/lib/design/icon-registry.ts`
- Create: `apps/web/src/lib/constants/colors.ts`
- Create: `apps/web/src/lib/constants/categories.ts`
- Create: `apps/web/src/lib/constants/routes.ts`
- Create: `apps/web/src/lib/components/ui/Button.svelte`
- Create: `apps/web/src/lib/components/ui/Card.svelte`
- Create: `apps/web/src/lib/components/ui/Chip.svelte`
- Create: `apps/web/src/lib/components/ui/SegmentedControl.svelte`
- Create: `apps/web/src/lib/components/app/MobileShell.svelte`
- Create: `apps/web/src/lib/components/app/DesktopShell.svelte`
- Create: `apps/web/src/lib/components/app/BottomNav.svelte`
- Create: `apps/web/src/lib/components/app/Sidebar.svelte`
- Create: `apps/web/src/lib/components/app/FloatingCreateButton.svelte`

- [x] Перенести CSS variables из `TECHNICAL_SPEC.md` в `tokens.css`.
- [x] Настроить Tailwind на CSS variables, не плодить случайные hex в компонентах.
- [x] Сделать responsive shell: mobile bottom nav, desktop sidebar + central + right slot.
- [x] Добавить focus-visible states, aria-label для icon buttons, крупные tap targets.
- [x] Импортировать из Lucide только используемые иконки.

**Automated checks:**

- `pnpm check`
- `pnpm build`

**Manual local test gate:**

- Viewport 390x844: bottom nav не перекрывает контент, tap targets не меньше 44px.
- Viewport 1440x900: left sidebar и right sidebar не выглядят как admin UI.
- Keyboard tab order проходит top actions, nav, content, FAB.

## Stage 3: Domain types, constants, validation skeleton

**Цель:** типизировать предметную область до API и UI-сценариев.

**Files:**
- Create: `apps/web/src/lib/types/domain.ts`
- Create: `apps/web/src/lib/types/pocketbase.ts`
- Create: `apps/web/src/lib/constants/collections.ts`
- Create: `apps/web/src/lib/constants/roles.ts`
- Create: `apps/web/src/lib/utils/permissions.ts`
- Create: `apps/web/src/lib/utils/date.ts`
- Create: `apps/web/src/lib/utils/validation.ts`

- [x] Описать roles: `owner`, `parent`, `adult`, `teen`, `child`, `guest`.
- [x] Описать item kinds, statuses, visibility, categories, priorities, notification types.
- [x] Описать `Family`, `FamilyMember`, `Item`, `ItemOccurrence`, `Notification`, `ActivityRecord`.
- [x] Добавить zod schemas для composer MVP forms.
- [x] Добавить pure permission helpers, совпадающие с будущими server hooks.

**Automated checks:**

- `pnpm check`
- unit tests for `permissions.ts`, `date.ts`, `validation.ts`

**Manual local test gate:**

- Нет UI-изменений; проверить только, что shell не сломан после типов.

## Stage 4: PocketBase schema, rules, hooks foundation

**Цель:** создать безопасный backend skeleton с family isolation.

**Files:**
- Create: `pocketbase/README.md`
- Create: `pocketbase/pb_migrations/*_init_collections.js`
- Create: `pocketbase/pb_hooks/_shared/auth.pb.js`
- Create: `pocketbase/pb_hooks/_shared/permissions.pb.js`
- Create: `pocketbase/pb_hooks/_shared/validation.pb.js`
- Create: `pocketbase/pb_hooks/items.pb.js`
- Create: `pocketbase/pb_hooks/occurrences.pb.js`
- Create: `docs/technical/data-model.md`

- [ ] Создать collections из ТЗ: `families`, `family_members`, `items`, `item_occurrences`, `item_comments`, `item_activity`, `notifications`, `invitations`.
- [ ] Добавить conservative API rules: пользователь видит только семьи, где он member.
- [ ] Добавить hook validation для `items.kind = event`: title, start/end, `end_at >= start_at`, participants default.
- [ ] Добавить hook validation для `assignment`: минимум один assignee, assignee не равен единственному author, child assignment permission.
- [ ] Добавить hook materialization: каждый dated item создаёт минимум один `item_occurrences`.
- [ ] Добавить activity records и notification creation в hooks.

**Automated checks:**

- PocketBase starts locally.
- Hook smoke tests or scripted API checks against local PocketBase.

**Manual local test gate:**

- В PocketBase admin создать тестовую семью и members.
- Проверить, что ребёнок не видит `adults/private`.
- Проверить, что event с `end_at < start_at` отклоняется.
- Проверить, что assignment без assignee отклоняется.
- Проверить, что occurrence создаётся при event/task/assignment.

## Stage 5: Frontend API layer and session state

**Цель:** отделить UI от PocketBase SDK и подготовить auth/onboarding.

**Files:**
- Create: `apps/web/src/lib/api/pocketbase.ts`
- Create: `apps/web/src/lib/api/auth.api.ts`
- Create: `apps/web/src/lib/api/families.api.ts`
- Create: `apps/web/src/lib/api/members.api.ts`
- Create: `apps/web/src/lib/api/items.api.ts`
- Create: `apps/web/src/lib/api/occurrences.api.ts`
- Create: `apps/web/src/lib/api/notifications.api.ts`
- Create: `apps/web/src/lib/api/activity.api.ts`
- Create: `apps/web/src/lib/stores/session.store.ts`
- Create: `apps/web/src/lib/stores/family.store.ts`

- [ ] Configure PocketBase base URL via env.
- [ ] Wrap auth login/register/logout/token refresh in `auth.api.ts`.
- [ ] Implement active family/member state.
- [ ] Implement loading/error states for all API calls.
- [ ] Ensure API functions always require active family/member where needed.

**Automated checks:**

- `pnpm check`
- API wrapper unit tests with mocked PocketBase client

**Manual local test gate:**

- Register adult user locally.
- Create family and members.
- Refresh browser: session and active family restore correctly.
- Logout clears state and protected shell redirects to login.

## Stage 6: Today screen MVP

**Цель:** первый полезный экран, соответствующий mobile Today reference.

**Files:**
- Create: `apps/web/src/routes/(app)/today/+page.svelte`
- Create: `apps/web/src/lib/components/family/MemberAvatar.svelte`
- Create: `apps/web/src/lib/components/family/MemberAvatarRow.svelte`
- Create: `apps/web/src/lib/components/today/TodayHeader.svelte`
- Create: `apps/web/src/lib/components/today/TodayTimeline.svelte`
- Create: `apps/web/src/lib/components/today/AttentionPanel.svelte`
- Create: `apps/web/src/lib/components/today/QuickActions.svelte`
- Create: `apps/web/src/lib/components/today/TodayEmptyState.svelte`

- [ ] Load today occurrences by local family timezone day range.
- [ ] Load attention items: done waiting approval, overdue/open assignments, prep reminders.
- [ ] Show family avatar row with member colors.
- [ ] Show timeline cards with category icon, time, title, member label/avatar.
- [ ] Provide quick actions for `+ Дело`, `+ Поручение`, `+ Событие`.
- [ ] Add empty states for no events/tasks/attention.

**Automated checks:**

- `pnpm check`
- component tests for empty/loading/error states

**Manual local test gate:**

- 390x844 viewport visually compare to `image-1-mobile-today.png`.
- Create test events in PocketBase; Today shows only today range.
- Attention card appears for assignment waiting approval.
- Keyboard and screen-reader labels are present for notification bell and quick actions.

## Stage 7: Calendar MVP

**Цель:** agenda/day/week/month с range-based loading.

**Files:**
- Create: `apps/web/src/routes/(app)/calendar/+page.svelte`
- Create: `apps/web/src/lib/stores/calendar.store.ts`
- Create: `apps/web/src/lib/components/calendar/CalendarViewport.svelte`
- Create: `apps/web/src/lib/components/calendar/CalendarHeader.svelte`
- Create: `apps/web/src/lib/components/calendar/CalendarViewSwitcher.svelte`
- Create: `apps/web/src/lib/components/calendar/WeekStrip.svelte`
- Create: `apps/web/src/lib/components/calendar/DayTimeline.svelte`
- Create: `apps/web/src/lib/components/calendar/WeekGrid.svelte`
- Create: `apps/web/src/lib/components/calendar/MonthGrid.svelte`
- Create: `apps/web/src/lib/components/calendar/AgendaList.svelte`
- Create: `apps/web/src/lib/components/calendar/CalendarFilters.svelte`
- Create: `apps/web/src/lib/components/calendar/OccurrenceCard.svelte`

- [ ] Implement visible range calculation per view.
- [ ] Fetch `item_occurrences` only for visible range.
- [ ] Add category/member filters.
- [ ] Implement mobile day/week timeline.
- [ ] Implement desktop week grid.
- [ ] Keep year view route/state reserved but not implemented in MVP.

**Automated checks:**

- unit tests for range calculation and filters
- `pnpm check`
- `pnpm build`

**Manual local test gate:**

- 390x844 viewport compare to `image-2-mobile-calendar-week.png`.
- 1440x900 viewport compare to `image-3-desktop-week-dashboard.png`.
- Navigate previous/next week: API requests change range, not all-year loading.
- Direct refresh `/app/calendar` works after static build fallback.

## Stage 8: Composer for event, task, assignment

**Цель:** одна точка создания с корректной валидацией и мобильным bottom sheet.

**Files:**
- Create: `apps/web/src/lib/components/composer/ComposerSheet.svelte`
- Create: `apps/web/src/lib/components/composer/ComposerTabs.svelte`
- Create: `apps/web/src/lib/components/composer/EventForm.svelte`
- Create: `apps/web/src/lib/components/composer/TaskForm.svelte`
- Create: `apps/web/src/lib/components/composer/AssignmentForm.svelte`
- Create: `apps/web/src/lib/components/composer/ReminderPicker.svelte`
- Create: `apps/web/src/lib/components/composer/RepeatRuleEditor.svelte`

- [ ] Mobile: bottom sheet; desktop: modal or side panel.
- [ ] Event form includes title, category, participants, start/end, all-day, reminder, location, visibility, description.
- [ ] Task form includes title, owner, due date/time, priority, category, checklist, visibility, reminder, description.
- [ ] Assignment form includes title, assignee, due date/time, approval required, repeat, points, category, description, reminder.
- [ ] Add loading/error/success states.
- [ ] Use GSAP only for sheet open/close if CSS is insufficient; dynamic import and cleanup required.

**Automated checks:**

- form validation tests
- `pnpm check`
- `pnpm build`

**Manual local test gate:**

- Create event, task, assignment from mobile quick actions.
- Assignment without assignee is blocked before submit and by server.
- Event with invalid date order is blocked before submit and by server.
- After create, Today/Calendar update without full page reload.

## Stage 9: Assignment workflow and child mode

**Цель:** закрыть ключевой семейный сценарий поручений.

**Files:**
- Create: `apps/web/src/routes/(app)/assignments/+page.svelte`
- Create: `apps/web/src/routes/(child)/child/+page.svelte`
- Create: `apps/web/src/lib/components/items/AssignmentCard.svelte`
- Create: `apps/web/src/lib/components/items/StatusBadge.svelte`
- Modify: `pocketbase/pb_hooks/occurrences.pb.js`
- Modify: `pocketbase/pb_hooks/items.pb.js`

- [ ] Implement assignment status transitions from ТЗ.
- [ ] Parent creates assignment for child.
- [ ] Child sees simplified dashboard and statuses.
- [ ] Child action `Я сделал` transitions to `done`.
- [ ] Parent receives notification and approves/rejects.
- [ ] Approval updates occurrence and activity feed.

**Automated checks:**

- permission/status transition tests
- `pnpm check`
- `pnpm build`

**Manual local test gate:**

- Execute full Assignment flow from ТЗ.
- Confirm child cannot delete assignment.
- Confirm child cannot see adult/private objects.

## Stage 10: Activity feed, notifications, realtime lifecycle

**Цель:** сделать интерфейс живым без polling и без утечек подписок.

**Files:**
- Create: `apps/web/src/routes/(app)/feed/+page.svelte`
- Create: `apps/web/src/routes/(app)/notifications/+page.svelte`
- Create: `apps/web/src/lib/components/feed/ActivityFeed.svelte`
- Create: `apps/web/src/lib/components/feed/ActivityFeedItem.svelte`
- Create: `apps/web/src/lib/components/notifications/NotificationBell.svelte`
- Create: `apps/web/src/lib/components/notifications/NotificationInbox.svelte`
- Create: `apps/web/src/lib/stores/realtime.store.ts`
- Create: `apps/web/src/lib/stores/notifications.store.ts`

- [ ] Subscribe to notifications for current recipient member.
- [ ] Subscribe to `item_activity` for active family.
- [ ] Subscribe to `item_occurrences` only for Today/Calendar visible range.
- [ ] Unsubscribe on route/range/family/member changes.
- [ ] Add badge and mark-all-read.

**Automated checks:**

- realtime store lifecycle unit tests with mocked subscribe/unsubscribe
- `pnpm check`
- `pnpm build`

**Manual local test gate:**

- Two browser sessions: create assignment in one, see notification/feed update in another.
- Navigate away from Calendar: occurrence subscription closes.
- Change active family/member: old subscriptions close.

## Stage 11: PWA offline shell and install readiness

**Цель:** приложение устанавливается и открывает shell без сети.

**Files:**
- Modify: `apps/web/static/manifest.webmanifest`
- Modify: `apps/web/src/service-worker.ts`
- Add: `apps/web/static/icons/icon-192.png`
- Add: `apps/web/static/icons/icon-512.png`

- [ ] Cache app shell and static assets.
- [ ] Show offline shell/state when API unavailable.
- [ ] Keep offline drafts post-MVP, but do not block architecture.
- [ ] Validate manifest icons, theme color, display mode.

**Automated checks:**

- `pnpm build`
- Lighthouse/PWA smoke check locally if available

**Manual local test gate:**

- Install app locally from browser.
- Disable network: app opens to cached shell.
- API-dependent panels show calm offline/loading state, not broken errors.

## Stage 12: Production deployment package

**Цель:** подготовить серверный запуск на Debian VPS.

**Files:**
- Create: `deploy/Caddyfile`
- Create: `deploy/family-pocketbase.service`
- Create: `deploy/backup.sh`
- Create: `deploy/restore.md`
- Update: `README.md`
- Create: `.env.example`

- [ ] Build static frontend.
- [ ] Configure Caddy static root and SPA fallback.
- [ ] Reverse proxy `/api/*` and protected `/_/*` to PocketBase.
- [ ] Configure systemd service for PocketBase.
- [ ] Configure backup and restore notes for `pb_data`.
- [ ] Document deployment commands.

**Automated checks:**

- `pnpm build`
- Caddy config validation on server
- PocketBase service starts on server

**Manual server test gate:**

- Open production domain over HTTPS.
- Direct refresh `/app/today`, `/app/calendar`, `/app/notifications`.
- Register/login test adult user.
- Create family, event, assignment.
- Confirm realtime update between two browser sessions.
- Confirm backup script creates restorable archive.

## Stage 13: MVP hardening

**Цель:** закрыть риски перед регулярным семейным использованием.

**Files:**
- Update tests and docs across touched modules.

- [ ] Add regression tests for visibility:
  - private visible only to author/owner;
  - adults hidden from child;
  - family visible to active members;
  - assignees visible to assignees, participants, author, managed-child parents.
- [ ] Add regression tests for assignment flow.
- [ ] Add regression tests for event creation and notification recipients.
- [ ] Audit bundle size and lazy-load heavy routes.
- [ ] Audit accessibility and reduced motion.
- [ ] Run full local and server manual checklist.

**Release gate:**

- `pnpm check` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- Manual mobile Today passed.
- Manual mobile Calendar passed.
- Manual desktop workspace passed.
- Manual backend family isolation passed.
- Manual server smoke test passed.

## Подход к коммитам

Рекомендуемый порядок:

```txt
chore: initialize repository planning docs
chore: scaffold sveltekit workspace
feat: add design tokens and app shell
feat: add domain types and validation helpers
feat: add pocketbase schema and hooks foundation
feat: add auth and family session
feat: add today dashboard
feat: add calendar views
feat: add composer flows
feat: add assignment workflow and child mode
feat: add realtime feed and notifications
feat: add pwa offline shell
chore: add deployment package
test: harden mvp flows
```
