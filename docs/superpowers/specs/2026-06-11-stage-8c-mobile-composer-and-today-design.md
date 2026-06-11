# Stage 8C Mobile Composer And Today Design

## Context

Manual testing on iPhone 16 Pro Max Safari found several blocking issues: Safari zooms input fields,
the composer can pan horizontally, Today cards overlap, all-day records are shown as `00:00`,
calendar starts at January, and task/assignment creation feels duplicated.

## Decisions

### Mobile Safari Layout

- Every form input/select/textarea uses at least `16px` font size on mobile to prevent Safari auto-zoom.
- Modal content scrolls vertically only. Horizontal panning is disabled at the sheet, form grid and field level.
- Mobile composer uses one column. Desktop may keep the denser two-column layout.
- Composer actions stay usable at the bottom of the sheet with a sticky footer.
- After a successful create, the composer closes and the parent view refreshes.

### Unified Task Flow

- Quick actions become `+ Задача` and `+ Событие`.
- Composer tabs become `Событие` and `Задача`.
- Internally `Задача` still maps to `task` or `assignment`:
  - selected owner is the active member -> `task`;
  - selected owner is another member -> `assignment`;
  - assignment-specific options such as approval and points remain visible in the task form when another member is selected.
- This keeps the backend model explicit while removing the product-level confusion between "дело" and "поручение".

### Today Timeline

- All-day occurrences are not displayed as `00:00`.
- All-day occurrences are displayed in a dedicated "Весь день" strip above the timed timeline.
- The timeline is a stable vertical list; cards do not overlap even when several records have the same time.
- Event subtitle reflects family scope. If all active members participate, show `Вся семья` instead of an arbitrary member.
- Timeline cards are tap targets and open a read-only detail sheet with title, type, owner/participants, time, and description.

### Calendar

- Calendar opens around the current date, not January.
- Mobile calendar header and year controls stay fixed while the month grid scrolls.
- Month/day cells should indicate that timed records exist on that date. The first implementation may use lightweight markers loaded for the visible year.

### Special Dates

- Birthday title is derived from selected member or external person name.
- Manual `title` is not required for birthday creation.
- Draft persistence is kept simple: composer draft can survive accidental Safari backgrounding through session storage.

## Scope For Stage 8C

Implement mobile-blocking issues and the unified task flow first. Detail sheets and calendar record markers can be lightweight, read-only implementations. Full editing, assignment workflow status transitions, and child mode remain Stage 9+.

