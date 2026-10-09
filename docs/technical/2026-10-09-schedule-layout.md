# Schedule form layout correction

## Cause and Scope

The occurrence editor switched to one column only below 420px. Wider phones
still used two narrow date/time columns. Native iOS controls also need explicit
appearance and sizing constraints; clipping the modal's horizontal overflow
does not repair its inner layout.

- Occurrence date/time fields stack through 600px. Above that, columns fit
  the actual available form width, with a 220px minimum where space permits.
- Repeat options use the same width-aware layout. Individual weekday times
  use a 170px minimum, stacking on narrow sheets instead of squeezing labels.
- Native date/time inputs in move, series and create forms have explicit
  border-box sizing, minimum tap height and WebKit value alignment. Native
  date/time selection and existing bindings are retained.
- No API, timezone conversion, recurrence rules, permissions or schema changes.

## Verification

Browser plugin unavailable; bundled Playwright uses Chrome and WebKit.
Isolated local family data only; created audit events are archived afterward.

- Reproduction at 440px failed the narrow-sheet stacking assertion before
  the correction and passed afterward.
- Occurrence and series editors: 320/390/440/600/820/1440px, light/dark.
  Control bounds, text/control intersections, modal horizontal overflow,
  cancellation and keyboard closing checked; screenshots visually inspected.
- WebKit repeated with a 20px root font (125% of the default), including
  per-weekday times. No overlaps or out-of-form controls.
- Chrome/WebKit creation form checked at the same six widths and both themes:
  weekly repeat, individual times, control bounds and draft removal. Move-form
  time entry updates the input; cancellation does not submit a schedule change.
- `pnpm check`, `pnpm lint`: zero errors/warnings. `pnpm test`: 293 passing
  tests in 62 files. Static production build passed.

WebKit automation is not a physical iPhone or its onscreen keyboard.
