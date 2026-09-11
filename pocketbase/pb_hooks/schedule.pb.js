routerAdd('PATCH', '/api/familytime/occurrences/{id}/schedule', (event) => {
  const occurrence = event.app.findRecordById('item_occurrences', event.request.pathValue('id'));
  const item = event.app.findRecordById('items', occurrence.getString('item'));
  const members = event.app.findRecordsByFilter('family_members',
    'family = {:family} && user = {:user} && active = true', '', 20, 0,
    { family: item.getString('family'), user: event.auth.id });
  const actor = members.find((member) =>
    require(`${__hooks}/_shared/permissions.pb.js`).canViewItem(event.app, member, item) &&
    ([item.getString('created_by'), item.getString('owner')].includes(member.id) || member.getString('role') === 'owner'));
  if (!actor) throw new NotFoundError('Событие недоступно');
  if (item.getString('kind') !== 'event' || item.get('archived')) throw new BadRequestError('Изменять время можно у активного события');
  const body = event.requestInfo().body;
  const start = new Date(body.startAt);
  const end = new Date(body.endAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start ||
      end - start > 31 * 86400000 || start.getUTCFullYear() < 2000 || end.getUTCFullYear() > 2100) {
    throw new BadRequestError('Проверьте дату и время события');
  }
  event.app.runInTransaction((tx) => {
    const current = tx.findRecordById('item_occurrences', occurrence.id);
    const previous = { start_at: current.getString('start_at'), end_at: current.getString('end_at') };
    // Keep the original recurrence identity when one meeting is moved.
    if (item.getString('recurrence_rule') && !current.getString('recurrence_key')) {
      current.set('recurrence_key', new Date(current.getString('start_at')).toISOString());
    }
    current.set('start_at', start.toISOString());
    current.set('end_at', end.toISOString());
    tx.save(current);
    require(`${__hooks}/_shared/activity.pb.js`).createActivity(tx, {
      family: item.get('family'), item: item.id, occurrence: current.id, actor: actor.id,
      action: 'item.updated', summary: `Перенесено: ${item.getString('title')}`,
      old_value_json: previous, new_value_json: { start_at: start.toISOString(), end_at: end.toISOString() }
    });
    for (const memberId of require(`${__hooks}/_shared/auth.pb.js`).getRecordArray(item, 'participants')) {
      if (memberId === actor.id) continue;
      const member = tx.findRecordById('family_members', memberId);
      require(`${__hooks}/_shared/notifications.pb.js`).createNotification(tx, {
        family: item.get('family'), item: item.id, occurrence: current.id,
        recipient_member: memberId, recipient_user: member.get('user'), type: 'event.changed',
        title: 'Изменилось время события', body: item.getString('title')
      });
    }
  });
  return event.json(200, event.app.findRecordById('item_occurrences', occurrence.id));
}, $apis.requireAuth('users'));
