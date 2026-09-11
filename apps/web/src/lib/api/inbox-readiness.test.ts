import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIONS } from '$lib/constants/collections';
import { listActivity } from './activity.api';
import { listNotifications, markAllNotificationsRead, notificationDestination } from './notifications.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

const context = { familyId: 'family_1', memberId: 'member_1' };
afterEach(resetPocketBaseClient);

describe('inbox production readiness', () => {
  it('bounds activity pages and disables cross-consumer request cancellation', async () => {
    const getList = vi.fn().mockResolvedValue({ items: [] });
    setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({ getList }) });
    await listActivity(context, 1000, 2);
    expect(getList).toHaveBeenCalledWith(2, 100, expect.objectContaining({ requestKey: null }));
  });

  it('loads a bounded notification page for the active recipient only', async () => {
    const getList = vi.fn().mockResolvedValue({ items: [] });
    setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({ getList }) });
    await listNotifications(context, { page: 3, limit: 1000 });
    expect(getList).toHaveBeenCalledWith(3, 100, expect.objectContaining({
      filter: 'family = "family_1" && recipient_member = "member_1"',
      headers: { 'X-Family-Member-Id': 'member_1' }
    }));
  });

  it('marks more than one page without skipping rows as the unread list shrinks', async () => {
    const rows = Array.from({ length: 105 }, (_, index) => ({
      id: `note_${index}`, family: context.familyId, recipient_member: context.memberId, read_at: ''
    }));
    const getList = vi.fn(async (page: number, limit: number) => ({
      items: rows.filter(row => !row.read_at).slice((page - 1) * limit, page * limit)
    }));
    const update = vi.fn(async (id: string, body: Record<string, unknown>) => {
      const row = rows.find(row => row.id === id)!;
      Object.assign(row, body);
      return row;
    });
    setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: name => {
      expect(name).toBe(COLLECTIONS.notifications);
      return { getList, update };
    } });
    await markAllNotificationsRead(context);
    expect(rows.every(row => Boolean(row.read_at))).toBe(true);
    expect(getList.mock.calls.every(([page]) => page === 1)).toBe(true);
  });

  it('uses the related record kind, not occurrence presence, for navigation', () => {
    expect(notificationDestination({ family: 'f', item: 'item_1', type: 'assignment.created' })?.href).toBe('/app/items/item_1');
    expect(notificationDestination({ family: 'f', expand: { occurrence: { family: 'f', item: 'event_1', kind: 'event' } } })?.href).toBe('/app/items/event_1');
    expect(notificationDestination({ family: 'f', type: 'event.reminder', occurrence: 'o', expand: {
      occurrence: { family: 'f', kind: 'event', start_at: '2026-09-11T12:00:00Z' }
    } })).toEqual({ href: '/app/today?date=2026-09-11&view=day', label: 'Открыть день события' });
    expect(notificationDestination({ family: 'f', expand: { item: { family: 'f', kind: 'task' } } })?.href).toBe('/app/tasks');
    expect(notificationDestination({ family: 'f', type: 'assignment.created' })?.href).toBe('/app/assignments');
    expect(notificationDestination({ family: 'f', expand: { item: { family: 'other', kind: 'task' } } })).toBeNull();
  });
});
