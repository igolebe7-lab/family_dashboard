function validateBeforeUpdate(app, event, auth, isSuperuser) {
  const existing = event.record.original();
  const previousStatus = existing.get('status');
  const nextStatus = event.record.get('status');

  validateTransition(previousStatus, nextStatus);

  if (previousStatus !== nextStatus) {
    applyTransition(app, event, auth, isSuperuser, previousStatus, nextStatus);
  }
}

function afterUpdate(app, occurrence) {
  const existing = occurrence.original();
  const previousStatus = existing.get('status');
  const nextStatus = occurrence.get('status');

  if (previousStatus === nextStatus || occurrence.get('kind') !== 'assignment') return;

  const item = findItem(app, occurrence.get('item'));
  createTransitionActivity(app, occurrence, item, nextStatus);
  createTransitionNotifications(app, occurrence, item, nextStatus);
}

function validateTransition(previousStatus, nextStatus) {
  const allowedTransitions = {
    todo: ['in_progress', 'done', 'cancelled'],
    assigned: ['accepted', 'in_progress', 'done', 'skipped', 'cancelled'],
    accepted: ['in_progress', 'done', 'skipped', 'cancelled'],
    in_progress: ['done', 'skipped', 'cancelled'],
    done: ['approved', 'rejected'],
    rejected: ['in_progress', 'done'],
    overdue: ['done', 'skipped', 'cancelled']
  };
  const canTransition =
    previousStatus === nextStatus ||
    (allowedTransitions[previousStatus] || []).includes(nextStatus);

  if (!canTransition) {
    throw newApiError(400, 'Недопустимый переход статуса поручения', {
      from: previousStatus,
      to: nextStatus
    });
  }
}

function applyTransition(app, event, auth, isSuperuser, previousStatus, nextStatus) {
  const occurrence = event.record;
  if (occurrence.get('kind') !== 'assignment') return;

  const item = findItem(app, occurrence.get('item'));
  const actor = findRequestActor(app, event, auth, occurrence.get('family'), isSuperuser);
  ensureActorMatchesAuth(app, auth, actor, occurrence.get('family'), isSuperuser);

  if (nextStatus === 'done') {
    ensureCanMarkDone(app, actor, item);
    occurrence.set('completed_by', actor.id);
    occurrence.set('completed_at', nowIso());
    occurrence.set('approved_by', null);
    occurrence.set('approved_at', null);
    occurrence.set('rejected_by', null);
    occurrence.set('rejected_at', null);
    occurrence.set('rejection_reason', '');
    return;
  }

  if (nextStatus === 'approved') {
    ensureApprovalRequired(item, nextStatus);
    ensureCanReview(app, actor, item);
    occurrence.set('approved_by', actor.id);
    occurrence.set('approved_at', nowIso());
    occurrence.set('rejected_by', null);
    occurrence.set('rejected_at', null);
    occurrence.set('rejection_reason', '');
    return;
  }

  if (nextStatus === 'rejected') {
    ensureApprovalRequired(item, nextStatus);
    ensureCanReview(app, actor, item);
    occurrence.set('rejected_by', actor.id);
    occurrence.set('rejected_at', nowIso());
    occurrence.set('approved_by', null);
    occurrence.set('approved_at', null);
    return;
  }

  if (previousStatus === 'rejected' && ['in_progress', 'done'].includes(nextStatus)) {
    occurrence.set('rejected_by', null);
    occurrence.set('rejected_at', null);
    occurrence.set('rejection_reason', '');
  }
}

function ensureApprovalRequired(item, nextStatus) {
  if (item.get('approval_required')) return;

  throw newApiError(400, 'Это поручение не требует подтверждения', {
    status: nextStatus
  });
}

function ensureCanMarkDone(app, actor, item) {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const permissions = require(`${__hooks}/_shared/permissions.pb.js`);
  const assigneeIds = authHelpers.getRecordArray(item, 'assignees');
  if (assigneeIds.includes(actor.id)) return;

  const canManageAssignee = assigneeIds.some((assigneeId) => {
    const assignee = findMember(app, assigneeId, 'assignees');
    return permissions.canManageMember(actor, assignee);
  });

  if (!canManageAssignee) {
    throw newApiError(403, 'Нельзя отметить это поручение выполненным', {
      status: 'done'
    });
  }
}

function ensureCanReview(app, actor, item) {
  if (actor.id === item.get('created_by')) return;

  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const permissions = require(`${__hooks}/_shared/permissions.pb.js`);
  const canReviewManagedChild = authHelpers.getRecordArray(item, 'assignees').some((assigneeId) => {
    const assignee = findMember(app, assigneeId, 'assignees');
    return permissions.canManageMember(actor, assignee);
  });

  if (!canReviewManagedChild) {
    throw newApiError(403, 'Нельзя подтвердить это поручение', {
      status: 'review'
    });
  }
}

function findRequestActor(app, event, auth, familyId, isSuperuser) {
  const memberId = getHeader(event, 'x-family-member-id');

  if (memberId) {
    const actor = findMember(app, memberId, 'X-Family-Member-Id');
    require(`${__hooks}/_shared/permissions.pb.js`).requireSameFamily(actor, familyId);
    return actor;
  }

  if (isSuperuser) {
    const members = findMembersByFamily(app, familyId);
    if (members.length > 0) return members[0];
  }

  const authMembers = app.findRecordsByFilter(
    'family_members',
    `family = "${escapeFilterValue(familyId)}" && user = "${escapeFilterValue(auth.id)}"`,
    '',
    1,
    0
  );

  if (authMembers.length > 0) return authMembers[0];

  throw newApiError(403, 'Не найден активный профиль семьи', {});
}

function ensureActorMatchesAuth(app, auth, actor, familyId, isSuperuser) {
  if (isSuperuser || actor.get('user') === auth.id) return;

  const authMembers = app.findRecordsByFilter(
    'family_members',
    `family = "${escapeFilterValue(familyId)}" && user = "${escapeFilterValue(auth.id)}"`,
    '',
    20,
    0
  );

  const canActForManagedProfile = authMembers.some((authMember) =>
    require(`${__hooks}/_shared/permissions.pb.js`).canManageMember(authMember, actor)
  );

  if (!canActForManagedProfile) {
    throw newApiError(403, 'Нельзя действовать от имени этого профиля', {
      member: actor.id
    });
  }
}

function createTransitionActivity(app, occurrence, item, nextStatus) {
  const actor = getTransitionActor(occurrence, nextStatus);
  if (!actor) return;

  require(`${__hooks}/_shared/activity.pb.js`).createActivity(app, {
    family: occurrence.get('family'),
    item: item.id,
    occurrence: occurrence.id,
    actor,
    action: getActivityAction(nextStatus),
    summary: getActivitySummary(occurrence, nextStatus)
  });
}

function createTransitionNotifications(app, occurrence, item, nextStatus) {
  if (nextStatus === 'done' && item.get('approval_required')) {
    notifyReviewers(app, occurrence, item);
  }

  if (nextStatus === 'approved') {
    notifyAssignees(app, occurrence, item, {
      type: 'assignment.approved',
      title: 'Поручение подтверждено',
      body: occurrence.get('title_snapshot')
    });
  }

  if (nextStatus === 'rejected') {
    notifyAssignees(app, occurrence, item, {
      type: 'assignment.rejected',
      title: 'Поручение нужно чуть поправить',
      body: occurrence.get('title_snapshot')
    });
  }
}

function notifyReviewers(app, occurrence, item) {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const reviewerIds = uniqueIds([
    item.get('created_by'),
    ...authHelpers.getRecordArray(item, 'assignees').flatMap((assigneeId) => {
      const assignee = findMember(app, assigneeId, 'assignees');
      return authHelpers.getRecordArray(assignee, 'managed_by');
    })
  ].filter(Boolean));

  notifyMembers(app, occurrence, item, reviewerIds, {
    type: 'assignment.done_waiting_approval',
    title: 'Поручение ждёт проверки',
    body: occurrence.get('title_snapshot')
  });
}

function notifyAssignees(app, occurrence, item, payload) {
  notifyMembers(
    app,
    occurrence,
    item,
    require(`${__hooks}/_shared/auth.pb.js`).getRecordArray(item, 'assignees'),
    payload
  );
}

function notifyMembers(app, occurrence, item, memberIds, payload) {
  const actor = getTransitionActor(occurrence, occurrence.get('status'));

  memberIds
    .filter((memberId) => memberId && memberId !== actor)
    .forEach((memberId) => {
      const member = findMember(app, memberId, 'recipient_member');
      require(`${__hooks}/_shared/permissions.pb.js`).requireSameFamily(member, occurrence.get('family'));

      require(`${__hooks}/_shared/notifications.pb.js`).createNotification(app, {
        family: occurrence.get('family'),
        recipient_member: member.id,
        recipient_user: member.get('user'),
        type: payload.type,
        title: payload.title,
        body: payload.body,
        item: item.id,
        occurrence: occurrence.id
      });
    });
}

function getTransitionActor(occurrence, status) {
  if (status === 'approved') return occurrence.get('approved_by');
  if (status === 'rejected') return occurrence.get('rejected_by');
  return occurrence.get('completed_by');
}

function getActivityAction(status) {
  if (status === 'approved') return 'assignment.approved';
  if (status === 'rejected') return 'assignment.rejected';
  if (status === 'skipped') return 'assignment.skipped';
  return 'assignment.done';
}

function getActivitySummary(occurrence, status) {
  if (status === 'approved') return `Подтверждено: ${occurrence.get('title_snapshot')}`;
  if (status === 'rejected') return `Возвращено: ${occurrence.get('title_snapshot')}`;
  return `Готово: ${occurrence.get('title_snapshot')}`;
}

function findItem(app, itemId) {
  try {
    return app.findRecordById('items', itemId);
  } catch (_) {
    throw newApiError(400, 'Поручение не найдено', { field: 'item' });
  }
}

function findMember(app, memberId, field) {
  if (!memberId) {
    throw newApiError(400, 'Нужно выбрать члена семьи', { field });
  }

  try {
    return app.findRecordById('family_members', memberId);
  } catch (_) {
    throw newApiError(400, 'Член семьи не найден', { field });
  }
}

function findMembersByFamily(app, familyId) {
  return app.findRecordsByFilter(
    'family_members',
    `family = "${escapeFilterValue(familyId)}"`,
    '',
    200,
    0
  );
}

function getHeader(event, name) {
  const requestInfo = require(`${__hooks}/_shared/auth.pb.js`).getRequestInfo(event);
  const headers = requestInfo.headers || requestInfo.Headers || {};
  const lowerName = name.toLowerCase();

  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(lowerName) || '';
  }

  return headers[name] || headers[lowerName] || headers['X-Family-Member-Id'] || '';
}

function escapeFilterValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function uniqueIds(ids) {
  return Array.from(new Set(ids));
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  afterUpdate,
  validateBeforeUpdate
};
