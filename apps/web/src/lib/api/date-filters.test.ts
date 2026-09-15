import { afterEach, expect, it, vi } from 'vitest';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';
import { listNotifications } from './notifications.api';
import { listEventSchedule } from './schedule.api';

afterEach(() => { resetPocketBaseClient(); vi.useRealTimers(); });
const context = { familyId: 'family', memberId: 'parent' };
function setup() {
  const getList = vi.fn().mockResolvedValue({ items: [] });
  setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({ getList }) });
  return getList;
}
it('limits mark-as-read snapshots to the exact instant, not the entire UTC day', async () => {
  const getList = setup();
  await listNotifications(context, { createdBefore: '2026-09-14T18:00:00+03:00' });
  expect(getList.mock.calls[0][2].filter).toContain('created <= "2026-09-14 15:00:00.000Z"');
});
it('normalizes schedule editor range boundaries without changing the materialization window', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
  const getList = setup();
  await listEventSchedule(context, 'item');
  expect(getList.mock.calls[0][2].filter).toContain('start_at >= "2026-08-15 12:00:00.000Z"');
  expect(getList.mock.calls[0][2].filter).toContain('start_at < "2026-12-13 12:00:00.000Z"');
});
