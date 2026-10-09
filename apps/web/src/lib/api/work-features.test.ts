import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';
import { mapOccurrenceRecord } from './occurrences.api';
import { getPointsBalances, listWorkDates, toggleChecklistStep } from './work-features.api';
import type { Item } from '$lib/types/domain';

afterEach(resetPocketBaseClient);
describe('work features', () => {
  it('maps per-date checked IDs independently from the template', () => {
    expect(mapOccurrenceRecord({ id: 'o', item: 'i', family: 'f', checklist_done_json: ['a', 'b'] }))
      .toMatchObject({ checklistDoneIds: ['a', 'b'] });
  });
  it('sends one atomic checklist change with the active profile header', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'o', item: 'i', family: 'f', checklist_done_json: ['a'] });
    setPocketBaseClient({ authStore: { token: 't', record: {}, isValid: true, clear() {} }, collection: () => ({}), send });
    expect(await toggleChecklistStep('o', 'a', true, { familyId: 'f', memberId: 'child' })).toMatchObject({ checklistDoneIds: ['a'] });
    expect(send).toHaveBeenCalledWith('/api/familytime/occurrences/o/checklist', expect.objectContaining({ method: 'PATCH', body: { stepId: 'a', done: true }, headers: { 'X-Family-Member-Id': 'child' } }));
  });
  it('rejects a checklist response outside the active family or selected date', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'other', family: 'f' });
    setPocketBaseClient({ authStore: { token: 't', record: {}, isValid: true, clear() {} }, collection: () => ({}), send });
    await expect(toggleChecklistStep('o', 'a', true, { familyId: 'f', memberId: 'm' })).rejects.toThrow();
    send.mockResolvedValue({ id: 'o', family: 'other' });
    await expect(toggleChecklistStep('o', 'a', true, { familyId: 'f', memberId: 'm' })).rejects.toThrow();
  });
  it('loads only the chosen recurring date and refuses inaccessible metadata', async () => {
    const getOne = vi.fn().mockResolvedValue({ id: 'o', family: 'f', item: 'i', kind: 'assignment' });
    const send = vi.fn();
    setPocketBaseClient({ authStore: { token: 't', record: {}, isValid: true, clear() {} }, collection: () => ({ getOne }), send });
    const context = { familyId: 'f', memberId: 'm' }, item = { id: 'i' } as Item;
    expect(await listWorkDates(item, context, 'o')).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
    expect(getOne).toHaveBeenCalledWith('o', expect.objectContaining({ headers: { 'X-Family-Member-Id': 'm' } }));
    getOne.mockResolvedValue({ id: 'o', family: 'f', item: 'wrong', kind: 'assignment' });
    await expect(listWorkDates(item, context, 'o')).rejects.toThrow();
  });
  it('reads child balances through the scoped endpoint without accepting invalid values', async () => {
    const send = vi.fn().mockResolvedValue({ balances: [{ memberId: 'c', balance: 7 }, { memberId: 'bad', balance: -1 }, { memberId: 'bad2', balance: '99' }] });
    setPocketBaseClient({ authStore: { token: 't', record: {}, isValid: true, clear() {} }, collection: () => ({}), send });
    expect(await getPointsBalances({ familyId: 'f', memberId: 'c' })).toEqual({ c: 7 });
    expect(send).toHaveBeenCalledWith('/api/familytime/points', expect.objectContaining({ query: { family: 'f' }, headers: { 'X-Family-Member-Id': 'c' } }));
  });
});
