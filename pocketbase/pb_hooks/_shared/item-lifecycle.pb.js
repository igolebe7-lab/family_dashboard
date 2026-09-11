function validateBeforeSave(app, item, auth, isSuperuser) {
  const original = item.original();
  if (original.get('created_by')) {
    for (const field of ['family', 'created_by', 'kind']) {
      if (item.get(field) !== original.get(field)) {
        throw newApiError(400, 'Нельзя менять принадлежность или автора записи', { field });
      }
    }
    for (const field of ['start_at', 'end_at', 'due_at', 'timezone', 'recurrence_rule', 'recurrence_until', 'recurrence_exdates_json']) {
      if (JSON.stringify(item.get(field)) !== JSON.stringify(original.get(field))) {
        throw newApiError(400, 'Измените отдельную дату расписания или создайте новую серию', { field });
      }
    }
  }
  require(`${__hooks}/_shared/validation.pb.js`).validateItemRecord(item);
  require(`${__hooks}/_shared/recurrence.pb.js`).parseRule(item);
  validateItemActor(app, item, auth, isSuperuser);
  for (const id of collectExplicitMemberIds(item)) {
    const member = findMember(app, id, 'members');
    require(`${__hooks}/_shared/permissions.pb.js`).requireSameFamily(member, item.get('family'));
    if (!member.get('active')) throw newApiError(400, 'Член семьи неактивен', { member: id });
  }
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
  if (item.getString('recurrence_rule')) {
    const recurrence = require(`${__hooks}/_shared/recurrence.pb.js`);
    const anchor = new Date(item.getString('start_at') || item.getString('due_at'));
    const from = new Date(Math.max(anchor.getTime(), Date.now() - 86400000));
    recurrence.materializeItem(app, item, from,
      new Date(from.getTime() + recurrence.DEFAULT_MATERIALIZATION_DAYS * 86400000));
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

  const updating = !!item.original().get('created_by');
  if (!isSuperuser && !updating && actor.get('user') !== auth.id) {
    throw newApiError(403, 'Нельзя создавать записи от имени другого члена семьи', {
      field: 'created_by'
    });
  }

  if (!isSuperuser && updating) {
    const members = app.findRecordsByFilter('family_members',
      'family = {:family} && user = {:user} && active = true', '', 20, 0,
      { family: familyId, user: auth.id });
    const editor = members.find((member) =>
      [item.get('created_by'), item.get('owner')].includes(member.id) || member.get('role') === 'owner');
    if (!editor || !require(`${__hooks}/_shared/permissions.pb.js`).canViewItem(app, editor, item)) {
      throw newApiError(403, 'Нет прав изменять запись', {});
    }
    if (item.get('kind') === 'assignment') validateAssignmentPermissions(app, item, editor);
  }
  if (!isSuperuser && !updating && item.get('kind') === 'assignment') {
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
  const { canViewItem } = require(`${__hooks}/_shared/permissions.pb.js`);
  return findActiveFamilyMembers(app, item.get('family'))
    .filter((member) => canViewItem(app, member, item)).map((member) => member.id);
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

function afterUpdate(app, item, original) {
  const { getRecordArray } = require(`${__hooks}/_shared/auth.pb.js`);
  let offset = 0;
  while (true) {
    const records = app.findRecordsByFilter('item_occurrences', 'item = {:item}', 'id', 200, offset, { item: item.id });
    for (const record of records) {
      record.set('title_snapshot', item.get('title'));
      record.set('category_snapshot', item.get('category'));
      record.set('visible_to', getRecordArray(item, 'visible_to'));
      app.save(record);
    }
    if (records.length < 200) break;
    offset += records.length;
  }
  const fields = ['title', 'description', 'location_text', 'priority'].filter((field) =>
    item.getString(field) !== original.getString(field)
  );
  if (!fields.length) return;
  const oldValues = {};
  const newValues = {};
  for (const field of fields) {
    oldValues[field] = original.getString(field);
    newValues[field] = item.getString(field);
  }
  require(`${__hooks}/_shared/activity.pb.js`).createActivity(app, {
    family: item.get('family'), item: item.id, actor: item.get('created_by'),
    action: 'item.updated', summary: `Изменено: ${item.get('title')}`,
    old_value_json: oldValues, new_value_json: newValues
  });
  if (item.get('kind') === 'event') {
    notifyMembers(app, item, getRecordArray(item, 'participants'), {
      type: 'event.changed', title: 'Событие изменено', body: item.get('title')
    });
  }
}

module.exports = {
  afterCreate,
  afterUpdate,
  validateBeforeSave
};
