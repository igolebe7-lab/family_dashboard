routerAdd('POST', '/api/familytime/occurrences/materialize', (event) => {
  const body = event.requestInfo().body;
  const family = String(body.family || '');
  const members = event.app.findRecordsByFilter('family_members',
    'family = {:family} && user = {:user} && active = true', '', 1, 0,
    { family, user: event.auth.id });
  if (!members.length) throw new ForbiddenError('Нет доступа к семье');
  const from = new Date(body.from);
  const to = new Date(body.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from ||
      to - from > 370 * 86400000 || from.getUTCFullYear() < 2000 || to.getUTCFullYear() > 2100) {
    throw new BadRequestError('Диапазон должен быть не больше года');
  }
  require(`${__hooks}/_shared/recurrence.pb.js`).materializeFamily(event.app, family, from, to);
  return event.json(200, { success: true });
}, $apis.requireAuth('users'));

cronAdd('familytime-recurrence-window', '17 2 * * *', () => {
  const recurrence = require(`${__hooks}/_shared/recurrence.pb.js`);
  const from = new Date();
  const to = new Date(from.getTime() + recurrence.DEFAULT_MATERIALIZATION_DAYS * 86400000);
  let offset = 0;
  while (true) {
    const items = $app.findRecordsByFilter('items', 'recurrence_rule != "" && archived = false', 'id', 50, offset);
    for (const item of items) {
      try { $app.runInTransaction((tx) => recurrence.materializeItem(tx, item, from, to)); }
      catch (error) { $app.logger().error('Recurrence materialization failed', 'item', item.id, 'error', String(error)); }
    }
    if (items.length < 50) break;
    offset += items.length;
  }
});
