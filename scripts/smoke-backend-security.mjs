import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cleanupSmokeRun } from './smoke-cleanup.mjs';

const url = process.env.PB_URL || 'http://127.0.0.1:8091';
assert.ok(process.env.SMOKE_ISOLATED === '1' && url === 'http://127.0.0.1:8091',
  'Security smoke requires the isolated runner on 127.0.0.1:8091');
const suffix = randomUUID();
const password = 'BackendAudit12345!';
const owned = [];
const failures = [];
let passed = 0;
let admin;

async function request(path, token, body, method = body ? 'POST' : 'GET', headers = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { Authorization: token || '', 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

async function auth(collection, email, secret) {
  const result = await request(`/api/collections/${collection}/auth-with-password`, '', {
    identity: email, password: secret
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.data.token;
}

async function create(collection, token, body) {
  const result = await request(`/api/collections/${collection}/records`, token, body);
  assert.equal(result.status, 200, JSON.stringify(result));
  owned.push([collection, result.data.id]);
  return result.data;
}

async function list(collection, token, filter) {
  const result = await request(`/api/collections/${collection}/records?perPage=200&filter=${encodeURIComponent(filter)}`, token);
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.data.items;
}

async function patch(collection, id, token, body) {
  return request(`/api/collections/${collection}/records/${id}`, token, body, 'PATCH');
}

async function test(name, callback) {
  try {
    await callback();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function denied(result) {
  assert.ok([400, 403, 404].includes(result.status), JSON.stringify(result));
}

try {
  admin = await auth('_superusers', process.env.PB_SUPERUSER_EMAIL || 'admin@familytime.local',
    process.env.PB_SUPERUSER_PASSWORD || 'ChangeMe123456!');
  await test('latest migrations restore relation rules and notification body schema', async () => {
    for (const name of ['items', 'item_occurrences', 'item_activity', 'item_comments', 'notifications']) {
      const schema = await request(`/api/collections/${name}`, admin);
      assert.equal(schema.status, 200);
      for (const key of ['listRule', 'viewRule', 'updateRule', 'deleteRule', 'createRule']) {
        assert.doesNotMatch(schema.data[key] || '', /viewer\.id \?= (?:item\.)?(?:assignees|participants)/);
      }
      if (name === 'notifications') assert.equal(schema.data.fields.find((field) => field.name === 'body').max, 0);
    }
  });
  const actors = {};
  for (const role of ['owner', 'parent', 'adult', 'child', 'teen', 'outsider']) {
    const email = `audit.${role}.${suffix}@familytime.local`;
    const user = await create('users', admin, { email, password, passwordConfirm: password, verified: true });
    actors[role] = { user, token: await auth('users', email, password) };
  }
  const family = await create('families', actors.owner.token, {
    name: 'Backend audit', slug: `audit-${suffix}`, owner_user: actors.owner.user.id, timezone: 'Europe/Amsterdam'
  });
  const otherFamily = await create('families', actors.outsider.token, {
    name: 'Other audit', slug: `audit-other-${suffix}`, owner_user: actors.outsider.user.id, timezone: 'Europe/Amsterdam'
  });
  for (const [role, actor] of Object.entries(actors)) {
    actor.member = await create('family_members', admin, {
      family: role === 'outsider' ? otherFamily.id : family.id,
      user: actor.user.id, display_name: role, role: role === 'outsider' ? 'owner' : role,
      active: true, managed_by: role === 'child' ? [actors.parent.member.id] : []
    });
  }
  const { owner, parent, adult, child, teen, outsider } = actors;
  const base = {
    family: family.id, kind: 'task', title: 'Audit item', created_by: owner.member.id,
    owner: owner.member.id, category: 'home', priority: 'normal', visibility: 'family',
    due_at: '2030-01-01T12:00:00.000Z', timezone: 'Europe/Amsterdam'
  };
  const item = (overrides = {}) => create('items', owner.token, { ...base, ...overrides });
  const occurrence = async (record) => {
    const rows = await list('item_occurrences', admin, `item="${record.id}"`);
    assert.equal(rows.length, 1);
    return rows[0];
  };
  const privateItem = await item({ visibility: 'private' });
  const adultsItem = await item({ visibility: 'adults', participants: [child.member.id, teen.member.id] });
  const familyItem = await item();
  const assignment = await item({ kind: 'assignment', owner: '', visibility: 'assignees',
    assignees: [child.member.id], approval_required: true });
  await test('normalized search covers Russian case, yo, location and remains access scoped', async () => {
    const record = await item({ title: 'Ёлка В ШКОЛЕ', description: 'Зимний праздник', location_text: 'Большой ЗАЛ', visibility: 'private', search_text: 'forged' });
    assert.equal(record.search_text, 'елка в школе зимний праздник большой зал');
    const filter = `id="${record.id}" && search_text ~ "елка" && search_text ~ "зал"`;
    assert.equal((await list('items', owner.token, filter)).length, 1);
    assert.equal((await list('items', child.token, filter)).length, 0);
    assert.equal((await list('items', outsider.token, filter)).length, 0);
    const updated = await patch('items', record.id, owner.token, { title: 'Поход', search_text: 'forged' });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.search_text, 'поход зимний праздник большой зал');
    assert.equal((await list('items', owner.token, filter)).length, 0);
  });
  for (const kind of ['task', 'assignment']) {
    await test(`undated ${kind} materializes a backlog occurrence`, async () => {
      const record = await item({ kind, due_at: '', assignees: kind === 'assignment' ? [child.member.id] : [] });
      const row = await occurrence(record);
      assert.equal(row.due_at, '');
      assert.equal(row.start_at, '');
      assert.equal(row.status, kind === 'assignment' ? 'assigned' : 'todo');
      assert.equal((await list('item_occurrences', kind === 'assignment' ? child.token : owner.token, `item="${record.id}"`)).length, 1);
    });
  }
  await test('assignee and managing parent can list assignment', async () => {
    for (const actor of [owner, child, parent]) {
      assert.equal((await list('items', actor.token, `id="${assignment.id}"`)).length, 1,
        `role=${actor.member.role}; visible_to=${JSON.stringify(assignment.visible_to)}`);
    }
  });

  for (const record of [privateItem, adultsItem, familyItem, assignment]) {
    await create('item_comments', admin, {
      family: family.id, item: record.id, author: owner.member.id, text: 'Visibility audit'
    });
  }

  for (const [name, record, hidden] of [
    ['private', privateItem, child], ['private unrelated adult', privateItem, adult],
    ['adults explicit child', adultsItem, child], ['adults explicit teen', adultsItem, teen],
    ['assignees unrelated adult', assignment, adult], ['other family', familyItem, outsider]
  ]) {
    for (const collection of ['items', 'item_occurrences', 'item_activity', 'item_comments']) {
      await test(`${name} hidden in ${collection}`, async () => {
        const filter = collection === 'items' ? `id="${record.id}"` : `item="${record.id}"`;
        assert.equal((await list(collection, hidden.token, filter)).length, 0);
        const existing = await list(collection, admin, filter);
        assert.ok(existing.length > 0, `${collection}: fixture must exist`);
        for (const row of existing) {
          denied(await request(`/api/collections/${collection}/records/${row.id}`, hidden.token));
        }
      });
    }
  }
  await test('private participant receives no notification', async () => {
    const record = await item({ kind: 'event', visibility: 'private', participants: [child.member.id],
      start_at: '2030-01-01T12:00:00.000Z', end_at: '2030-01-01T13:00:00.000Z' });
    assert.equal((await list('notifications', admin, `item="${record.id}"`)).length, 0);
  });
  await test('adults participant receives no notification', async () => {
    const record = await item({ kind: 'event', visibility: 'adults', participants: [child.member.id],
      start_at: '2030-01-01T12:00:00.000Z', end_at: '2030-01-01T13:00:00.000Z' });
    assert.equal((await list('notifications', admin, `item="${record.id}"`)).length, 0);
  });
  for (const field of ['owner', 'participants', 'assignees']) {
    await test(`cross-family ${field} rejected before persistence`, async () => {
      const title = `Cross family ${field}`;
      const result = await request('/api/collections/items/records', owner.token, {
        ...base, title, [field]: field === 'owner' ? outsider.member.id : [outsider.member.id]
      });
      denied(result);
      assert.equal((await list('items', admin, `family="${family.id}" && title="${title}"`)).length, 0);
    });
  }
  await test('child cannot delete assignment', async () => {
    const record = await item({ kind: 'assignment', owner: '', assignees: [child.member.id] });
    denied(await request(`/api/collections/items/records/${record.id}`, child.token, undefined, 'DELETE'));
  });
  await test('unrelated reader cannot replace item creator', async () => {
    const record = await item();
    denied(await patch('items', record.id, adult.token, { created_by: adult.member.id, title: 'Hijacked' }));
  });
  await test('authenticated user cannot forge occurrence', async () => {
    denied(await request('/api/collections/item_occurrences/records', outsider.token, {
      family: family.id, item: familyItem.id, kind: 'task', title_snapshot: 'Forged',
      category_snapshot: 'home', status: 'todo', visible_to: [outsider.member.id]
    }));
  });
  for (const [name, body] of [
    ['snapshot', { title_snapshot: 'Forged title' }],
    ['family', { family: otherFamily.id }],
    ['visibility', { visible_to: [outsider.member.id] }],
    ['completion attribution', { completed_by: owner.member.id }],
    ['kind bypass', { kind: 'task', status: 'done' }]
  ]) {
    await test(`child cannot forge occurrence ${name}`, async () => {
      const record = await item({ kind: 'assignment', owner: '', assignees: [child.member.id] });
      const row = await occurrence(record);
      denied(await patch('item_occurrences', row.id, child.token, body));
    });
  }
  await test('unrelated reader cannot mark personal task done', async () => {
    const row = await occurrence(await item());
    denied(await patch('item_occurrences', row.id, adult.token, { status: 'done' }));
  });
  await test('informational event rejects work statuses but permits cancellation', async () => {
    const record = await item({ kind: 'event', start_at: '2030-01-01T12:00:00.000Z',
      end_at: '2030-01-01T13:00:00.000Z' });
    const row = await occurrence(record);
    for (const status of ['in_progress', 'done', 'approved', 'rejected', 'accepted', 'skipped']) {
      denied(await patch('item_occurrences', row.id, owner.token, { status }));
      assert.equal((await occurrence(record)).status, row.status);
    }
    const unchanged = await patch('item_occurrences', row.id, owner.token, { status: row.status });
    assert.equal(unchanged.status, 200);
    const cancelled = await patch('item_occurrences', row.id, owner.token, { status: 'cancelled' });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled));
    assert.equal(cancelled.data.status, 'cancelled');
    assert.equal(cancelled.data.completed_by, '');
    assert.equal(cancelled.data.approved_by, '');
  });
  await test('unrelated reader cannot accept assignment', async () => {
    const record = await item({ kind: 'assignment', owner: '', assignees: [child.member.id] });
    denied(await patch('item_occurrences', (await occurrence(record)).id, adult.token, { status: 'accepted' }));
  });
  await test('child done, parent approve, notifications and feed, duplicate retry', async () => {
    const row = await occurrence(assignment);
    const done = await patch('item_occurrences', row.id, child.token, { status: 'done' });
    assert.equal(done.status, 200, JSON.stringify(done));
    assert.equal(done.data.completed_by, child.member.id);
    denied(await patch('item_occurrences', row.id, child.token, { status: 'approved' }));
    assert.equal((await list('notifications', parent.token, `occurrence="${row.id}" && type="assignment.done_waiting_approval"`)).length, 1);
    const approved = await patch('item_occurrences', row.id, parent.token, { status: 'approved' });
    assert.equal(approved.status, 200, JSON.stringify(approved));
    assert.equal(approved.data.approved_by, parent.member.id);
    assert.equal((await patch('item_occurrences', row.id, parent.token, { status: 'approved' })).status, 200);
    assert.equal((await list('item_activity', parent.token, `occurrence="${row.id}" && action="assignment.done"`)).length, 1);
    assert.equal((await list('item_activity', parent.token, `occurrence="${row.id}" && action="assignment.approved"`)).length, 1);
    assert.equal((await list('notifications', child.token, `occurrence="${row.id}" && type="assignment.approved"`)).length, 1);
  });
  await test('managing parent can mark child done', async () => {
    const record = await item({ kind: 'assignment', owner: '', visibility: 'assignees', assignees: [child.member.id] });
    const result = await patch('item_occurrences', (await occurrence(record)).id, parent.token, { status: 'done' });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.completed_by, parent.member.id);
  });
  for (const approvalRequired of [false, true]) {
    await test(`parent Done stays independent of approval_required=${approvalRequired}`, async () => {
      const record = await item({ kind: 'assignment', owner: '', visibility: 'assignees',
        assignees: [child.member.id], approval_required: approvalRequired });
      const row = await occurrence(record);
      const done = await patch('item_occurrences', row.id, parent.token, { status: 'done' });
      assert.equal(done.status, 200, JSON.stringify(done));
      assert.equal(done.data.status, 'done');
      assert.equal(done.data.completed_by, parent.member.id);
      assert.equal(done.data.approved_by, '');
      assert.equal(done.data.approved_at, '');
      assert.equal((await list('notifications', owner.token,
        `occurrence="${row.id}" && type="assignment.done_waiting_approval"`)).length, approvalRequired ? 1 : 0);
      const review = await patch('item_occurrences', row.id, owner.token, { status: 'approved' });
      if (approvalRequired) {
        assert.equal(review.status, 200, JSON.stringify(review));
        assert.equal(review.data.completed_by, parent.member.id);
        assert.equal(review.data.approved_by, owner.member.id);
      } else {
        denied(review);
        assert.equal((await occurrence(record)).status, 'done');
      }
    });
  }
  await test('member header cannot impersonate a parent; managed child attribution works', async () => {
    const record = await item({ kind: 'assignment', owner: '', visibility: 'assignees', assignees: [child.member.id] });
    const row = await occurrence(record);
    const path = `/api/collections/item_occurrences/records/${row.id}`;
    denied(await request(path, child.token, { status: 'done' }, 'PATCH', { 'X-Family-Member-Id': parent.member.id }));
    denied(await request(path, owner.token, { status: 'done' }, 'PATCH', { 'X-Family-Member-Id': parent.member.id }));
    denied(await request(path, parent.token, { status: 'done' }, 'PATCH', { 'X-Family-Member-Id': owner.member.id }));
    denied(await request(path, parent.token, { status: 'done' }, 'PATCH', { 'X-Family-Member-Id': outsider.member.id }));
    const result = await request(path, parent.token, { status: 'done' }, 'PATCH', { 'X-Family-Member-Id': child.member.id });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.completed_by, child.member.id);
  });
  await test('rejected assignment can resume without a false done activity', async () => {
    const record = await item({ kind: 'assignment', owner: '', assignees: [child.member.id], approval_required: true });
    const row = await occurrence(record);
    assert.equal((await patch('item_occurrences', row.id, child.token, { status: 'done' })).status, 200);
    assert.equal((await patch('item_occurrences', row.id, parent.token, { status: 'rejected', rejection_reason: 'Try again' })).status, 200);
    const resumed = await patch('item_occurrences', row.id, child.token, { status: 'in_progress' });
    assert.equal(resumed.status, 200);
    assert.equal(resumed.data.rejection_reason, '');
    assert.equal((await list('item_activity', child.token, `occurrence="${row.id}" && action="assignment.done"`)).length, 1);
  });
  await test('metadata update refreshes calendar snapshot and preserves identity', async () => {
    const record = await item();
    const result = await patch('items', record.id, owner.token, { title: 'Updated metadata', description: 'Details', location_text: 'Kitchen' });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.description, 'Details');
    assert.equal(result.data.location_text, 'Kitchen');
    assert.equal((await occurrence(record)).title_snapshot, 'Updated metadata');
    denied(await patch('items', record.id, adult.token, { title: 'Unauthorized' }));
    denied(await patch('items', record.id, owner.token, { family: otherFamily.id }));
    denied(await patch('items', record.id, owner.token, { kind: 'assignment' }));
  });
  await test('actual event metadata edits log once and notify only visible participants', async () => {
    const record = await item({ kind: 'event', visibility: 'adults', participants: [adult.member.id, child.member.id],
      start_at: '2030-01-01T12:00:00.000Z', end_at: '2030-01-01T13:00:00.000Z' });
    const metadata = { title: 'Edited event', description: 'New description', location_text: 'Hall' };
    assert.equal((await patch('items', record.id, owner.token, metadata)).status, 200);
    assert.equal((await patch('items', record.id, owner.token, metadata)).status, 200);
    const activity = await list('item_activity', adult.token, `item="${record.id}" && action="item.updated"`);
    assert.equal(activity.length, 1);
    assert.equal(activity[0].actor, owner.member.id);
    assert.equal(activity[0].old_value_json.title, record.title);
    assert.equal(activity[0].new_value_json.title, metadata.title);
    assert.equal((await list('notifications', adult.token, `item="${record.id}"`)).length, 2);
    assert.equal((await list('notifications', child.token, `item="${record.id}"`)).length, 0);
    assert.equal((await list('item_activity', child.token, `item="${record.id}"`)).length, 0);
  });
  await test('expand=item respects item visibility', async () => {
    const result = await request(`/api/collections/item_occurrences/records?expand=item&filter=${encodeURIComponent(`item="${assignment.id}"`)}`, child.token);
    assert.equal(result.status, 200);
    assert.equal(result.data.items[0].expand.item.id, assignment.id);
    const hidden = await request(`/api/collections/item_occurrences/records?expand=item&filter=${encodeURIComponent(`item="${privateItem.id}"`)}`, child.token);
    assert.equal(hidden.data.totalItems, 0);
  });
  await test('visibility change revokes occurrence, feed and old notifications', async () => {
    const record = await item({ kind: 'event', participants: [child.member.id],
      start_at: '2030-01-01T12:00:00.000Z', end_at: '2030-01-01T13:00:00.000Z' });
    assert.equal((await patch('items', record.id, owner.token, { visibility: 'private' })).status, 200);
    for (const collection of ['item_occurrences', 'item_activity', 'notifications']) {
      assert.equal((await list(collection, child.token, `item="${record.id}"`)).length, 0, collection);
    }
  });
  await test('notification recipient cannot redirect notification', async () => {
    const rows = await list('notifications', child.token, `item="${assignment.id}"`);
    denied(await patch('notifications', rows[0].id, child.token, { recipient_user: outsider.user.id }));
    assert.equal((await patch('notifications', rows[0].id, child.token, { read_at: new Date().toISOString() })).status, 200);
  });
  await test('private comments hidden; forged cross-family comment rejected', async () => {
    await create('item_comments', admin, { family: family.id, item: privateItem.id, author: owner.member.id, text: 'Secret' });
    assert.equal((await list('item_comments', child.token, `item="${privateItem.id}"`)).length, 0);
    denied(await request('/api/collections/item_comments/records', owner.token, {
      family: family.id, item: privateItem.id, author: outsider.member.id, text: 'Forged'
    }));
  });
  await test('inactive member loses existing item, occurrence and feed access', async () => {
    assert.equal((await patch('family_members', child.member.id, admin, { active: false })).status, 200);
    for (const collection of ['items', 'item_occurrences', 'item_activity', 'notifications']) {
      assert.equal((await list(collection, child.token, `family="${family.id}"`)).length, 0, collection);
    }
    assert.equal((await patch('family_members', child.member.id, admin, { active: true })).status, 200);
  });
  await test('new active family member sees existing family items', async () => {
    const member = await create('family_members', admin, {
      family: family.id, user: outsider.user.id, display_name: 'New member', role: 'adult', active: true
    });
    assert.equal((await list('items', outsider.token, `id="${familyItem.id}"`)).length, 1);
    assert.equal((await list('items', outsider.token, `id="${privateItem.id}"`)).length, 0);
    assert.equal((await patch('family_members', member.id, admin, { active: false })).status, 200);
  });
  await test('adult role in another family cannot bypass child visibility', async () => {
    await create('family_members', admin, {
      family: otherFamily.id, user: child.user.id, display_name: 'Other family adult', role: 'adult', active: true
    });
    for (const record of [privateItem, adultsItem]) {
      for (const collection of ['items', 'item_occurrences', 'item_activity', 'item_comments']) {
        const filter = collection === 'items' ? `id="${record.id}"` : `item="${record.id}"`;
        assert.equal((await list(collection, child.token, filter)).length, 0, collection);
      }
    }
  });
  await test('removing managed_by revokes parent assignment access immediately', async () => {
    assert.equal((await patch('family_members', child.member.id, admin, { managed_by: [] })).status, 200);
    try {
      for (const collection of ['items', 'item_occurrences', 'item_activity', 'item_comments', 'notifications']) {
        const filter = collection === 'items' ? `id="${assignment.id}"` : `item="${assignment.id}"`;
        assert.equal((await list(collection, parent.token, filter)).length, 0, collection);
      }
    } finally {
      assert.equal((await patch('family_members', child.member.id, admin, { managed_by: [parent.member.id] })).status, 200);
    }
  });
  // Fault injection changes schema only in the runner-owned temporary database.
  if (process.env.SMOKE_ISOLATED === '1') {
    await test('notification persistence failure rolls back item and transition', async () => {
      const record = await item({ kind: 'assignment', owner: '', assignees: [child.member.id], approval_required: true });
      const row = await occurrence(record);
      const path = '/api/collections/notifications';
      const schema = (await request(path, admin)).data;
      const fields = schema.fields.map((field) => field.name === 'body' ? { ...field, max: 1 } : field);
      assert.equal((await request(path, admin, { fields }, 'PATCH')).status, 200);
      try {
        const failedCreate = await request('/api/collections/items/records', owner.token, {
          ...base, kind: 'assignment', owner: '', assignees: [child.member.id], title: 'Atomic failure'
        });
        assert.notEqual(failedCreate.status, 200);
        assert.equal((await list('items', admin, `family="${family.id}" && title="Atomic failure"`)).length, 0);
        const failedDone = await patch('item_occurrences', row.id, child.token, { status: 'done' });
        assert.notEqual(failedDone.status, 200);
        assert.equal((await occurrence(record)).status, 'assigned');
        assert.equal((await list('item_activity', admin, `occurrence="${row.id}"`)).length, 0);
      } finally {
        assert.equal((await request(path, admin, { fields: schema.fields }, 'PATCH')).status, 200);
        const restored = await request(path, admin);
        assert.deepEqual(restored.data.fields, schema.fields);
      }
    });
  }
} finally {
  // Only descendants of families created by this run, never email/title heuristics.
  if (admin) {
    await cleanupSmokeRun({
      owned: owned.map(([collection, id]) => ({ collection, id })),
      list: (collection, family) => list(collection, admin, `family="${family}"`),
      remove: async (collection, id) => {
        const result = await request(`/api/collections/${collection}/records/${id}`, admin, undefined, 'DELETE');
        assert.ok([204, 404].includes(result.status), `cleanup ${collection}: ${JSON.stringify(result)}`);
      }
    });
  }
}
console.log(JSON.stringify({ passed, failed: failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
