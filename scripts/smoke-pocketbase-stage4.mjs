const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL || 'admin@familytime.local';
const SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD || 'ChangeMe123456!';
const KEEP_SMOKE_DATA = process.env.SMOKE_KEEP_DATA === '1';
const CLEANUP_BEFORE = process.env.SMOKE_CLEANUP_BEFORE !== '0';
const CLEANUP_AFTER = process.env.SMOKE_CLEANUP_AFTER !== '0' && !KEEP_SMOKE_DATA;

const FAMILY_SCOPED_COLLECTIONS = [
  'notifications',
  'item_activity',
  'item_comments',
  'item_occurrences',
  'items',
  'day_annotations',
  'invitations',
  'family_members'
];
const ITEM_SCOPED_COLLECTIONS = [
  'notifications',
  'item_activity',
  'item_comments',
  'item_occurrences'
];
const UI_SMOKE_TITLE_PATTERNS = [/^UI smoke /, /^Login smoke /, /^direct api /, /^Draft QA /];

const suffix = `${Date.now()}`;
const parentPassword = 'ParentPass12345!';
const childPassword = 'ChildPass12345!';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const { token, body, headers = {}, method = body ? 'POST' : 'GET', expectOk = true } = options;
  const response = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (expectOk && !response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
  }

  return { response, data };
}

async function auth(collection, identity, password) {
  const { data } = await request(`/api/collections/${collection}/auth-with-password`, {
    body: { identity, password }
  });
  return data;
}

async function createRecord(collection, token, body) {
  const { data } = await request(`/api/collections/${collection}/records`, { token, body });
  return data;
}

async function listRecords(collection, token, filter) {
  const query = filter ? `?filter=${encodeURIComponent(filter)}` : '';
  const { data } = await request(`/api/collections/${collection}/records${query}`, { token });
  return data;
}

async function listAllRecords(collection, token) {
  const items = [];
  let page = 1;

  while (true) {
    const query = new URLSearchParams({
      page: `${page}`,
      perPage: '200'
    });
    const { data } = await request(`/api/collections/${collection}/records?${query}`, { token });
    items.push(...data.items);

    if (page >= data.totalPages) break;
    page += 1;
  }

  return items;
}

async function deleteRecord(collection, token, id) {
  await request(`/api/collections/${collection}/records/${id}`, {
    token,
    method: 'DELETE'
  });
}

function relationIds(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [value];
  return [];
}

function isSmokeUser(user) {
  return /^(parent|parent\.helper|child)\.\d+@familytime\.local$/.test(user.email ?? '');
}

function isSmokeFamily(family) {
  return typeof family.slug === 'string' && family.slug.startsWith('smoke-family-');
}

function isUiSmokeItem(item) {
  return UI_SMOKE_TITLE_PATTERNS.some((pattern) => pattern.test(item.title ?? ''));
}

async function deleteCollectionRecords(collection, token, records, deleted) {
  for (const record of records) {
    await deleteRecord(collection, token, record.id);
    deleted[collection] = (deleted[collection] ?? 0) + 1;
  }
}

async function cleanupSmokeData(token) {
  const deleted = {};
  const families = await listAllRecords('families', token);
  const smokeFamilies = families.filter(isSmokeFamily);
  const smokeFamilyIds = new Set(smokeFamilies.map((family) => family.id));

  for (const collection of FAMILY_SCOPED_COLLECTIONS) {
    const records = await listAllRecords(collection, token);
    const recordsToDelete = records.filter((record) =>
      relationIds(record.family).some((familyId) => smokeFamilyIds.has(familyId))
    );
    await deleteCollectionRecords(collection, token, recordsToDelete, deleted);
  }

  await deleteCollectionRecords('families', token, smokeFamilies, deleted);

  const items = await listAllRecords('items', token);
  const uiSmokeItems = items.filter(isUiSmokeItem);
  const uiSmokeItemIds = new Set(uiSmokeItems.map((item) => item.id));

  for (const collection of ITEM_SCOPED_COLLECTIONS) {
    const records = await listAllRecords(collection, token);
    const recordsToDelete = records.filter((record) =>
      relationIds(record.item).some((itemId) => uiSmokeItemIds.has(itemId))
    );
    await deleteCollectionRecords(collection, token, recordsToDelete, deleted);
  }

  await deleteCollectionRecords('items', token, uiSmokeItems, deleted);

  const users = await listAllRecords('users', token);
  const smokeUsers = users.filter(isSmokeUser);
  await deleteCollectionRecords('users', token, smokeUsers, deleted);

  return deleted;
}

async function expectRejected(label, callback, expectedStatus = 400) {
  const result = await callback();
  assert(
    result.response.status === expectedStatus,
    `${label} expected ${expectedStatus}, got ${result.response.status}`
  );
}

const superuserAuth = await auth('_superusers', SUPERUSER_EMAIL, SUPERUSER_PASSWORD);
const superToken = superuserAuth.token;
const cleanupBefore = CLEANUP_BEFORE ? await cleanupSmokeData(superToken) : null;

const parentEmail = `parent.${suffix}@familytime.local`;
const childEmail = `child.${suffix}@familytime.local`;

const parentUser = await createRecord('users', superToken, {
  email: parentEmail,
  password: parentPassword,
  passwordConfirm: parentPassword,
  verified: true
});

const childUser = await createRecord('users', superToken, {
  email: childEmail,
  password: childPassword,
  passwordConfirm: childPassword,
  verified: true
});

const helperParentEmail = `parent.helper.${suffix}@familytime.local`;
const helperParentUser = await createRecord('users', superToken, {
  email: helperParentEmail,
  password: parentPassword,
  passwordConfirm: parentPassword,
  verified: true
});

const parentAuth = await auth('users', parentEmail, parentPassword);
const childAuth = await auth('users', childEmail, childPassword);
const helperParentAuth = await auth('users', helperParentEmail, parentPassword);

const family = await createRecord('families', parentAuth.token, {
  name: `Smoke Family ${suffix}`,
  slug: `smoke-family-${suffix}`,
  owner_user: parentUser.id,
  timezone: 'Europe/Amsterdam'
});

const parentMember = await createRecord('family_members', parentAuth.token, {
  family: family.id,
  user: parentUser.id,
  display_name: 'Мама',
  role: 'owner',
  color_key: 'peach',
  color_hex: '#F59E8B',
  active: true
});

const childMember = await createRecord('family_members', parentAuth.token, {
  family: family.id,
  user: childUser.id,
  display_name: 'Миша',
  role: 'child',
  color_key: 'blue',
  color_hex: '#7BA7E8',
  managed_by: [parentMember.id],
  created_by: parentMember.id,
  active: true
});

const helperParentMember = await createRecord('family_members', parentAuth.token, {
  family: family.id,
  user: helperParentUser.id,
  display_name: 'Папа',
  role: 'parent',
  color_key: 'blue',
  color_hex: '#7BA7E8',
  created_by: parentMember.id,
  active: true
});

const validEvent = await createRecord('items', parentAuth.token, {
  family: family.id,
  kind: 'event',
  title: 'Школьное собрание',
  created_by: parentMember.id,
  category: 'school',
  priority: 'normal',
  visibility: 'family',
  all_day: false,
  start_at: '2026-06-09T08:00:00.000Z',
  end_at: '2026-06-09T09:00:00.000Z',
  timezone: 'Europe/Amsterdam',
  approval_required: false,
  archived: false
});

assert(validEvent.participants.includes(parentMember.id), 'event participants default was not applied');
assert(validEvent.visible_to.includes(parentMember.id), 'event is not visible to parent');
assert(validEvent.visible_to.includes(childMember.id), 'family event is not visible to child');

const eventOccurrences = await listRecords(
  'item_occurrences',
  parentAuth.token,
  `item="${validEvent.id}"`
);
assert(eventOccurrences.totalItems === 1, 'event occurrence was not materialized');
assert(
  eventOccurrences.items[0].visible_to.includes(childMember.id),
  'event occurrence did not copy visible_to'
);

await expectRejected('event end before start', () =>
  request('/api/collections/items/records', {
    token: parentAuth.token,
    expectOk: false,
    body: {
      family: family.id,
      kind: 'event',
      title: 'Некорректное событие',
      created_by: parentMember.id,
      category: 'family',
      priority: 'normal',
      visibility: 'family',
      all_day: false,
      start_at: '2026-06-09T12:00:00.000Z',
      end_at: '2026-06-09T11:00:00.000Z',
      timezone: 'Europe/Amsterdam',
      approval_required: false,
      archived: false
    }
  })
);

await expectRejected('assignment without assignee', () =>
  request('/api/collections/items/records', {
    token: parentAuth.token,
    expectOk: false,
    body: {
      family: family.id,
      kind: 'assignment',
      title: 'Пустое поручение',
      created_by: parentMember.id,
      category: 'home',
      priority: 'normal',
      visibility: 'assignees',
      due_at: '2026-06-09T18:00:00.000Z',
      timezone: 'Europe/Amsterdam',
      approval_required: true,
      archived: false
    }
  })
);

const assignment = await createRecord('items', parentAuth.token, {
  family: family.id,
  kind: 'assignment',
  title: 'Собрать рюкзак',
  created_by: parentMember.id,
  assignees: [childMember.id],
  category: 'school',
  priority: 'normal',
  visibility: 'assignees',
  due_at: '2026-06-09T18:00:00.000Z',
  timezone: 'Europe/Amsterdam',
  approval_required: true,
  archived: false
});

assert(assignment.visible_to.includes(parentMember.id), 'assignment is not visible to parent');
assert(assignment.visible_to.includes(childMember.id), 'assignment is not visible to assignee child');

const assignmentOccurrences = await listRecords(
  'item_occurrences',
  childAuth.token,
  `item="${assignment.id}"`
);
assert(assignmentOccurrences.totalItems === 1, 'child cannot see assignment occurrence');
assert(assignmentOccurrences.items[0].status === 'assigned', 'assignment occurrence status is not assigned');

const assignmentNotifications = await listRecords(
  'notifications',
  childAuth.token,
  `item="${assignment.id}"`
);
assert(assignmentNotifications.totalItems === 1, 'assignment notification was not created for child');

const parentDoneAssignment = await createRecord('items', parentAuth.token, {
  family: family.id,
  kind: 'assignment',
  title: 'Проверить дневник',
  created_by: parentMember.id,
  assignees: [childMember.id],
  category: 'school',
  priority: 'normal',
  visibility: 'assignees',
  due_at: '2026-06-09T19:00:00.000Z',
  timezone: 'Europe/Amsterdam',
  approval_required: true,
  archived: false
});
const parentDoneOccurrences = await listRecords(
  'item_occurrences',
  parentAuth.token,
  `item="${parentDoneAssignment.id}"`
);
const parentDoneOccurrenceId = parentDoneOccurrences.items[0].id;
const parentDoneResult = await request(
  `/api/collections/item_occurrences/records/${parentDoneOccurrenceId}`,
  {
    token: parentAuth.token,
    method: 'PATCH',
    headers: { 'X-Family-Member-Id': parentMember.id },
    body: { status: 'done' }
  }
);
assert(parentDoneResult.data.status === 'done', 'parent could not mark child assignment done');
assert(
  parentDoneResult.data.completed_by === parentMember.id,
  'parent done transition did not record completed_by'
);

const parentApprovedResult = await request(
  `/api/collections/item_occurrences/records/${parentDoneOccurrenceId}`,
  {
    token: parentAuth.token,
    method: 'PATCH',
    headers: { 'X-Family-Member-Id': parentMember.id },
    body: { status: 'approved' }
  }
);
assert(parentApprovedResult.data.status === 'approved', 'parent could not approve assignment');
assert(
  parentApprovedResult.data.approved_by === parentMember.id,
  'approval transition did not record approved_by'
);

const childDoneAssignment = await createRecord('items', parentAuth.token, {
  family: family.id,
  kind: 'assignment',
  title: 'Полить цветы',
  created_by: parentMember.id,
  assignees: [childMember.id],
  category: 'home',
  priority: 'normal',
  visibility: 'assignees',
  due_at: '2026-06-09T19:30:00.000Z',
  timezone: 'Europe/Amsterdam',
  approval_required: true,
  archived: false
});
const childDoneOccurrences = await listRecords(
  'item_occurrences',
  childAuth.token,
  `item="${childDoneAssignment.id}"`
);
const childDoneOccurrenceId = childDoneOccurrences.items[0].id;
await request(`/api/collections/item_occurrences/records/${childDoneOccurrenceId}`, {
  token: childAuth.token,
  method: 'PATCH',
  headers: { 'X-Family-Member-Id': childMember.id },
  body: { status: 'done' }
});
const childDoneActivity = await listRecords(
  'item_activity',
  parentAuth.token,
  `occurrence="${childDoneOccurrenceId}" && action="assignment.done"`
);
assert(childDoneActivity.totalItems === 1, 'child done activity was not recorded');
const waitingApprovalNotifications = await listRecords(
  'notifications',
  parentAuth.token,
  `occurrence="${childDoneOccurrenceId}" && type="assignment.done_waiting_approval"`
);
assert(
  waitingApprovalNotifications.totalItems === 1,
  'parent notification was not created for child done assignment'
);
await request(`/api/collections/item_occurrences/records/${childDoneOccurrenceId}`, {
  token: parentAuth.token,
  method: 'PATCH',
  headers: { 'X-Family-Member-Id': parentMember.id },
  body: { status: 'approved' }
});
const childApprovedActivity = await listRecords(
  'item_activity',
  parentAuth.token,
  `occurrence="${childDoneOccurrenceId}" && action="assignment.approved"`
);
assert(childApprovedActivity.totalItems === 1, 'approval activity was not recorded');
const approvedNotifications = await listRecords(
  'notifications',
  childAuth.token,
  `occurrence="${childDoneOccurrenceId}" && type="assignment.approved"`
);
assert(approvedNotifications.totalItems === 1, 'child approval notification was not created');

const helperAssignment = await createRecord('items', helperParentAuth.token, {
  family: family.id,
  kind: 'assignment',
  title: 'Собрать форму',
  created_by: helperParentMember.id,
  assignees: [childMember.id],
  category: 'sport',
  priority: 'normal',
  visibility: 'assignees',
  due_at: '2026-06-09T20:30:00.000Z',
  timezone: 'Europe/Amsterdam',
  approval_required: true,
  archived: false
});
assert(
  helperAssignment.visible_to.includes(parentMember.id),
  'managed child parent was not included in assignees visibility'
);
const managedParentVisibleList = await listRecords(
  'items',
  parentAuth.token,
  `id="${helperAssignment.id}"`
);
assert(
  managedParentVisibleList.totalItems === 1,
  'parent cannot list assignment for managed child created by another parent'
);

const adultsTask = await createRecord('items', parentAuth.token, {
  family: family.id,
  kind: 'task',
  title: 'Оплатить счета',
  created_by: parentMember.id,
  owner: parentMember.id,
  category: 'money',
  priority: 'normal',
  visibility: 'adults',
  due_at: '2026-06-09T20:00:00.000Z',
  timezone: 'Europe/Amsterdam',
  approval_required: false,
  archived: false
});

const privateTask = await createRecord('items', parentAuth.token, {
  family: family.id,
  kind: 'task',
  title: 'Личная заметка',
  created_by: parentMember.id,
  owner: parentMember.id,
  category: 'other',
  priority: 'normal',
  visibility: 'private',
  due_at: '2026-06-09T21:00:00.000Z',
  timezone: 'Europe/Amsterdam',
  approval_required: false,
  archived: false
});

const childAdultsList = await listRecords('items', childAuth.token, `id="${adultsTask.id}"`);
assert(childAdultsList.totalItems === 0, 'child can list adults-only item');

const childPrivateList = await listRecords('items', childAuth.token, `id="${privateTask.id}"`);
assert(childPrivateList.totalItems === 0, 'child can list private item');

await expectRejected(
  'child direct adults-only item view',
  () =>
    request(`/api/collections/items/records/${adultsTask.id}`, {
      token: childAuth.token,
      expectOk: false
    }),
  404
);

const cleanupAfter = CLEANUP_AFTER ? await cleanupSmokeData(superToken) : null;

console.log(
  JSON.stringify(
    {
      family: family.id,
      parentMember: parentMember.id,
      childMember: childMember.id,
      event: validEvent.id,
      assignment: assignment.id,
      checks: [
        'event occurrence materialized',
        'invalid event rejected',
        'assignment without assignee rejected',
        'assignment notification created',
        'parent can mark child assignment done',
        'assignment approval records approver',
        'child done notifies parent for approval',
        'child done writes activity feed event',
        'parent approval writes activity feed event',
        'parent approval notifies child',
        'managed child parent sees assignee-visible assignment',
        'child cannot list adults/private items'
      ],
      cleanup: {
        before: cleanupBefore,
        after: cleanupAfter,
        retained: KEEP_SMOKE_DATA
      }
    },
    null,
    2
  )
);
