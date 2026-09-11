/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `familytime-shell-${version}`;
const ASSETS = [...build, ...files];
const SHELL = '/200.html';

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
