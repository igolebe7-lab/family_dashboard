/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';
import { getPushDevice } from './lib/push/device-storage';
import { safePushPath } from './lib/push/push-state';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `familytime-shell-${version}`;
const ASSETS = [...build, ...files];
const SHELL = '/200.html';

worker.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const device = await getPushDevice();
    let data: Record<string, unknown>;
    try { data = event.data?.json() ?? {}; } catch { return; }
    if (!device || device.expiresAt <= Date.now() || data.subscriptionId !== device.id) return;
    await worker.registration.showNotification('FamilyTime', {
      body: typeof data.body === 'string' ? data.body : 'В семье есть обновление.',
      icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
      tag: typeof data.tag === 'string' ? data.tag : 'familytime-update',
      data: { url: safePushPath(data.url), subscriptionId: device.id }
    });
  })());
});

worker.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const device = await getPushDevice();
    if (!device || device.expiresAt <= Date.now() || event.notification.data?.subscriptionId !== device.id) return;
    const url = new URL(safePushPath(event.notification.data?.url), worker.location.origin).href;
    const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === worker.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await worker.clients.openWindow(url);
  })());
});

worker.addEventListener('install', (event) => {
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    await cache.addAll([...ASSETS, SHELL]);
  }

  event.waitUntil(addFilesToCache());
});

worker.addEventListener('activate', (event) => {
  async function deleteOldCaches() {
    const keys = await caches.keys();
    // Other tabs can still be running the previous bundle and lazy-loading its chunks.
    const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length <= 1) await Promise.all(keys.filter((key) => key.startsWith('familytime-shell-') && key !== CACHE).map((key) => caches.delete(key)));
    await worker.clients.claim();
  }

  event.waitUntil(deleteOldCaches());
});

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') void worker.skipWaiting();
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== worker.location.origin) return;
  const immutable = url.pathname.startsWith('/_app/immutable/');
  if (!ASSETS.includes(url.pathname) && !immutable && event.request.mode !== 'navigate') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return;

  async function respond() {
    const cache = await caches.open(CACHE);

    if (immutable) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
    }

    if (ASSETS.includes(url.pathname)) {
      const response = await cache.match(url.pathname);
      if (response) return response;
    }

    try {
      const response = await fetch(event.request);

      if (!(response instanceof Response)) {
        throw new Error('Invalid response from fetch');
      }

      return response;
    } catch (error) {
      const response = await cache.match(event.request.mode === 'navigate' ? SHELL : url.pathname);
      if (response) return response;
      throw error;
    }
  }

  event.respondWith(respond());
});
