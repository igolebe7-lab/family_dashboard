import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapItemRecord, updateItemDetails } from './items.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';
afterEach(resetPocketBaseClient);

describe('item details', () => {
  it('maps valid checklist entries while ignoring malformed entries', () => {
    const item = mapItemRecord({ checklist_json: [{ id: '1', title: 'Взять воду', done: true }, null, { title: 'Без id' }] });
    expect(item.checklist).toEqual([{ id: '1', title: 'Взять воду', done: true }]);
  });
  it('sends only editable metadata with actor header and validates the title', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'item', title: 'Прогулка' });
    setPocketBaseClient({ authStore: { token: '', record: null, isValid: true, clear() {} }, collection: () => ({ update }) });
    const context = { familyId: 'family', memberId: 'member' };
    await updateItemDetails('item', { title: ' Прогулка ', description: ' Вместе ', locationText: ' Парк ' }, context);
    expect(update).toHaveBeenCalledWith('item', { title: 'Прогулка', description: 'Вместе', location_text: 'Парк' }, { headers: { 'X-Family-Member-Id': 'member' } });
    await expect(updateItemDetails('item', { title: ' ', description: '', locationText: '' }, context)).rejects.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
