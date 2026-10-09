# Data Model

Source of truth: `TECHNICAL_SPEC.md`.

## Personal Timezone

`users.timezone` is an optional IANA zone (max 80 characters), validated on user
create/update. Empty legacy values resolve to Europe/Moscow without rewriting
records. User collection rules permit changing only the authenticated account.
Display timezone is derived from the auth session, not the active family profile.
Timed records keep their UTC instant and original series timezone; local date
ranges and presentation use the viewer's preference. All-day records retain the
civil date in the original item zone; birthdays and anniversaries remain dates.

Calendar overview projects only occurrence ID, kind, date, family and authorized
item ownership/participant fields. One dot represents one record, with multiple
participant colors in one segmented dot; `visible_to` is never ownership.

## Item Search

`items.search_text` is server-derived from title, description and location_text.
Unicode lowercasing, Russian ё/е normalization and whitespace folding are applied
on every create/update; migration backfills existing records without activity events.
The client normalizes query words and ANDs substring filters, retaining family,
archive and kind filters and all existing PocketBase visibility rules. Search is
paginated on the server; it does not download all family items to the browser.

## Collections

- `users` — PocketBase auth collection with display name, locale, timezone, onboarding flag.
- `families` — isolated family workspace.
- `family_members` — family profile linked to `users` or managed child profile.
- `items` — logical object: event, task, assignment, routine.
- `item_occurrences` — materialized calendar/status instances.
- `day_annotations` — all-day informational dates: birthdays, public holidays, special family dates, observances and memorial dates.
- `item_comments` — comments and reactions.
- `item_activity` — family feed records.
- `notifications` — in-app notifications.
- `push_subscriptions` — закрытые подписки auth user/устройства: endpoint, public/auth keys,
  secret hash, token key hash, session expiry, enabled_at и test throttling timestamp.
- `push_deliveries` — закрытые доставки, уникальные по notification/subscription;
  state, attempts, next_at, last_status. Удаляются каскадно при отзыве подписки.
- `invitations` — family invite codes.
- `chore_templates` — optional home routine templates.

## Required invariant

Every family-scoped collection has `family`. API rules and hooks must prevent cross-family access.

Push subscriptions относятся к auth user, не к переключаемому семейному профилю.
Обе push-коллекции полностью закрыты для стандартного клиентского REST CRUD.
Доступ только через Go endpoints; перед доставкой проверяется актуальное viewRule
семейного notification. `notifications.push_enqueued` служебный, клиент может
изменять только read_at. Подробная схема и ограничения: `web-push.md`.

`invitations.member` can point to a pre-created unlinked `family_members` profile. When a logged-in
adult accepts the invite, the server links that profile to the accepting `users` account instead of
creating a duplicate member.

`items` and `item_occurrences` additionally store `visible_to`, a materialized relation to
`family_members`. Hooks derive it from item visibility:

- `family` — every active family member;
- `adults` — active `owner`, `parent`, `adult` members only, never explicitly added children;
- `assignees` — creator, owner, assignees, participants and authorized managing parents;
- `private` — creator and owner only.

API rules evaluate current active membership, source item visibility and relations.
`visible_to` is a snapshot, not the security authority. Membership, role or manager
changes revoke access immediately, including occurrences, activity, comments and
previous notifications. A member header cannot impersonate another adult account.

`items.reminder_offset_minutes` stores the selected reminder offset relative to `start_at` or
`due_at`. `reminder_enabled` distinguishes none from zero. A bounded minute cron
creates `item.reminder` inbox records with database uniqueness per occurrence and
recipient. See `reminders.md` for catch-up and migration semantics.

## Calendar invariant

Non-recurring dated items create one occurrence. Undated tasks and assignments also
create an occurrence for their backlog. Repeating items are materialized into a
60-day rolling horizon and on authorized range requests (maximum 370 days).
Calendar and Today query occurrences by visible date range, excluding archived items.

Occurrences copy display/visibility snapshots; access rules still inspect the source item.
`recurrence_key` identifies the original UTC occurrence instant. A partial unique
index on `(item, recurrence_key)` prevents duplicates and keeps a moved occurrence
from being regenerated at its original date. Independent statuses belong to each occurrence.

RRULE uses vendored RRule 2.8.1 with DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY and
optional COUNT. Composer supports an inclusive last date via `recurrence_until`.
Timed weekly events optionally store `recurrence_times_json`, a weekday map such
as `{"MO":{"startTime":"09:00","endTime":"10:00"}}`. All BYDAY weekdays must
be present; extra weekdays, invalid times, non-events, all-day and non-weekly
rules are rejected. Each end must be later than its start on the same day.
Absent/empty maps preserve the existing common-time behavior. RRule generates
calendar dates and the server applies each weekday's wall-clock time before
range filtering and materialization. Series optimistic locking includes this map;
different planned durations are not mistaken for individual overrides.
Go timezone conversion preserves local wall-clock time across DST. Dates absent
from a month and nonexistent spring-forward local times are skipped. Exdates can
be stored as local YYYY-MM-DD or UTC instants; there is no exdate editor yet.

`day_annotations` are not `items` and do not create `item_occurrences`. They are rendered as an all-day informational layer. Yearly annotations are stored once with `month` and `day` and projected into the visible year at query/render time.

Manual birthday annotations can point to `family_members` or store an external person's optional `person_name`, `person_relation` and `person_contact`. Public holidays are read-only annotations synced from a verified provider and cached with source metadata.

Birthdays store the actual optional `birth_date` (calendar date, no timezone shift).
New manual birthdays require it and always repeat yearly; `year` remains the occurrence
year for one-time non-birthday dates, never a guessed birth year. Member model hooks
transactionally maintain one read-only `source=family_member` birthday per linked profile
with a DOB, syncing name/date/color and removing it on deactivation, DOB removal or deletion.
The migration backfills existing profiles, reconciles linked birthday duplicates while
retaining the first record's notes, and leaves unlinked legacy birthdays' age unknown.
Age is visible-year minus birth-year; dates before birth are omitted. February 29 appears
only in leap years. No occurrences, completion status or additional polling are added.

Non-birthday yearly annotations optionally store `origin_date`, the actual start
date (calendar date, year 1000–9999, including future dates). It determines month/day;
the visible year minus origin year supplies the anniversary label. The origin year
is labelled as the first date; earlier years are omitted. Legacy origin dates remain
unknown, never inferred from `year`. Switching to one-time or birthday clears
`origin_date`; one-time `year` is strictly the occurrence year. February 29 keeps
the same leap-year-only policy. Invalid raw origin dates are rejected before
PocketBase normalization can silently clear an existing value.

## Assignment invariant

Assignment must have at least one assignee. For a single assignee equal to creator, UI should suggest creating a personal task instead.

## Event invariant

Events require valid date order: `end_at >= start_at`.

Work/club schedules are informational events, not tasks. They cannot be marked
done or approved. The authenticated schedule endpoint can move one occurrence
without modifying the series; it writes activity and notifies eligible participants.
Changing the base recurrence via a generic item PATCH is rejected. The authenticated
`PATCH /api/familytime/items/{id}/series` endpoint replaces untouched future event
occurrences in one transaction, verifies the expected old schedule and preserves
past instances, individual overrides, non-todo statuses and instances with comments.
Their original local calendar days are retained in `recurrence_exdates_json` to
prevent duplicate materialization with the new time. JSON fields must be decoded
from `getString()` in JSVM, not tested as native arrays returned by `get()`.
The new anchor is in the future; existing history is not regenerated under the
new rule. Work and assignment recurrence editing is not exposed by this endpoint.
Archive remains reversible and does not erase history.
