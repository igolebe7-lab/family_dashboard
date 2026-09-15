import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOccurrenceRangeFilter, listOccurrencesInRange, listOccurrenceMarkersInRange, mapOccurrenceRecord } from './occurrences.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

afterEach(resetPocketBaseClient);

describe('occurrence range completeness', () => {
  it('normalizes offset and UTC boundaries to PocketBase stored datetime format', () => {
    const filter = buildOccurrenceRangeFilter('family', {
      from: '2026-09-14T00:00:00+02:00', to: '2026-09-15T00:00:00.000Z'
    });
    expect(filter).toContain('due_at >= "2026-09-13 22:00:00.000Z"');
    expect(filter).toContain('start_at < "2026-09-15 00:00:00.000Z"');
    expect(filter).not.toContain('+02:00');
  });
  it('awaits shared materialization before list and marker reads and regenerates on later reads', async () => {
    let resolve!: () => void;
    const send = vi.fn().mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; })).mockResolvedValue(undefined);
    const getList = vi.fn().mockResolvedValue({ items: [], totalPages: 1 });
    setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: 'range', record: {} }, send, collection: () => ({ getList }) });
    const context = { familyId: 'family', memberId: 'parent' };
    const range = { from: '2026-06-01', to: '2026-07-01' };
    const list = listOccurrencesInRange(context, range);
    const markers = listOccurrenceMarkersInRange(context, range);
    expect(send).toHaveBeenCalledTimes(1);
    expect(getList).not.toHaveBeenCalled();
    resolve(); await Promise.all([list, markers]);
    expect(getList).toHaveBeenCalledTimes(2);
    await listOccurrencesInRange(context, range);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('loads every page with item metadata while retaining the same range and member scope', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({ id: `occ${index}`, family: 'family', item: 'item', kind: 'event' }));
    const getList = vi.fn().mockResolvedValueOnce({ items: firstPage, totalItems: 201, totalPages: 2 })
      .mockResolvedValueOnce({ items: [{ id: 'last', family: 'family', item: 'item', kind: 'event', expand: { item: { id: 'item', family: 'family', kind: 'event', participants: ['child'], approval_required: false } } }], totalItems: 201, totalPages: 2 });
    setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({ getList }) });
    const result = await listOccurrencesInRange({ familyId: 'family', memberId: 'parent' }, { from: '2026-06-01', to: '2026-07-01' });
    expect(result.items).toHaveLength(201);
    expect(result.items.at(-1)?.itemRecord?.participants).toEqual(['child']);
    expect(getList).toHaveBeenCalledTimes(2);
    for (const [page, perPage, options] of getList.mock.calls) {
      expect([1, 2]).toContain(page);
      expect(perPage).toBe(200);
      expect(options).toMatchObject({ expand: 'item', headers: { 'X-Family-Member-Id': 'parent' } });
      expect(options.filter).toContain('2026-06-01');
      expect(options.filter).toContain('2026-07-01');
      expect(options.filter).toContain('item.archived = false');
    }
  });

  it('does not attach expanded metadata from a different family or item', () => {
    const occurrence = mapOccurrenceRecord({ id: 'occ', family: 'family', item: 'item', expand: { item: { id: 'item', family: 'other' } } });
    expect(occurrence.itemRecord).toBeUndefined();
  });
});
