import { afterEach, expect, it, vi } from 'vitest';
import { createItem } from './items.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

afterEach(resetPocketBaseClient);

it.each([undefined, 0, 15])('maps reminder selection %s independently of PB numeric defaults', async (offset) => {
  const create = vi.fn().mockResolvedValue({});
  setPocketBaseClient({
    authStore: { isValid: true, token: 'test', record: { id: 'user' }, clear: vi.fn() },
    collection: () => ({ create })
  });
  await createItem({
    kind: 'task', title: 'Reminder', category: 'home', priority: 'normal',
    visibility: 'private', timezone: 'UTC', reminderOffsetMinutes: offset
  }, { familyId: 'family', memberId: 'member' });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({
    reminder_enabled: offset !== undefined,
    reminder_offset_minutes: offset
  }), expect.anything());
});
