const MAX_CHECKLIST_STEPS = 100;
const MAX_STEP_ID_LENGTH = 80;
const MAX_STEP_TITLE_LENGTH = 220;
const MAX_POINTS = 100;
const LEDGER = 'member_points_ledger';

function jsonArray(record, field) {
  const value = JSON.parse(record.getString(field) || 'null');
  if (value === null) return [];
  if (!Array.isArray(value)) throw new BadRequestError('Ожидается список пунктов');
  return value;
}

function checklistTemplate(item) {
  const steps = jsonArray(item, 'checklist_json');
  const ids = new Set();
  if (steps.length > MAX_CHECKLIST_STEPS) throw new BadRequestError('Слишком много пунктов чеклиста');
  for (const step of steps) {
    if (!step || typeof step.id !== 'string' || !step.id.trim() || step.id.length > MAX_STEP_ID_LENGTH ||
        typeof step.title !== 'string' || !step.title.trim() || step.title.length > MAX_STEP_TITLE_LENGTH || ids.has(step.id)) {
      throw new BadRequestError('Проверьте названия и уникальные идентификаторы пунктов');
    }
    ids.add(step.id);
  }
  return ids;
}

function requestActor(app, event, familyId) {
  const lifecycle = require(`${__hooks}/_shared/occurrence-lifecycle.pb.js`);
  if (!lifecycle.getHeader(event, 'x-family-member-id')) throw new BadRequestError('Нужно выбрать активный профиль');
  const auth = require(`${__hooks}/_shared/auth.pb.js`).requireAuth(event);
  if (auth.collection().name !== 'users') throw new ForbiddenError('Требуется пользовательский профиль');
  const actor = lifecycle.findRequestActor(app, event, auth, familyId, false);
  lifecycle.ensureActorMatchesAuth(app, auth, actor, familyId, false);
  return actor;
}

function toggleChecklist(app, event) {
  const body = event.requestInfo().body || {};
  if (typeof body.stepId !== 'string' || !body.stepId.trim() || body.stepId.length > MAX_STEP_ID_LENGTH ||
      typeof body.done !== 'boolean' || Object.keys(body).some(key => !['stepId', 'done'].includes(key))) {
    throw new BadRequestError('Нужны идентификатор пункта и отметка выполнения');
  }
  let result;
  app.runInTransaction(tx => {
    const occurrence = tx.findRecordById('item_occurrences', event.request.pathValue('id'));
    const item = tx.findRecordById('items', occurrence.getString('item'));
    const actor = requestActor(tx, event, occurrence.getString('family'));
    const permissions = require(`${__hooks}/_shared/permissions.pb.js`);
    const assignees = require(`${__hooks}/_shared/auth.pb.js`).getRecordArray(item, 'assignees');
    const allowed = [item.getString('owner'), item.getString('created_by'), ...assignees].includes(actor.id) ||
      assignees.some(id => permissions.canManageMember(actor, tx.findRecordById('family_members', id))) ||
      (item.getString('owner') && permissions.canManageMember(actor, tx.findRecordById('family_members', item.getString('owner'))));
    if (!permissions.canViewItem(tx, actor, item) || !allowed) throw new ForbiddenError('Нельзя менять этот чеклист');
    if (item.get('archived') || !['task', 'assignment'].includes(item.getString('kind')) ||
        !['todo', 'assigned', 'accepted', 'in_progress', 'overdue', 'rejected'].includes(occurrence.getString('status'))) {
      throw new BadRequestError('Чеклист этой записи уже нельзя менять');
    }
    const ids = checklistTemplate(item);
    if (!ids.has(body.stepId)) throw new BadRequestError('Пункт не найден в чеклисте');
    const doneIds = new Set(jsonArray(occurrence, 'checklist_done_json'));
    if (body.done) doneIds.add(body.stepId);
    else doneIds.delete(body.stepId);
    occurrence.set('checklist_done_json', Array.from(doneIds));
    tx.save(occurrence);
    result = occurrence;
  });
  return result;
}

function rewardTarget(app, item) {
  const points = item.get('points');
  const permissions = require(`${__hooks}/_shared/permissions.pb.js`);
  const assignees = require(`${__hooks}/_shared/auth.pb.js`).getRecordArray(item, 'assignees');
  if (!Number.isInteger(points) || points <= 0 || points > MAX_POINTS || item.getString('kind') !== 'assignment' || assignees.length !== 1) return null;
  const child = app.findRecordById('family_members', assignees[0]);
  const creator = app.findRecordById('family_members', item.getString('created_by'));
  if (item.getString('family') !== child.getString('family') || !permissions.isAdultRole(creator.getString('role')) ||
      !permissions.canManageMember(creator, child)) return null;
  return child;
}

function rewardFieldsChanged(item, original) {
  const { getRecordArray } = require(`${__hooks}/_shared/auth.pb.js`);
  return ['points', 'approval_required'].some(field => item.get(field) !== original.get(field)) ||
    JSON.stringify(getRecordArray(item, 'assignees').slice().sort()) !== JSON.stringify(getRecordArray(original, 'assignees').slice().sort());
}

function protectRewardHistory(app, item, original) {
  if (!original.getString('created_by') || !rewardFieldsChanged(item, original)) return;
  const completed = app.findRecordsByFilter('item_occurrences',
    'item = {:item} && (completed_at != "" || status = "done" || status = "approved")', '', 1, 0, { item: item.id });
  if (completed.length) throw new BadRequestError('Нельзя менять награду или исполнителя после выполнения');
}

function validateItem(app, item, body) {
  const original = item.original();
  const creating = !original.getString('created_by');
  if (creating || item.getString('checklist_json') !== original.getString('checklist_json')) checklistTemplate(item);
  const changed = creating || rewardFieldsChanged(item, original);
  if (Object.prototype.hasOwnProperty.call(body, 'points') && body.points !== null &&
      (typeof body.points !== 'number' || !Number.isInteger(body.points) || body.points < 0 || body.points > MAX_POINTS)) {
    throw new BadRequestError('Баллы должны быть целым числом от 0 до 100');
  }
  if (!changed) return; // Unrelated edits must not rewrite legacy rewards.
  const points = item.get('points');
  if (!Number.isInteger(points) || points < 0 || points > MAX_POINTS) throw new BadRequestError('Баллы должны быть целым числом от 0 до 100');
  protectRewardHistory(app, item, original);
  if (!points) return;
  if (!rewardTarget(app, item)) throw new BadRequestError('Награда доступна только поручению одному управляемому ребёнку');
  if (!item.get('approval_required')) {
    if (!creating && original.get('points') === points) throw new BadRequestError('Награда требует подтверждения взрослым');
    item.set('approval_required', true);
  }
}

function validateItemRequest(event) {
  // Collection handlers normalize/coerce fields in requestInfo().body. Read
  // the rereadable JSON body to reject strings/booleans before number coercion.
  const request = event.request || event.requestEvent.request;
  const body = String(request.header.get('Content-Type')).startsWith('application/json')
    ? JSON.parse(toString(request.body) || '{}') : event.requestInfo().body || {};
  if (Object.keys(body).some(field => field !== 'points' && field.replace(/^[+]|[+-]$/g, '') === 'points')) {
    throw new BadRequestError('Укажите итоговое число баллов');
  }
  validateItem(event.app, event.record, body);
}

function awardApproved(app, occurrence, item) {
  if (occurrence.getString('status') !== 'approved' || !item.get('approval_required')) return;
  const child = rewardTarget(app, item);
  if (!child || item.getString('family') !== occurrence.getString('family')) return;
  const reviewer = app.findRecordById('family_members', occurrence.getString('approved_by'));
  const permissions = require(`${__hooks}/_shared/permissions.pb.js`);
  if (!permissions.isAdultRole(reviewer.getString('role')) || !reviewer.get('active') ||
      reviewer.getString('family') !== item.getString('family') ||
      !permissions.canViewItem(app, reviewer, item) ||
      !(reviewer.id === item.getString('created_by') || permissions.canManageMember(reviewer, child))) {
    throw new ForbiddenError('Награда требует подтверждения взрослым');
  }
  if (app.findRecordsByFilter(LEDGER, 'member = {:member} && occurrence = {:occurrence}', '', 1, 0,
    { member: child.id, occurrence: occurrence.id }).length) return;
  const entry = new Record(app.findCollectionByNameOrId(LEDGER));
  for (const [field, value] of Object.entries({ member: child.id, family: item.getString('family'),
    occurrence: occurrence.id, approved_by: reviewer.id, points: item.get('points') })) entry.set(field, value);
  app.save(entry);
}

function balances(app, event) {
  const family = event.request.url.query().get('family');
  if (!family) throw new BadRequestError('Нужно выбрать семью');
  const actor = requestActor(app, event, family);
  const permissions = require(`${__hooks}/_shared/permissions.pb.js`);
  const children = app.findRecordsByFilter('family_members',
    'family = {:family} && active = true && (role = "child" || role = "teen")', 'id', 0, 0, { family })
    .filter(child => child.id === actor.id || permissions.canManageMember(actor, child));
  return { balances: children.map(child => {
    const sum = new DynamicModel({ balance: 0 });
    app.db().newQuery(`SELECT COALESCE(SUM(points), 0) AS balance FROM ${LEDGER} WHERE family = {:family} AND member = {:member}`)
      .bind({ family, member: child.id }).one(sum);
    return { memberId: child.id, balance: sum.balance };
  }) };
}

module.exports = { awardApproved, balances, protectRewardHistory, toggleChecklist, validateItemRequest };
