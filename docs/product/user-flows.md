# Product User Flows

## Assignment flow

```txt
parent creates assignment for child
child sees assignment
child marks done
parent receives notification
parent approves
assignment becomes approved
activity feed receives records
```

Manual acceptance:

- Parent can create assignment only with assignee.
- Child sees simplified labels: `Надо сделать`, `Я сделал`, `Ждёт проверки`, `Готово`.
- If approval is required, child completion creates parent notification.
- Approval changes occurrence status and writes activity feed record.

## Event flow

```txt
member creates event with participants
participants see event in Today and Calendar
activity feed records creation
notification is created for participants
```

Manual acceptance:

- `end_at < start_at` is rejected on client and server.
- Empty participants default to creator.
- Calendar loads event through `item_occurrences` range query.

## Special date flow

```txt
adult opens Calendar year overview
adult creates a special date or external birthday
date is saved as a yearly or one-time day annotation
Calendar shows the marker in every matching year
Today shows it as all-day information for the selected day/week/month
adult can edit or delete the annotation later
```

Manual acceptance:

- External birthday can be created with name and date only.
- Relation/status, contact/phone and note are optional.
- Yearly special dates are stored once and appear in future years.
- Special dates do not appear as tasks, assignments or timed events.
- Public holidays are read-only and come from cached provider sync.

## Visibility flow

```txt
private item is not visible to unrelated family member
adults item is not visible to child
family item is visible to active family members
assignees item is visible to assignee and creator
```

Manual acceptance:

- Family isolation is enforced by PocketBase rules and hooks.
- Client filters are convenience only, not security boundary.
