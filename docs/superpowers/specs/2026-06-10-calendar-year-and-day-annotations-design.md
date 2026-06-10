# Calendar Year Navigator and Day Annotations Design

Date: 2026-06-10

## Decision

FamilyTime separates two calendar concepts:

- `Сегодня` is the working calendar surface for day, week and month planning.
- `Календарь` is the large-scale year navigator and informational day layer.

The `Календарь` tab must not duplicate the operational Today workspace. It shows the year, months, days, week numbers, weekends, public holidays, birthdays and special dates. Selecting a day or month can navigate into `Сегодня` with the matching date and view.

## Calendar Tab

The primary Calendar screen is a year overview:

- year header with previous/next year and `Сегодня`;
- 12 month cards;
- compact day cells;
- week numbers;
- soft weekend and public holiday highlighting;
- markers for birthdays and family special dates;
- day detail sheet with grouped annotations;
- link/action to open the selected date in `Сегодня`.

The year view is a navigation and context surface, not a task list. It does not show assignment status, task checkboxes or time-slot event cards.

## Today Tab

The Today tab owns operational calendar work:

- `День / Неделя / Месяц` views;
- time-grid events and dated tasks;
- assignments and attention items;
- creation actions;
- all-day information strip for selected day annotations.

Day annotations appear above timed events as information about the day. They must not be mixed into the task/assignment workflow.

## Day Annotation Layer

Introduce a separate `day_annotations` domain layer. It is not an `item` and does not create `item_occurrences`.

Kinds:

- `birthday` — family member or external person birthday;
- `public_holiday` — synced official holiday or public day;
- `family_date` — anniversary, important family date, yearly or one-time;
- `observance` — informational day note;
- `memorial` — delicate muted remembrance date.

Recurrence:

- `yearly` for birthdays and most special dates;
- `one_time` for one-off day notes;
- future extension: date ranges for holidays/vacations.

Yearly annotations are stored once and rendered into each visible year. The app must not generate endless occurrence records.

## Birthdays

Birthdays have two creation modes.

Family member birthday:

- selected from existing `family_members`;
- date is edited through the member profile or a profile-backed editor;
- uses member color and avatar/initial;
- source is `family_member`.

External person birthday:

- manual person name;
- optional relation/status, such as `друг`, `коллега`, `бабушка`, `тренер`;
- optional phone/contact for future greeting reminders;
- optional note;
- date;
- color;
- yearly recurrence by default;
- source is `manual`.

If birth year is known, the UI may show age. If birth year is missing, the birthday still repeats annually.

## Suggested Fields

```txt
day_annotations
  id
  family
  kind
  title
  description
  month
  day
  year?
  recurrence
  color
  tone
  visibility
  source
  readonly
  linked_member?
  person_name?
  person_relation?
  person_contact?
  country_code?
  region_code?
  source_uid?
  source_hash?
  fetched_at?
  created_by
  created
  updated
```

Color controls visuals. Tone controls behavior and microcopy:

- `positive`;
- `neutral`;
- `important`;
- `memorial`;
- `system`.

For MVP, color is required for manual annotations. Tone can default from kind and remain editable later.

## Public Holidays

Public holidays are synced read-only annotations.

Recommended MVP provider: Nager.Date public holiday API, because it exposes a simple JSON endpoint by year and country and includes holiday date, local name, country code, national/global flag and types.

Sync rules:

- family stores `holiday_country` and optional `holiday_region`;
- backend weekly sync fetches current and next year;
- changing country/region triggers a refresh;
- sync stores source metadata and fetched timestamp;
- if the provider is unavailable, the UI uses cached data and does not block the app.

No constant polling. No heavy background worker.

## Rendering Rules

Year Calendar:

- weekend: soft background;
- public holiday: system background or small marker;
- family member birthday: avatar/initial marker;
- external birthday: initial marker in chosen color;
- special date: colored dot or small bar;
- memorial date: muted marker, no celebratory styling;
- overflow: show up to 2-3 markers, then `+N`.

Today Day:

- `Информация о дне` strip above timed agenda;
- all-day chips/cards for birthdays, holidays and special dates;
- no checkboxes, assignees or completion states.

Today Week:

- markers in day headers;
- selected day expands annotations.

Today Month:

- day cell markers;
- selected day detail groups annotations before timed items.

## Implementation Direction

Stage 7 should be redirected:

1. document the new screen roles;
2. keep Today as the operational day/week/month calendar;
3. redesign Calendar as year/global navigator;
4. add `day_annotations` model and local rendering from yearly rules;
5. add manual special date and external birthday data shape;
6. add weekly public holiday sync;
7. connect Calendar day/month selection to Today.

The previous plan item for a separate mobile day/week timeline inside `Календарь` is superseded.
