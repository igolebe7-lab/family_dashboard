routerAdd('PATCH', '/api/familytime/items/{id}/series', (event) => {
  const body = event.requestInfo().body;
  event.app.runInTransaction((tx) => {
    const item = tx.findRecordById('items', event.request.pathValue('id'));
    const members = tx.findRecordsByFilter('family_members', 'family = {:family} && user = {:user} && active = true', '', 20, 0,
      { family: item.getString('family'), user: event.auth.id });
    const actor = members.find(member => ['owner', 'parent', 'adult'].includes(member.getString('role')) &&
      require(`${__hooks}/_shared/permissions.pb.js`).canViewItem(tx, member, item) &&
      (member.getString('role') === 'owner' || [item.getString('owner'), item.getString('created_by')].includes(member.id)));
    if (!actor) throw new NotFoundError('Серия недоступна');
    if (item.getString('kind') !== 'event' || !item.getString('recurrence_rule') || item.get('archived')) throw new BadRequestError('Нужна активная серия событий');
    const expected = body.expected || {};
    const fields = { startAt: 'start_at', endAt: 'end_at', recurrenceRule: 'recurrence_rule', recurrenceUntil: 'recurrence_until' };
    const sameDate = (a, b) => !a && !b || new Date(a).getTime() === new Date(b).getTime();
    for (const key of Object.keys(fields)) {
      const actual = item.getString(fields[key]);
      if (key === 'recurrenceRule' ? actual !== expected[key] : !sameDate(actual, expected[key])) throw new BadRequestError('Расписание уже изменилось. Откройте запись заново.');
    }
    const now = new Date();
    const start = new Date(body.startAt), end = new Date(body.endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start < now || end <= start || end - start > 31 * 86400000 || end.getUTCFullYear() > 2100) throw new BadRequestError('Выберите будущую дату и корректное время');
    if (typeof body.recurrenceRule !== 'string' || !body.recurrenceRule) throw new BadRequestError('Выберите периодичность');
    const recurrence = require(`${__hooks}/_shared/recurrence.pb.js`);
    const zone = item.getString('timezone') || 'UTC';
    const oldDuration = recurrence.toWall(new Date(item.getString('end_at')), zone) - recurrence.toWall(new Date(item.getString('start_at')), zone);
    const rows = tx.findRecordsByFilter('item_occurrences', 'item = {:item} && (start_at >= {:now} || recurrence_key >= {:key})', 'id', 5001, 0,
      { item: item.id, now: new DateTime(now.toISOString()).string(), key: now.toISOString() });
    if (rows.length > 5000) throw new BadRequestError('Слишком большая серия для одного изменения');
    const exceptions = JSON.parse(item.getString('recurrence_exdates_json') || '[]');
    const retainedDays = new Set(Array.isArray(exceptions) ? exceptions : []);
    const removable = [];
    for (const row of rows) {
      const key = row.getString('recurrence_key') || row.getString('start_at');
      const actual = new Date(row.getString('start_at'));
      const duration = recurrence.toWall(new Date(row.getString('end_at')), zone) - recurrence.toWall(actual, zone);
      const hasComments = tx.findRecordsByFilter('item_comments', 'occurrence = {:id}', '', 1, 0, { id: row.id }).length > 0;
      const protectedRow = actual < now || new Date(key) < now || row.getString('status') !== 'todo' || !sameDate(key, row.getString('start_at')) || duration !== oldDuration || hasComments;
      if (protectedRow) {
        retainedDays.add(recurrence.toWall(new Date(key), zone).toISOString().slice(0, 10));
      } else removable.push(row);
    }
    const previous = {};
    for (const key of Object.keys(fields)) previous[key] = item.getString(fields[key]);
    item.set('start_at', start.toISOString()); item.set('end_at', end.toISOString());
    item.set('recurrence_rule', body.recurrenceRule);
    item.set('recurrence_until', body.recurrenceUntil || '');
    item.set('recurrence_exdates_json', Array.from(retainedDays));
    recurrence.parseRule(item);
    // Delete only untouched future instances. History, overrides and comments keep their IDs.
    for (const row of removable) tx.delete(row);
    tx.save(item);
    recurrence.materializeItem(tx, item, now, new Date(now.getTime() + 90 * 86400000));
    require(`${__hooks}/_shared/activity.pb.js`).createActivity(tx, { family: item.get('family'), item: item.id, actor: actor.id,
      action: 'item.updated', summary: `Изменено расписание: ${item.getString('title')}`, old_value_json: previous,
      new_value_json: { startAt: body.startAt, endAt: body.endAt, recurrenceRule: body.recurrenceRule, recurrenceUntil: body.recurrenceUntil || '' } });
    for (const memberId of require(`${__hooks}/_shared/auth.pb.js`).getRecordArray(item, 'participants')) {
      if (memberId === actor.id) continue;
      const member = tx.findRecordById('family_members', memberId);
      require(`${__hooks}/_shared/notifications.pb.js`).createNotification(tx, { family: item.get('family'), item: item.id,
        recipient_member: memberId, recipient_user: member.get('user'), type: 'event.changed', title: 'Изменилось расписание', body: item.getString('title') });
    }
  });
  return event.json(200, event.app.findRecordById('items', event.request.pathValue('id')));
}, $apis.requireAuth('users'));
