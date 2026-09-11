import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAttentionOccurrences } from './attention.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

afterEach(resetPocketBaseClient);
const now = new Date('2026-09-11T12:00:00Z');
const context = { familyId: 'family-a', memberId: 'member-a' };
function client(getList: ReturnType<typeof vi.fn>) {
  const send = vi.fn().mockResolvedValue({ success: true });
  setPocketBaseClient({ authStore: { token: 'attention-test', record: {}, isValid: true, clear: vi.fn() }, collection: () => ({ getList }), send });
  return send;
}
describe('attention loading', () => {
  it('paginates unresolved records while only materializing the next seven days', async () => {
    const getList = vi.fn().mockResolvedValue({ items: [], totalPages: 2 });
    const send = client(getList);
    await loadAttentionOccurrences(context, now);
    expect(send).toHaveBeenCalledWith('/api/familytime/occurrences/materialize', expect.objectContaining({ body: { family: 'family-a', from: now.toISOString(), to: '2026-09-18T12:00:00.000Z' } }));
    expect(getList).toHaveBeenCalledTimes(2);
    expect(getList).toHaveBeenLastCalledWith(2, 100, expect.objectContaining({ headers: { 'X-Family-Member-Id': 'member-a' }, filter: expect.stringContaining('item.archived = false') }));
    expect(getList.mock.calls[0][2].filter).toContain('due_at = "" && start_at != ""');
  });
  it('rejects cross-family results and excessive backlog rather than silently truncating', async () => {
    const getList = vi.fn().mockResolvedValueOnce({ items: [{ id: 'x', family: 'other', expand: { item: { id: 'i', family: 'other' } } }], totalPages: 1 }).mockResolvedValueOnce({ items: [], totalPages: 21 });
    client(getList);
    await expect(loadAttentionOccurrences(context, now)).rejects.toThrow('Invalid family context');
    await expect(loadAttentionOccurrences(context, now)).rejects.toThrow('Слишком много');
  });
});
