import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createWorkList } from './work-list';
import { loadWorkRecords, type WorkRecords } from './work-records';
import { resetPocketBaseClient, setPocketBaseClient } from '$lib/api/pocketbase';
import type { FamilyState } from '$lib/stores/family.store';
import type { Item, ItemOccurrence } from '$lib/types/domain';

const family: FamilyState = { status: 'ready', families: [], members: [{ id: 'parent', family: 'f', displayName: 'Мама', role: 'parent', active: true, managedBy: [] }], activeFamily: { id: 'f', name: 'Дом', slug: 'home', timezone: 'Europe/Amsterdam', ownerUser: 'u' }, activeMember: { id: 'parent', family: 'f', displayName: 'Мама', role: 'parent', active: true, managedBy: [] }, error: null };
const item: Item = { id: 'i', family: 'f', kind: 'task', title: 'Дело', createdBy: 'parent', owner: 'parent', assignees: [], participants: [], visibleTo: ['parent'], visibility: 'private', category: 'home', priority: 'normal', allDay: false, timezone: 'Europe/Amsterdam', approvalRequired: false, archived: false };
const occurrence: ItemOccurrence = { id: 'o', item: 'i', family: 'f', kind: 'task', titleSnapshot: 'Дело', categorySnapshot: 'home', visibleTo: ['parent'], allDay: false, status: 'todo' };
const records: WorkRecords = { occurrences: [occurrence], items: [item] };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
afterEach(resetPocketBaseClient);

describe('work list state', () => {
  it('starts empty and discards a response after logout', async () => {
    const pending = deferred<WorkRecords>();
    const list = createWorkList('task', { load: () => pending.promise });
    expect(get(list).occurrences).toEqual([]);
    const loading = list.setFamily(family);
    expect(get(list).loading).toBe(true);
    await list.setFamily({ ...family, activeMember: null });
    pending.resolve(records); await loading;
    expect(get(list).occurrences).toEqual([]);
    expect(get(list).context).toBeNull();
  });
  it('ignores older loads and retains same-profile data after a retry fails', async () => {
    const first = deferred<WorkRecords>(); const second = deferred<WorkRecords>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockRejectedValueOnce(new Error('offline'));
    const list = createWorkList('task', { load });
    const initial = list.setFamily(family); const refresh = list.reload();
    second.resolve(records); await refresh;
    first.resolve({ occurrences: [], items: [] }); await initial;
    expect(get(list).occurrences).toHaveLength(1);
    await list.reload();
    expect(get(list).occurrences).toHaveLength(1);
    expect(get(list).error).toBeTruthy();
    expect(get(list).loading).toBe(false);
  });
  it('guards duplicate writes and ignores a write result after a profile switch', async () => {
    const pending = deferred<ItemOccurrence>(); const mutate = vi.fn(() => pending.promise);
    const list = createWorkList('task', { load: async () => records, mutate });
    await list.setFamily(family);
    const action = list.act('mark_assignment_done', 'o');
    await list.act('mark_assignment_done', 'o');
    expect(mutate).toHaveBeenCalledTimes(1);
    await list.setFamily({ ...family, activeMember: null });
    pending.resolve({ ...occurrence, status: 'done' }); await action;
    expect(get(list).message).toBeNull();
    expect(get(list).occurrences).toEqual([]);
  });
  it('updates successful task status locally and rejects cancelled actions', async () => {
    const mutate = vi.fn(async () => ({ ...occurrence, status: 'done' as const }));
    const list = createWorkList('task', { load: async () => records, mutate });
    await list.setFamily(family); await list.act('approve_assignment', 'o');
    expect(mutate).not.toHaveBeenCalled();
    await list.act('mark_assignment_done', 'o');
    expect(get(list).occurrences[0].status).toBe('done');
    await list.act('mark_assignment_done', 'o');
    expect(mutate).toHaveBeenCalledTimes(1);
  });
  it('does not query child data for a parent profile', async () => {
    const load = vi.fn(async () => records); const list = createWorkList('child', { load });
    await list.setFamily(family); expect(load).not.toHaveBeenCalled();
    expect(get(list).context).toBeNull();
  });
});

describe('work records loading', () => {
  it('awaits materialization and does not read after cancellation while generating', async () => {
    const pending = deferred<unknown>();
    const send = vi.fn(() => pending.promise);
    const getList = vi.fn().mockResolvedValue({ items: [], totalPages: 1 });
    setPocketBaseClient({ authStore: { isValid: true, token: 'work-range', record: {}, clear() {} }, send, collection: () => ({ getList }) });
    const controller = new AbortController();
    const loading = loadWorkRecords({ familyId: 'f', memberId: 'parent' }, 'child', controller.signal);
    expect(send).toHaveBeenCalledTimes(1);
    expect(getList).not.toHaveBeenCalled();
    controller.abort(); pending.resolve(undefined);
    await expect(loading).rejects.toThrow('Request cancelled');
    expect(getList).not.toHaveBeenCalled();
  });
  it('rejects a cancelled final page instead of returning obsolete records', async () => {
    const controller = new AbortController();
    const pending = deferred<unknown>();
    setPocketBaseClient({ authStore: { isValid: true, token: 't', record: {}, clear() {} }, collection: () => ({ getList: () => pending.promise }) });
    const loading = loadWorkRecords({ familyId: 'f', memberId: 'parent' }, 'task', controller.signal);
    controller.abort();
    pending.resolve({ items: [], totalPages: 1 });
    await expect(loading).rejects.toThrow('Request cancelled');
  });
  it('paginates expanded items with scoped member headers and includes undated work', async () => {
    const record = { id: 'o', family: 'f', item: 'i', kind: 'task', status: 'todo', expand: { item: { id: 'i', family: 'f', kind: 'task', owner: 'parent' } } };
    const getList = vi.fn().mockResolvedValueOnce({ items: [record], totalPages: 2 }).mockResolvedValueOnce({ items: [{ ...record, id: 'o2' }], totalPages: 2 });
    setPocketBaseClient({ authStore: { isValid: true, token: 't', record: {}, clear() {} }, collection: () => ({ getList }) });
    const result = await loadWorkRecords({ familyId: 'f', memberId: 'parent' }, 'task');
    expect(result.occurrences).toHaveLength(2); expect(result.items).toHaveLength(1);
    expect(getList).toHaveBeenNthCalledWith(2, 2, 100, expect.objectContaining({ expand: 'item', headers: { 'X-Family-Member-Id': 'parent' } }));
    const filter = getList.mock.calls[0][2].filter;
    expect(filter).toContain('family = "f"'); expect(filter).toContain('kind = "task"');
    expect(filter).toContain('start_at = "" && due_at = ""');
  });
  it('rejects partial records with inaccessible item metadata', async () => {
    setPocketBaseClient({ authStore: { isValid: true, token: 't', record: {}, clear() {} }, collection: () => ({ getList: async () => ({ items: [{ id: 'o', family: 'f', item: 'i' }], totalPages: 1 }) }) });
    await expect(loadWorkRecords({ familyId: 'f', memberId: 'parent' }, 'task')).rejects.toThrow();
  });
});
