import { afterEach, expect, it, vi } from 'vitest';
import { subscribeFamilyChanges } from './families.api';
import { subscribeReconnect } from './realtime-recovery.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

afterEach(resetPocketBaseClient);
it('subscribes only to the authorized active family record', async () => {
  const unsubscribe = vi.fn(), subscribe = vi.fn().mockResolvedValue(unsubscribe);
  setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({ subscribe }) });
  const changed = vi.fn();
  const stop = await subscribeFamilyChanges({ familyId: 'family', memberId: 'child' }, changed);
  expect(subscribe).toHaveBeenCalledWith('family', expect.any(Function), { headers: { 'X-Family-Member-Id': 'child' } });
  subscribe.mock.calls[0][1]({ record: { id: 'family' } });
  expect(changed).toHaveBeenCalledTimes(1); stop(); expect(unsubscribe).toHaveBeenCalledTimes(1);
});
it('ignores the first connection but refreshes after a silent reconnect', async () => {
  const subscribe = vi.fn().mockResolvedValue(vi.fn());
  setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({}), realtime: { isConnected: false, subscribe } });
  const changed = vi.fn(); await subscribeReconnect(changed);
  expect(subscribe).toHaveBeenCalledWith('PB_CONNECT', expect.any(Function));
  subscribe.mock.calls[0][1]({ clientId: 'first' }); expect(changed).not.toHaveBeenCalled();
  subscribe.mock.calls[0][1]({ clientId: 'second' }); expect(changed).toHaveBeenCalledTimes(1);
});
it('observes reconnection of an already connected shared client', async () => {
  const subscribe = vi.fn().mockResolvedValue(vi.fn());
  setPocketBaseClient({ authStore: { clear() {}, isValid: true, token: '', record: {} }, collection: () => ({}), realtime: { isConnected: true, subscribe } });
  const changed = vi.fn(); await subscribeReconnect(changed);
  subscribe.mock.calls[0][1]({ clientId: 'next' }); expect(changed).toHaveBeenCalledTimes(1);
});
