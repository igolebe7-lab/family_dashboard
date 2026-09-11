import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

assert.equal(process.env.SMOKE_ISOLATED, '1', 'Use the isolated backend runner');
const url = process.env.PB_URL;
async function request(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${url}${path}`, { method, headers: { Authorization: token || '', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  return { status: response.status, data };
}
async function ok(path, token, body, method) {
  const result = await request(path, token, body, method);
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.data;
}
const admin = (await ok('/api/collections/_superusers/auth-with-password', '', {
  identity: process.env.PB_SUPERUSER_EMAIL, password: process.env.PB_SUPERUSER_PASSWORD
})).token;
const password = randomUUID();
const email = `recurrence.${randomUUID()}@familytime.local`;
const user = await ok('/api/collections/users/records', admin, { email, password, passwordConfirm: password });
const token = (await ok('/api/collections/users/auth-with-password', '', { identity: email, password })).token;
const family = await ok('/api/collections/families/records', token, { name: 'Isolated recurrence', slug: randomUUID(), owner_user: user.id, timezone: 'Europe/Amsterdam' });
const member = await ok('/api/collections/family_members/records', admin, { family: family.id, user: user.id, display_name: 'Parent', role: 'owner', color: 'green', active: true });
const child = await ok('/api/collections/family_members/records', admin, { family: family.id, display_name: 'Child', role: 'child', color: 'blue', active: true, managed_by: [member.id] });
const base = { family: family.id, created_by: member.id, title: 'Work schedule', kind: 'event', category: 'work', priority: 'normal', visibility: 'family', timezone: 'Europe/Amsterdam', participants: [member.id] };
async function create(data) { return ok('/api/collections/items/records', token, { ...base, ...data }); }
async function occurrences(item) { return (await ok(`/api/collections/item_occurrences/records?perPage=500&sort=start_at,due_at&filter=${encodeURIComponent(`item="${item.id}"`)}`, token)).items; }
async function materialize(from, to) { await ok('/api/familytime/occurrences/materialize', token, { family: family.id, from, to }); }

const weekday = await create({ start_at: '2026-03-23T08:00:00Z', end_at: '2026-03-23T16:00:00Z', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', recurrence_until: '2026-04-03T21:59:59Z' });
await materialize('2026-03-23T00:00:00Z', '2026-04-04T00:00:00Z');
let dates = await occurrences(weekday);
assert.equal(dates.length, 10);
assert.equal(dates[0].start_at, '2026-03-23 08:00:00.000Z');
assert.equal(dates[5].start_at, '2026-03-30 07:00:00.000Z');
assert.equal(dates[5].end_at, '2026-03-30 15:00:00.000Z');
console.log('PASS weekdays, inclusive end date and DST preserve 09:00-17:00');
await materialize('2026-03-23T00:00:00Z', '2026-04-04T00:00:00Z');
assert.equal((await occurrences(weekday)).length, 10);
console.log('PASS idempotent repeated range loads');
const selected = await create({ start_at: '2026-03-23T16:00:00Z', end_at: '2026-03-23T17:00:00Z', recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', recurrence_until: '2026-04-10T21:59:59Z' });
await materialize('2026-03-23T00:00:00Z', '2026-04-11T00:00:00Z');
assert.deepEqual((await occurrences(selected)).map((x) => x.start_at.slice(0,10)), ['2026-03-23','2026-03-25','2026-04-06','2026-04-08']);
console.log('PASS Monday/Wednesday every other week');
const monthly = await create({ start_at: '2026-01-31T08:00:00Z', end_at: '2026-01-31T09:00:00Z', recurrence_rule: 'FREQ=MONTHLY', recurrence_until: '2026-04-30T21:59:59Z' });
await materialize('2026-01-01T00:00:00Z', '2026-05-01T00:00:00Z');
assert.deepEqual((await occurrences(monthly)).map((x) => x.start_at.slice(0,10)), ['2026-01-31','2026-03-31']);
console.log('PASS monthly recurrence skips missing calendar days');
await ok(`/api/familytime/occurrences/${dates[0].id}/schedule`, token, { startAt: '2026-03-24T10:00:00Z', endAt: '2026-03-24T11:00:00Z' }, 'PATCH');
await materialize('2026-03-23T00:00:00Z', '2026-04-04T00:00:00Z');
const moved = await occurrences(weekday);
assert.equal(moved.length, 10);
assert.equal(moved.find((x) => x.id === dates[0].id).start_at, '2026-03-24 10:00:00.000Z');
assert.equal(moved.find((x) => x.id === dates[1].id).start_at, dates[1].start_at);
console.log('PASS moving one informational event preserves series identity and neighbours');
const assignment = await create({ kind: 'assignment', title: 'Daily chore', participants: [], assignees: [child.id], due_at: '2026-03-23T18:00:00Z', recurrence_rule: 'FREQ=DAILY;COUNT=3', approval_required: true });
await materialize('2026-03-23T00:00:00Z', '2026-03-27T00:00:00Z');
const tasks = await occurrences(assignment);
assert.equal(tasks.length, 3);
await ok(`/api/collections/item_occurrences/records/${tasks[0].id}`, token, { status: 'done' }, 'PATCH');
await ok(`/api/collections/item_occurrences/records/${tasks[0].id}`, token, { status: 'approved' }, 'PATCH');
assert.equal((await occurrences(assignment)).find((x) => x.id === tasks[1].id).status, 'assigned');
console.log('PASS parent completion and approval affect one recurrence only');
assert.equal((await request('/api/familytime/occurrences/materialize', token, { family: 'unrelatedfamily', from:'2026-01-01', to:'2026-02-01' })).status, 403);
assert.equal((await request('/api/familytime/occurrences/materialize', token, { family: family.id, from:'2026-01-01', to:'2030-02-01' })).status, 400);
assert.equal((await request('/api/collections/items/records', token, { ...base, start_at:'2026-03-23T08:00:00Z', end_at:'2026-03-23T09:00:00Z', recurrence_rule:'FREQ=SECONDLY' })).status, 400);
console.log('PASS family authorization and bounded recurrence validation');
