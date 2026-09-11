import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 8092;
const probe = createServer();
probe.listen(port, '127.0.0.1');
await once(probe, 'listening');
await new Promise((done) => probe.close(done));
const dir = await mkdtemp(resolve(tmpdir(), 'familytime-reminders-'));
const url = `http://127.0.0.1:${port}`;
const email = 'reminders@example.test';
const password = randomUUID();
let server;
let token = '';
let output = '';
const now = '2035-01-01T12:00:00.000Z';
async function request(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(url + path, {
    method, headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => null);
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
const create = (collection, body) => request(`/api/collections/${collection}/records`, body);
const patch = (collection, id, body) => request(`/api/collections/${collection}/records/${id}`, body, 'PATCH');
const list = async (collection, filter) => (await request(`/api/collections/${collection}/records?perPage=500&filter=${encodeURIComponent(filter)}`)).items;
const run = () => request('/api/reminder-test/run', { now });
try {
  await cp(resolve(root, 'pocketbase/pb_hooks'), resolve(dir, 'hooks'), { recursive: true });
  // Generated test-only route lives exclusively in the owned temporary hooks directory.
  await writeFile(resolve(dir, 'hooks/zz-reminder-test.pb.js'), `
routerAdd('POST', '/api/reminder-test/run', (e) => {
  if (e.requestInfo().body.resetCursor) e.app.store().set('familytime.reminders.cursor', '');
  return e.json(200, require(__hooks + '/_shared/reminders.pb.js').runReminders(e.app, e.requestInfo().body.now));
}, $apis.requireSuperuserAuth());
routerAdd('POST', '/api/reminder-test/status', (e) => {
  const body = e.requestInfo().body;
  e.app.db().newQuery('UPDATE item_occurrences SET status = {:status} WHERE id = {:id}').bind(body).execute();
  return e.json(200, {});
}, $apis.requireSuperuserAuth());
`);
  const binary = resolve(root, 'pocketbase/pocketbase');
  const args = ['--automigrate=false', `--dir=${resolve(dir, 'data')}`, `--hooksDir=${resolve(dir, 'hooks')}`,
    `--migrationsDir=${resolve(root, 'pocketbase/pb_migrations')}`];
  const setup = spawnSync(binary, ['superuser', 'upsert', email, password, ...args], { encoding: 'utf8' });
  assert.equal(setup.status, 0, 'Temporary PocketBase setup failed');
  server = spawn(binary, ['serve', `--http=127.0.0.1:${port}`, '--dev=false', ...args]);
  server.stdout.on('data', (data) => { output += data; });
  server.stderr.on('data', (data) => { output += data; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(server.exitCode, null, 'Temporary PocketBase exited');
    try { ready = (await fetch(url + '/api/health')).ok; } catch { /* Startup wait. */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(ready, 'Temporary PocketBase startup timeout');
  token = (await request('/api/collections/_superusers/auth-with-password', { identity: email, password })).token;
  const crons = await request('/api/crons');
  assert.ok(crons.some((job) => job.id === 'familytime_reminders' && job.expression === '* * * * *'), 'minute cron registered');
  const schema = await request('/api/collections/items');
  assert.ok(schema.fields.some((field) => field.name === 'reminder_enabled' && field.type === 'bool'), 'reminder_enabled migration missing');
  const user = await create('users', { email: 'owner@example.test', password, passwordConfirm: password });
  const family = await create('families', { name: 'Reminder test', slug: randomUUID(), owner_user: user.id, timezone: 'UTC' });
  const other = await create('families', { name: 'Other family', slug: randomUUID(), owner_user: user.id, timezone: 'UTC' });
  const member = (role, familyId = family.id) => create('family_members', { family: familyId, display_name: role, role, active: true, user: user.id });
  const owner = await member('owner');
  const adult = await member('adult');
  const child = await member('child');
  const inactive = await member('teen');
  const outsider = await member('adult', other.id);
  const base = { family: family.id, created_by: owner.id, owner: owner.id, kind: 'task', title: 'Reminder test',
    category: 'home', priority: 'normal', visibility: 'family', timezone: 'UTC', due_at: now,
    reminder_enabled: true, reminder_offset_minutes: 0 };
  const item = (body = {}) => create('items', { ...base, ...body });
  const occurrence = async (record) => {
    const rows = await list('item_occurrences', `item="${record.id}"`);
    assert.equal(rows.length, 1);
    return rows[0];
  };
  const reminders = (record) => list('notifications', `item="${record.id}" && type="item.reminder"`);
  const due = await item();
  const advance = await item({ due_at: '2035-01-01T12:15:00.000Z', reminder_offset_minutes: 15 });
  const catchup = await item({ due_at: '2034-12-31T12:00:00.000Z' });
  const skipped = [];
  for (const body of [
    { reminder_enabled: false }, { reminder_enabled: undefined }, { due_at: '2035-01-01T12:01:00.000Z' },
    { due_at: '2034-12-31T11:59:59.000Z' }, { due_at: '' }, { archived: true }
  ]) skipped.push(await item(body));
  for (const status of ['done', 'approved', 'skipped', 'cancelled']) {
    const record = await item();
    await request('/api/reminder-test/status', { id: (await occurrence(record)).id, status });
    skipped.push(record);
  }
  const event = await item({ kind: 'event', due_at: '', start_at: now, end_at: '2035-01-01T13:00:00.000Z',
    participants: [adult.id, child.id, inactive.id], visibility: 'adults' });
  const privateEvent = await item({ kind: 'event', due_at: '', start_at: now, end_at: '2035-01-01T13:00:00.000Z',
    participants: [adult.id], visibility: 'private' });
  skipped.push(privateEvent);
  const assignment = await item({ kind: 'assignment', owner: '', assignees: [child.id], visibility: 'assignees' });
  await patch('family_members', inactive.id, { active: false });
  // A member can move families after the item was created; never trust old visible_to.
  const moved = await item({ kind: 'assignment', owner: '', assignees: [adult.id] });
  await patch('family_members', adult.id, { family: other.id });
  skipped.push(moved, event);
  const result = await run();
  assert.equal(result.failed, 0);
  for (const record of [due, advance, catchup, assignment]) assert.equal((await reminders(record)).length, 1);
  for (const record of skipped) assert.equal((await reminders(record)).length, 0);
  assert.equal((await reminders(assignment))[0].recipient_member, child.id);
  assert.equal((await list('notifications', `type="item.reminder" && recipient_member="${outsider.id}"`)).length, 0);
  await run();
  assert.equal((await reminders(due)).length, 1, 'retry dedup');
  console.log('PASS timing, none/at-time, 24h boundary, terminal/archive, visibility/family, recipient and retry dedup');
  await patch('family_members', adult.id, { family: family.id });
  await run();
  assert.equal((await reminders(event)).length, 1);
  assert.equal((await reminders(event))[0].recipient_member, adult.id);
  console.log('PASS eligible participant receives inbox reminder after access is restored');
  const batch = [];
  for (let i = 0; i < 105; i++) batch.push(await item({ title: `Batch ${i}` }));
  const first = await run();
  assert.equal(first.scanned, 100, 'hard per-run bound across two pages');
  const second = await run();
  assert.ok(second.scanned < 100, 'cursor continues instead of starving later records');
  for (const record of batch) assert.equal((await reminders(record)).length, 1);
  await run();
  for (const record of batch) assert.equal((await reminders(record)).length, 1);
  console.log('PASS bounded pagination, continuation and dedup across complete sweeps');
  const notice = (await reminders(due))[0];
  const duplicate = await fetch(url + '/api/collections/notifications/records', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ family: notice.family, recipient_member: notice.recipient_member,
      recipient_user: notice.recipient_user, type: notice.type, title: notice.title, body: notice.body,
      occurrence: notice.occurrence, item: notice.item })
  });
  assert.equal(duplicate.status, 400, 'database unique index rejects duplicate');
  const retry = await item({ title: 'Retry after storage failure' });
  const noticeSchema = await request('/api/collections/notifications');
  await request('/api/collections/notifications', { fields: noticeSchema.fields.map((field) =>
    field.name === 'body' ? { ...field, max: 1 } : field) }, 'PATCH');
  try {
    const firstFailurePage = await request('/api/reminder-test/run', { now, resetCursor: true });
    assert.equal(firstFailurePage.failed + (await run()).failed, 1);
    assert.equal((await reminders(retry)).length, 0);
  } finally {
    await request('/api/collections/notifications', { fields: noticeSchema.fields }, 'PATCH');
  }
  await run();
  await run();
  assert.equal((await reminders(retry)).length, 1);
  console.log('PASS registered minute cron, database uniqueness, storage failure rollback and retry');
  const live = await item({ due_at: new Date(Date.now() - 1000).toISOString() });
  for (let attempt = 0; attempt < 2; attempt++) {
    await request('/api/crons/familytime_reminders', {});
    for (let poll = 0; poll < 20; poll++) {
      if ((await reminders(live)).length) break;
      await new Promise((done) => setTimeout(done, 50));
    }
  }
  assert.equal((await reminders(live)).length, 1);
  console.log('PASS actual cron callback creates one inbox reminder with server clock');
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  await rm(dir, { recursive: true, force: true });
}
