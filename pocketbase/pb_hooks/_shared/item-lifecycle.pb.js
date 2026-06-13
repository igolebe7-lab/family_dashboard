function validateBeforeSave(app, item, auth, isSuperuser) {
  require(`${__hooks}/_shared/validation.pb.js`).validateItemRecord(item);
  validateItemActor(app, item, auth, isSuperuser);
  applyItemVisibility(app, item);
}

function afterCreate(app, item) {
  require(`${__hooks}/_shared/activity.pb.js`).createActivity(app, {
    family: item.get('family'),
    item: item.id,
    actor: item.get('created_by'),
    action: 'item.created',
    summary: `Создано: ${item.get('title')}`
  });

  if (require(`${__hooks}/_shared/recurrence.pb.js`).shouldMaterializeSingleOccurrence(item)) {
    createOccurrenceForItem(app, item);
  }

  createNotificationsForItem(app, item);
}

function validateItemActor(app, item, auth, isSuperuser) {
  const actor = findMember(app, item.get('created_by'), 'created_by');
  const familyId = item.get('family');

  require(`${__hooks}/_shared/permissions.pb.js`).requireSameFamily(actor, familyId);

  if (actor.get('active') === false) {
    throw newApiError(403, 'Член семьи неактивен', { field: 'created_by' });
  }

  if (!isSuperuser && actor.get('user') !== auth.id) {
    throw newApiError(403, 'Нельзя создавать записи от имени другого члена семьи', {
      field: 'created_by'
    });
  }

  if (!isSuperuser && item.get('kind') === 'assignment') {
    validateAssignmentPermissions(app, item, actor);
  }
}

function validateAssignmentPermissions(app, item, actor) {
  require(`${__hooks}/_shared/auth.pb.js`)
    .getRecordArray(item, 'assignees')
    .forEach((assigneeId) => {
      const assignee = findMember(app, assigneeId, 'assignees');

      if (!require(`${__hooks}/_shared/permissions.pb.js`).canCreateAssignmentFor(actor, assignee)) {
        throw newApiError(403, 'Нет прав назначить это поручение', { field: 'assignees' });
      }
    });
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

function applyItemVisibility(app, item) {
  item.set('visible_to', buildVisibleMemberIds(app, item));
}

function buildVisibleMemberIds(app, item) {
  const familyMembers = findActiveFamilyMembers(app, item.get('family'));
  const visibility = item.get('visibility');
  const explicitMemberIds = collectExplicitMemberIds(item);

  if (visibility === 'family') {
    return familyMembers.map((member) => member.id);
  }

  if (visibility === 'adults') {
    return uniqueIds([
      ...familyMembers
        .filter((member) => ['owner', 'parent', 'adult'].includes(member.get('role')))
        .map((member) => member.id),
      ...explicitMemberIds
    ]);
  }

  if (visibility === 'assignees') {
    return uniqueIds([...explicitMemberIds, ...collectManagingParentIds(app, item)]);
  }

  return uniqueIds([item.get('created_by'), item.get('owner')].filter(Boolean));
}

function findActiveFamilyMembers(app, familyId) {
  return app.findRecordsByFilter(
    'family_members',
    `family = "${familyId}" && active = true`,
    '',
    200,
    0
  );
}

function collectExplicitMemberIds(item) {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  return uniqueIds([
    item.get('created_by'),
    item.get('owner'),
    ...authHelpers.getRecordArray(item, 'assignees'),
    ...authHelpers.getRecordArray(item, 'participants')
  ].filter(Boolean));
}

function collectManagingParentIds(app, item) {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  return uniqueIds([
    ...authHelpers.getRecordArray(item, 'assignees'),
    ...authHelpers.getRecordArray(item, 'participants')
  ].flatMap((memberId) => {
    try {
      const member = app.findRecordById('family_members', memberId);
      return authHelpers.getRecordArray(member, 'managed_by');
    } catch (_) {
      return [];
    }
  }));
}

function uniqueIds(ids) {
  return Array.from(new Set(ids));
}

function createOccurrenceForItem(app, item) {
  const collection = app.findCollectionByNameOrId('item_occurrences');
  const occurrence = new Record(collection);
  const kind = item.get('kind');

  occurrence.set('family', item.get('family'));
  occurrence.set('item', item.id);
  occurrence.set('visible_to', require(`${__hooks}/_shared/auth.pb.js`).getRecordArray(item, 'visible_to'));
  occurrence.set('kind', kind);
  occurrence.set('title_snapshot', item.get('title'));
  occurrence.set('category_snapshot', item.get('category'));
  occurrence.set('start_at', item.get('start_at'));
  occurrence.set('end_at', item.get('end_at'));
  occurrence.set('due_at', item.get('due_at'));
  occurrence.set('all_day', item.get('all_day') || false);
  occurrence.set('status', kind === 'assignment' ? 'assigned' : 'todo');
  app.save(occurrence);
}

function createNotificationsForItem(app, item) {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);

  if (item.get('kind') === 'assignment') {
    notifyMembers(app, item, authHelpers.getRecordArray(item, 'assignees'), {
      type: 'assignment.created',
      title: 'Новое поручение',
      body: item.get('title')
    });
  }

  if (item.get('kind') === 'event') {
    notifyMembers(app, item, authHelpers.getRecordArray(item, 'participants'), {
      type: 'event.changed',
      title: 'Новое событие',
      body: item.get('title')
    });
  }
}

function notifyMembers(app, item, memberIds, payload) {
  const actorId = item.get('created_by');

  memberIds
    .filter((memberId) => memberId !== actorId)
    .forEach((memberId) => {
      const member = findMember(app, memberId, 'recipient_member');
      require(`${__hooks}/_shared/permissions.pb.js`).requireSameFamily(member, item.get('family'));

      require(`${__hooks}/_shared/notifications.pb.js`).createNotification(app, {
        family: item.get('family'),
        recipient_member: member.id,
        recipient_user: member.get('user'),
        type: payload.type,
        title: payload.title,
        body: payload.body,
        item: item.id
      });
    });
}

module.exports = {
  afterCreate,
  validateBeforeSave
};
