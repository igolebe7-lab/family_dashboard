import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupSmokeRun } from './smoke-cleanup.mjs';

test('cleanup uses run-owned IDs, never smoke-looking emails, slugs or titles', async () => {
  const records = {
    families: [{ id: 'mine' }, { id: 'real', slug: 'smoke-family-123' }],
    users: [{ id: 'mine-user' }, { id: 'real-user', email: 'ui.owner.123@familytime.local' },
      { id: 'another-user', email: 'ui..123@familytime.local' }],
    items: [{ id: 'mine-item', family: 'mine' }, { id: 'real-item', family: 'real', title: 'UI smoke real task' }],
    notifications: [{ id: 'mine-notice', family: 'mine' }, { id: 'real-notice', family: 'real' }],
    family_members: [{ id: 'mine-member', family: 'mine' }, { id: 'real-member', family: 'real' }]
  };
  const deleted = await cleanupSmokeRun({
    owned: [{ collection: 'families', id: 'mine' }, { collection: 'users', id: 'mine-user' }],
    list: async (collection, family) => (records[collection] || []).filter((record) => record.family === family),
    remove: async (collection, id) => {
      records[collection] = records[collection].filter((record) => record.id !== id);
    }
  });
  assert.equal(deleted.items, 1);
  assert.deepEqual(records.items.map((record) => record.id), ['real-item']);
  assert.deepEqual(records.families.map((record) => record.id), ['real']);
  assert.deepEqual(records.users.map((record) => record.id), ['real-user', 'another-user']);
  assert.deepEqual(records.notifications.map((record) => record.id), ['real-notice']);
});

test('empty run does not even query or delete pre-existing data', async () => {
  await cleanupSmokeRun({ owned: [], list: () => assert.fail('unexpected list'), remove: () => assert.fail('unexpected delete') });
});

test('partial fixture failure cleans only successfully created roots', async () => {
  const removed = [];
  await cleanupSmokeRun({
    owned: [{ collection: 'users', id: 'partial-user' }],
    list: () => assert.fail('no family created'),
    remove: async (...args) => { removed.push(args); }
  });
  assert.deepEqual(removed, [['users', 'partial-user']]);
});

test('cleanup rejects foreign descendants even if the filtered API returns them', async () => {
  const removed = [];
  await cleanupSmokeRun({
    owned: [{ collection: 'families', id: 'mine' }],
    list: async () => [{ id: 'foreign', family: 'real' }, { id: 'unscoped' }],
    remove: async (...args) => { removed.push(args); }
  });
  assert.deepEqual(removed, [['families', 'mine']]);
});
