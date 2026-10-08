# Touch, agenda and weekday-time audit

## Changes

- Composer previously used `display: contents` at desktop widths, leaving no
  scrollable body in landscape touch browsers. All sizes now use a flex child
  with its own vertical overflow and a fixed header.
- Shared native-dialog handling locks both document roots, preserves the page
  position, consumes boundary/horizontal touch gestures and supports nested
  dialogs. Only dragging the handle moves the panel.
- Desktop shells constrain their height to the viewport; center and sidebars
  own independent scroll containers.
- Day and week share compact agenda cards. No hour grid or vacant time slots;
  seven adjacent weekly columns have sticky headings and content-bounded height.
- Edit/move/series form labels and actions use natural heights and wrapping.
- Weekly timed events optionally store different start/end times per selected
  weekday. Common times remain the default. One series retains drafts, individual
  moves, optimistic concurrency and server-enforced permissions.

## Verification

- `pnpm check`, `pnpm lint`: zero errors/warnings.
- `pnpm test`: 266 tests in 58 files; `pnpm build`: static build passed.
- Isolated backend: security/visibility/assignment tests, series changes,
  recurrence regression, DST, earlier first weekday time, different durations,
  preserved moves, inclusive end, stale edit and malformed input checks passed.
- Chrome and WebKit: both themes at 320, 390, 430, 768, 820, 1024, 1180 and
  1440 px. Modal bodies scroll without page or horizontal displacement.
- Chromium touch input: form tabs/fields, top/bottom boundaries, horizontal
  gestures, short and dismissing handle drags; desktop center scrolling with
  1800 px synthetic overflow does not move either sidebar or document.
- UI flow on isolated local data: create weekday-specific event, reload,
  edit metadata, edit entire series and move one occurrence. Label bounds checked
  at 320/390/820/1180 px, including the narrow one-column move form.

Screenshots/video frames and test credentials are outside the repository.
WebKit emulation is not a physical iPhone/iPad or an onscreen iOS keyboard test.
Different weekday times currently require same-day intervals; overnight and
all-day schedules continue to use the common-time model.
