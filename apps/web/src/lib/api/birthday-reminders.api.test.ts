import { afterEach, describe, expect, it, vi } from 'vitest';
import { listUpcomingBirthdayAnnotations, subscribeDayAnnotations } from './day-annotations.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

afterEach(resetPocketBaseClient);
const context = { familyId: 'family_1', memberId: 'member_1' };

describe('birthday reminder range', () => {
  it('loads only four civil dates and drains paginated results across New Year', async () => {
    const getList = vi.fn().mockResolvedValueOnce({ items: Array.from({ length: 100 }, (_, i) => ({ id: `date_${i}` })), totalPages: 2 })
      .mockResolvedValueOnce({ items: [{ id: 'last' }], totalPages: 2 });
    setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({ getList }) });
    expect((await listUpcomingBirthdayAnnotations(context, '2026-12-29')).length).toBe(101);
    expect(getList.mock.calls.map(call => call[0])).toEqual([1, 2]);
    const options = getList.mock.calls[0][2];
    expect(options.headers).toEqual({ 'X-Family-Member-Id': context.memberId });
    expect(options.filter).toContain('family = "family_1" && kind = "birthday"');
    expect(options.filter).toContain('month = 12 && day = 29');
    expect(options.filter).toContain('month = 1 && day = 1');
    expect(options.filter).toContain('year = 2027');
    expect(options.filter).not.toContain('month = 1 && day = 2');
    await expect(listUpcomingBirthdayAnnotations(context, '2027-02-29')).rejects.toThrow('Invalid');
    expect(getList).toHaveBeenCalledTimes(2);
  });

  it('uses a scoped realtime subscription rather than polling', async () => {
    const release = vi.fn();
    const subscribe = vi.fn().mockResolvedValue(release);
    setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({ subscribe }) });
    const changed = vi.fn();
    expect(await subscribeDayAnnotations(context, changed)).toBe(release);
    expect(subscribe.mock.calls[0][2]).toEqual({ filter: 'family = "family_1"', headers: { 'X-Family-Member-Id': 'member_1' } });
    subscribe.mock.calls[0][1]();
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
