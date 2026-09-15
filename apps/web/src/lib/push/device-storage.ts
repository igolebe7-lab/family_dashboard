export type PushDevice = { id: string; secret: string; userId: string; expiresAt: number };
const DATABASE = 'familytime-push';

export async function deviceStorage<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('state', mode);
      const request = action(tx.objectStore('state'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export function getPushDevice(): Promise<PushDevice | undefined> {
  return deviceStorage('readonly', (store) => store.get('device'));
}
export function setPushDevice(device: PushDevice | null): Promise<unknown> {
  return device ? deviceStorage('readwrite', (store) => store.put(device, 'device'))
    : deviceStorage('readwrite', (store) => store.delete('device'));
}
