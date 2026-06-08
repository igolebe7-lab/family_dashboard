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
