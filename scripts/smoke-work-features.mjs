import assert from 'node:assert/strict';
import { basename, dirname, resolve } from 'node:path';

const url = process.env.PB_URL;
if (process.env.SMOKE_ISOLATED !== '1' || url !== 'http://127.0.0.1:8091') {
  throw new Error('Run only through smoke-backend-isolated.mjs (owned temporary DB on 8091)');
}
let checks = 0;
async function request(path, { token, member, body, method = body ? 'POST' : 'GET', status = 200 } = {}) {
  const response = await fetch(url + path, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(member ? { 'X-Family-Member-Id': member } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  checks++;
  return data;
}
const records = name => `/api/collections/${name}/records`;
const login = (collection, identity, password) => request(`/api/collections/${collection}/auth-with-password`, { body: { identity, password } });
const admin = (await login('_superusers', process.env.PB_SUPERUSER_EMAIL, process.env.PB_SUPERUSER_PASSWORD)).token;
const schema = await request('/api/collections/member_points_ledger', { token: admin });
for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) assert.equal(schema[rule], null);
for (const field of ['member', 'family', 'occurrence', 'approved_by', 'points', 'created']) assert.ok(schema.fields.some(entry => entry.name === field));
assert.ok(schema.indexes.some(index => /UNIQUE.*\(member, occurrence\)/.test(index)));
const create = (name, body, token = admin, status = 200) => request(records(name), { token, body, status });
const patch = (name, id, body, token = admin, member, status = 200) => request(`${records(name)}/${id}`, { token, member, body, method: 'PATCH', status });
const list = async (name, filter, token = admin) => (await request(`${records(name)}?filter=${encodeURIComponent(filter)}&perPage=200`, { token })).items;
const suffix = Date.now();
const password = 'WorkSmoke123456!';
async function user(role) {
  const email = `work.${role}.${suffix}@familytime.local`;
  const record = await create('users', { email, password, passwordConfirm: password, verified: true });
  return { id: record.id, token: (await login('users', email, password)).token };
}
const users = {};
for (const role of ['owner', 'parent', 'viewer', 'adult', 'child', 'teen', 'outsider']) users[role] = await user(role);
const family = await create('families', { name: `Work ${suffix}`, slug: `work-${suffix}`, owner_user: users.owner.id, timezone: 'UTC' });
const otherFamily = await create('families', { name: `Other work ${suffix}`, slug: `other-work-${suffix}`, owner_user: users.outsider.id, timezone: 'UTC' });
const members = {};
for (const role of ['owner', 'parent', 'viewer', 'adult', 'child', 'teen', 'outsider']) {
  members[role] = await create('family_members', { family: role === 'outsider' ? otherFamily.id : family.id,
    user: users[role].id, display_name: role, role: role === 'viewer' ? 'parent' : role === 'outsider' ? 'owner' : role,
    active: true, managed_by: ['child', 'teen'].includes(role) ? [members.parent.id] : [] });
}
const checklist = [{ id: 'a', title: 'First', done: true }, { id: 'b', title: 'Second', done: false }];
const base = { family: family.id, kind: 'assignment', title: 'Work smoke', created_by: members.parent.id,
  assignees: [members.child.id], category: 'home', priority: 'normal', visibility: 'family',
  due_at: new Date(Date.now() + 86400000).toISOString(), timezone: 'UTC', approval_required: true, checklist_json: checklist };
const item = await create('items', base, users.parent.token);
const occurrence = (await list('item_occurrences', `item="${item.id}"`))[0];
await create('item_occurrences', { family: family.id, item: item.id, kind: 'assignment',
  title_snapshot: 'Forged checklist progress', category_snapshot: 'home', status: 'assigned', checklist_done_json: ['a'] }, admin, 400);
const toggle = (id, stepId, done, role = 'child', status = 200, actor = members[role].id) => request(`/api/familytime/occurrences/${id}/checklist`, {
  token: users[role].token, member: actor, method: 'PATCH', body: { stepId, done }, status
});
const action = (id, status, role = 'child', expected = 200, actor = members[role].id) => patch('item_occurrences', id, { status }, users[role].token, actor, expected);
const balance = (role = 'child', familyId = family.id, status = 200, actor = members[role].id) => request(`/api/familytime/points?family=${familyId}`, { token: users[role].token, member: actor, status });
const ledger = id => list('member_points_ledger', `occurrence="${id}"`);

// RED: the dedicated route is absent before the backend feature is implemented.
const first = await toggle(occurrence.id, 'a', true);
assert.equal(first.id, occurrence.id);
assert.equal(first.status, 'assigned');
assert.deepEqual(first.checklist_done_json, ['a']);
await toggle(occurrence.id, 'a', false);
await Promise.all([toggle(occurrence.id, 'a', true), toggle(occurrence.id, 'b', true)]);
assert.deepEqual((await request(`${records('item_occurrences')}/${occurrence.id}`, { token: admin })).checklist_done_json.sort(), ['a', 'b']);
await toggle(occurrence.id, 'a', false);
assert.deepEqual((await request(`${records('item_occurrences')}/${occurrence.id}`, { token: admin })).checklist_done_json, ['b']);
assert.deepEqual((await request(`${records('items')}/${item.id}`, { token: admin })).checklist_json, checklist);
await toggle(occurrence.id, 'a', true, 'parent');
await toggle(occurrence.id, 'a', true, 'owner');
await toggle(occurrence.id, 'a', true, 'viewer', 403);
await toggle(occurrence.id, 'a', true, 'adult', 403);
await toggle(occurrence.id, 'a', true, 'outsider', 403);
await toggle(occurrence.id, 'a', true, 'child', 403, members.parent.id);
await toggle(occurrence.id, 'a', true, 'viewer', 403, members.child.id);
await toggle(occurrence.id, 'a', true, 'parent', 200, members.child.id);
await toggle(occurrence.id, 'missing', true, 'child', 400);
await toggle(occurrence.id, 'a', 'true', 'child', 400);
await request(`/api/familytime/occurrences/${occurrence.id}/checklist`, { method: 'PATCH', body: { stepId: 'a', done: true }, status: 401 });
await request(`/api/familytime/occurrences/${occurrence.id}/checklist`, { token: users.child.token, method: 'PATCH', body: { stepId: 'a', done: true }, status: 400 });
await patch('item_occurrences', occurrence.id, { checklist_done_json: ['a'] }, users.child.token, members.child.id, 400);
await patch('item_occurrences', occurrence.id, { 'checklist_done_json+': ['a'] }, users.child.token, members.child.id, 400);
await patch('item_occurrences', occurrence.id, { checklist_done_json: [] }, admin, undefined, 400);
await Promise.all([toggle(occurrence.id, 'a', false), action(occurrence.id, 'in_progress')]);
const progressing = await request(`${records('item_occurrences')}/${occurrence.id}`, { token: admin });
assert.equal(progressing.status, 'in_progress');
assert.deepEqual(progressing.checklist_done_json, ['b']);
await patch('items', item.id, { archived: true }, users.parent.token);
await toggle(occurrence.id, 'a', true, 'child', 400);
await patch('items', item.id, { archived: false }, users.parent.token);
await action(occurrence.id, 'done');
await toggle(occurrence.id, 'a', true, 'child', 400);
await action(occurrence.id, 'rejected', 'parent');
await toggle(occurrence.id, 'a', false);
await action(occurrence.id, 'done');
await action(occurrence.id, 'approved', 'parent');
await toggle(occurrence.id, 'a', true, 'child', 400);

const event = await create('items', { ...base, kind: 'event', assignees: [], start_at: base.due_at,
  end_at: new Date(Date.now() + 90000000).toISOString() }, users.parent.token);
await toggle((await list('item_occurrences', `item="${event.id}"`))[0].id, 'a', true, 'parent', 400);
const task = await create('items', { ...base, kind: 'task', assignees: [], owner: members.parent.id }, users.parent.token);
const taskOccurrence = (await list('item_occurrences', `item="${task.id}"`))[0];
await toggle(taskOccurrence.id, 'a', true, 'parent');
await action(taskOccurrence.id, 'done', 'parent');
await toggle(taskOccurrence.id, 'a', false, 'parent', 400);
for (const template of [[{ id: 'a', title: 'One' }, { id: 'a', title: 'Duplicate' }], [{ id: '', title: 'Empty' }],
  Array.from({ length: 101 }, (_, i) => ({ id: `step${i}`, title: 'Too many' })), [{ id: 'x'.repeat(81), title: 'Long ID' }], { id: 'a' }]) {
  await create('items', { ...base, checklist_json: template }, users.parent.token, 400);
}
for (const reward of [-1, 101, 1.5, '10', true]) await create('items', { ...base, points: reward }, users.parent.token, 400);
await create('items', { ...base, created_by: members.child.id, assignees: [members.teen.id], points: 10 }, users.child.token, 403);
await create('items', { ...base, assignees: [members.outsider.id], points: 10 }, users.parent.token, 403);
for (const invalid of [{ assignees: [members.adult.id] }, { assignees: [members.child.id, members.teen.id] },
  { kind: 'task', assignees: [] }, { kind: 'event', start_at: base.due_at, end_at: base.due_at },
  { created_by: members.viewer.id }, { created_by: members.adult.id, assignees: [members.teen.id] }]) {
  const role = invalid.created_by === members.viewer.id ? 'viewer' : invalid.created_by === members.adult.id ? 'adult' : 'parent';
  await create('items', { ...base, ...invalid, points: 10 }, users[role].token, 400);
}

const rewarded = await create('items', { ...base, points: 10, approval_required: false }, users.parent.token);
assert.equal(rewarded.approval_required, true);
await patch('items', rewarded.id, { points: '10' }, users.parent.token, undefined, 400);
await patch('items', rewarded.id, { 'points+': 5 }, users.parent.token, undefined, 400);
await patch('items', rewarded.id, { approval_required: false }, users.parent.token, undefined, 400);
const paidOccurrence = (await list('item_occurrences', `item="${rewarded.id}"`))[0];
assert.deepEqual(await balance(), { balances: [{ memberId: members.child.id, balance: 0 }] });
await action(paidOccurrence.id, 'done');
assert.equal((await ledger(paidOccurrence.id)).length, 0);
await action(paidOccurrence.id, 'approved', 'child', 403);
await action(paidOccurrence.id, 'approved', 'parent', 403, members.child.id);
await action(paidOccurrence.id, 'approved', 'viewer', 403);
await action(paidOccurrence.id, 'rejected', 'parent');
assert.equal((await ledger(paidOccurrence.id)).length, 0);
for (const edit of [{ points: 20 }, { assignees: [members.teen.id] }, { approval_required: false }]) {
  await patch('items', rewarded.id, edit, users.parent.token, undefined, 400);
}
await patch('items', rewarded.id, { title: 'Unrelated edit' }, users.parent.token);
await action(paidOccurrence.id, 'done');
await Promise.all([action(paidOccurrence.id, 'approved', 'parent'), action(paidOccurrence.id, 'approved', 'parent')]);
await action(paidOccurrence.id, 'approved', 'parent');
await action(paidOccurrence.id, 'approved', 'child', 403);
const rows = await ledger(paidOccurrence.id);
assert.equal(rows.length, 1);
assert.deepEqual(Object.fromEntries(['member', 'family', 'occurrence', 'approved_by', 'points'].map(key => [key, rows[0][key]])),
  { member: members.child.id, family: family.id, occurrence: paidOccurrence.id, approved_by: members.parent.id, points: 10 });
assert.equal((await list('item_activity', `occurrence="${paidOccurrence.id}" && action="assignment.approved"`)).length, 1);
assert.equal((await balance()).balances[0].balance, 10);
assert.deepEqual((await balance('teen')).balances, [{ memberId: members.teen.id, balance: 0 }]);
assert.deepEqual((await balance('viewer')).balances, []);
assert.deepEqual((await balance('adult')).balances, []);
assert.equal((await balance('parent')).balances.length, 2);
assert.equal((await balance('owner')).balances.length, 2);
await balance('child', otherFamily.id, 403);
await balance('outsider', family.id, 403);
await balance('child', family.id, 403, members.parent.id);
await request(`/api/familytime/points?family=${family.id}`, { status: 401 });
await request(records('member_points_ledger'), { token: users.owner.token, status: 403 });
await create('member_points_ledger', { member: members.child.id, family: family.id, occurrence: paidOccurrence.id,
  approved_by: members.parent.id, points: 100 }, users.owner.token, 403);
await patch('member_points_ledger', rows[0].id, { points: 100 }, users.owner.token, undefined, 403);
await request(`${records('member_points_ledger')}/${rows[0].id}`, { token: users.owner.token, method: 'DELETE', status: 403 });
await patch('member_points_ledger', rows[0].id, { points: 100 }, admin, undefined, 400);
await create('member_points_ledger', { member: members.child.id, family: family.id, occurrence: paidOccurrence.id,
  approved_by: members.parent.id, points: 100 }, admin, 403);

const repeat = await create('items', { ...base, due_at: base.due_at.replace(/\.\d{3}Z$/, '.000Z'),
  points: 5, recurrence_rule: 'FREQ=DAILY;COUNT=2' }, users.parent.token);
const dates = await list('item_occurrences', `item="${repeat.id}"`);
assert.equal(dates.length, 2);
await toggle(dates[0].id, 'a', true);
assert.deepEqual((await request(`${records('item_occurrences')}/${dates[1].id}`, { token: admin })).checklist_done_json ?? [], []);
await action(dates[0].id, 'done', 'parent');
await action(dates[0].id, 'approved', 'parent');
await action(dates[1].id, 'done', 'parent');
await action(dates[1].id, 'approved', 'parent');
assert.equal((await balance()).balances[0].balance, 20);
assert.equal((await ledger(dates[0].id)).length, 1);
assert.equal((await ledger(dates[1].id)).length, 1);
const teenReward = await create('items', { ...base, assignees: [members.teen.id], points: 7 }, users.parent.token);
const teenOccurrence = (await list('item_occurrences', `item="${teenReward.id}"`))[0];
await action(teenOccurrence.id, 'done', 'teen');
await action(teenOccurrence.id, 'approved', 'owner');
assert.deepEqual((await balance('teen')).balances, [{ memberId: members.teen.id, balance: 7 }]);
const scopedPrivate = await create('items', { ...base, visibility: 'private' }, users.parent.token);
await toggle((await list('item_occurrences', `item="${scopedPrivate.id}"`))[0].id, 'a', true, 'child', 403);

// Legacy invalid rewards survive unrelated edits and must never become new credits.
const legacy = await create('items', { ...base, points: 0, assignees: [members.adult.id] }, users.parent.token);
// Simulate persisted pre-migration data only in the runner-owned SQLite file.
assert.ok(process.env.SMOKE_DATA_DIR && basename(dirname(process.env.SMOKE_DATA_DIR)).startsWith('familytime-backend-smoke-'));
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(resolve(process.env.SMOKE_DATA_DIR, 'data.db'));
try { db.prepare('UPDATE items SET points = 99 WHERE id = ?').run(legacy.id); }
finally { db.close(); }
await patch('items', legacy.id, { title: 'Preserved legacy reward' }, users.parent.token);
const legacyOccurrence = (await list('item_occurrences', `item="${legacy.id}"`))[0];
await action(legacyOccurrence.id, 'done', 'adult');
await action(legacyOccurrence.id, 'approved', 'parent');
assert.equal((await ledger(legacyOccurrence.id)).length, 0);
const noReward = await create('items', { ...base, points: 0 }, users.parent.token);
const noRewardOccurrence = (await list('item_occurrences', `item="${noReward.id}"`))[0];
await action(noRewardOccurrence.id, 'done');
await action(noRewardOccurrence.id, 'approved', 'parent');
await patch('items', noReward.id, { points: 10 }, users.parent.token, undefined, 400);
assert.equal((await ledger(noRewardOccurrence.id)).length, 0);

// Force a later side effect to fail after the ledger insert; the whole approval
// must roll back, then a retry must credit exactly once.
const rollbackItem = await create('items', { ...base, points: 3 }, users.parent.token);
const rollbackOccurrence = (await list('item_occurrences', `item="${rollbackItem.id}"`))[0];
await action(rollbackOccurrence.id, 'done');
const rollbackDb = new DatabaseSync(resolve(process.env.SMOKE_DATA_DIR, 'data.db'));
try {
  rollbackDb.exec(`CREATE TRIGGER work_smoke_fail_approval BEFORE INSERT ON item_activity
    WHEN NEW.occurrence = '${rollbackOccurrence.id}' AND NEW.action = 'assignment.approved'
    BEGIN SELECT RAISE(ABORT, 'smoke approval rollback'); END`);
  await action(rollbackOccurrence.id, 'approved', 'parent', 400);
  assert.equal((await request(`${records('item_occurrences')}/${rollbackOccurrence.id}`, { token: admin })).status, 'done');
  assert.equal((await ledger(rollbackOccurrence.id)).length, 0);
  assert.equal((await balance()).balances[0].balance, 20);
  rollbackDb.exec('DROP TRIGGER work_smoke_fail_approval');
  await action(rollbackOccurrence.id, 'approved', 'parent');
  assert.equal((await balance()).balances[0].balance, 23);
  assert.equal((await ledger(rollbackOccurrence.id)).length, 1);
  assert.throws(() => rollbackDb.prepare(`INSERT INTO member_points_ledger
    (id, member, family, occurrence, approved_by, points, created) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('duplicateledger', members.child.id, family.id, paidOccurrence.id, members.parent.id, 10, new Date().toISOString()), /UNIQUE/);
} finally {
  rollbackDb.exec('DROP TRIGGER IF EXISTS work_smoke_fail_approval');
  rollbackDb.close();
}
const historical = await create('items', { ...base, points: 13 }, users.parent.token);
const historicalOccurrence = (await list('item_occurrences', `item="${historical.id}"`))[0];
const historyDb = new DatabaseSync(resolve(process.env.SMOKE_DATA_DIR, 'data.db'));
try {
  historyDb.prepare('UPDATE item_occurrences SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?')
    .run('approved', members.parent.id, new Date().toISOString(), historicalOccurrence.id);
} finally { historyDb.close(); }
await patch('items', historical.id, { title: 'Unrelated historical edit' }, users.parent.token);
await action(historicalOccurrence.id, 'approved', 'parent');
assert.equal((await ledger(historicalOccurrence.id)).length, 0);
assert.equal((await balance()).balances[0].balance, 23);
await patch('family_members', members.child.id, { active: false });
await balance('child', family.id, 403);
await toggle(dates[1].id, 'a', true, 'child', 403);
console.log(JSON.stringify({ suite: 'work-features', checks, database: 'runner-owned temporary DB', port: 8091 }));
