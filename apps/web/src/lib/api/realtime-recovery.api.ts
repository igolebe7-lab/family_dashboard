import { getPocketBaseClient } from './pocketbase';

export async function subscribeReconnect(onReconnect: () => void): Promise<() => void | Promise<void>> {
  const realtime = getPocketBaseClient().realtime;
  if (!realtime) return () => {};
  let connected = realtime.isConnected;
  return realtime.subscribe('PB_CONNECT', () => {
    if (connected) onReconnect();
    connected = true;
  });
}
