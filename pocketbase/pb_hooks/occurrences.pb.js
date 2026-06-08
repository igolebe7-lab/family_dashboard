onRecordUpdateRequest((event) => {
  const allowedTransitions = {
    assigned: ['accepted', 'in_progress', 'done', 'skipped', 'cancelled'],
    accepted: ['in_progress', 'done', 'skipped', 'cancelled'],
    in_progress: ['done', 'skipped', 'cancelled'],
    done: ['approved', 'rejected'],
    rejected: ['in_progress', 'done']
  };

  const existing = event.record.original();
  const previousStatus = existing.get('status');
  const nextStatus = event.record.get('status');
  const canTransition =
    previousStatus === nextStatus ||
    (allowedTransitions[previousStatus] || []).includes(nextStatus);

  if (!canTransition) {
    throw newApiError(400, 'Недопустимый переход статуса поручения', {
      from: previousStatus,
      to: nextStatus
    });
  }

  event.next();
}, 'item_occurrences');
