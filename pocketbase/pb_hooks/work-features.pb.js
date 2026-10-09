routerAdd('PATCH', '/api/familytime/occurrences/{id}/checklist', event => {
  const occurrence = require(`${__hooks}/_shared/work-features.pb.js`).toggleChecklist(event.app, event);
  return event.json(200, occurrence);
}, $apis.requireAuth('users'));

routerAdd('GET', '/api/familytime/points', event => {
  return event.json(200, require(`${__hooks}/_shared/work-features.pb.js`).balances(event.app, event));
}, $apis.requireAuth('users'));

onRecordCreate(event => {
  event.record.set('checklist_done_json', []);
  event.next();
}, 'item_occurrences');

onRecordCreateRequest(event => {
  if (Object.prototype.hasOwnProperty.call(event.requestInfo().body || {}, 'checklist_done_json')) {
    throw new BadRequestError('Используйте действие чеклиста');
  }
  event.next();
}, 'item_occurrences');

onRecordCreateRequest(() => {
  throw new ForbiddenError('Баллы начисляет только сервер');
}, 'member_points_ledger');

onRecordUpdate(() => {
  throw new BadRequestError('Историю начислений нельзя менять');
}, 'member_points_ledger');

onRecordDelete(() => {
  throw new BadRequestError('Историю начислений нельзя удалять');
}, 'member_points_ledger');
