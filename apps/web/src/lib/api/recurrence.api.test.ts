import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureOccurrenceRange } from './recurrence.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

afterEach(resetPocketBaseClient);
const context = { familyId: 'family-a', memberId: 'member-a' };
const range = { from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' };
describe('recurrence materialization requests', () => {
  it('deduplicates concurrent requests and includes family and actor', async () => {
    let resolve!: () => void;
    const send = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    setPocketBaseClient({ authStore: { token: 'user-a', record: {}, isValid: true, clear: vi.fn() }, collection: vi.fn(), send });
    const first = ensureOccurrenceRange(context, range);
    const second = ensureOccurrenceRange(context, range);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('/api/familytime/occurrences/materialize', expect.objectContaining({ body: { family: context.familyId, ...range }, headers: { 'X-Family-Member-Id': context.memberId } }));
    resolve();
    await Promise.all([first, second]);
  });
  it('does not suppress a retry after network failure', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ success: true });
    setPocketBaseClient({ authStore: { token: 'user-a', record: {}, isValid: true, clear: vi.fn() }, collection: vi.fn(), send });
    await expect(ensureOccurrenceRange(context, range)).rejects.toThrow('offline');
    await ensureOccurrenceRange(context, range);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('rejects a missing family before making any request', async () => {
    await expect(ensureOccurrenceRange({}, range)).rejects.toThrow('active family');
  });
});
