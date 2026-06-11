# Data Model

Source of truth: `TECHNICAL_SPEC.md`.

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
- `push_subscriptions` — post-MVP push architecture.
- `invitations` — family invite codes.
- `chore_templates` — optional home routine templates.

## Required invariant

Every family-scoped collection has `family`. API rules and hooks must prevent cross-family access.

`items` and `item_occurrences` additionally store `visible_to`, a materialized relation to
`family_members`. Hooks derive it from item visibility:

- `family` — every active family member;
- `adults` — active `owner`, `parent`, `adult` members plus explicitly involved members;
- `assignees` — creator, owner, assignees and participants;
- `private` — creator and owner only.

API rules for item reads use `visible_to.user ?= @request.auth.id`, so child accounts do not
receive adult/private records through client-side filters.

`items.reminder_offset_minutes` stores the selected reminder offset relative to `start_at` or
`due_at`. Stage 8 persists the value from the composer; notification delivery rules consume it in
later realtime/notification stages.

## Calendar invariant

Every dated `items` record creates at least one `item_occurrences` record. Calendar and Today query occurrences by visible date range instead of loading all items.

Occurrences copy `visible_to` from their source item so calendar queries can enforce the same visibility rule without loading all logical items.

`day_annotations` are not `items` and do not create `item_occurrences`. They are rendered as an all-day informational layer. Yearly annotations are stored once with `month` and `day` and projected into the visible year at query/render time.

Manual birthday annotations can point to `family_members` or store an external person's optional `person_name`, `person_relation` and `person_contact`. Public holidays are read-only annotations synced from a verified provider and cached with source metadata.

## Assignment invariant

Assignment must have at least one assignee. For a single assignee equal to creator, UI should suggest creating a personal task instead.

## Event invariant

Events require valid date order: `end_at >= start_at`.
