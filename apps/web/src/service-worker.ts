/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `familytime-shell-${version}`;
const ASSETS = [...build, ...files];

worker.addEventListener('install', (event) => {
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
  }

  event.waitUntil(addFilesToCache());
});

worker.addEventListener('activate', (event) => {
  async function deleteOldCaches() {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
  }

  event.waitUntil(deleteOldCaches());
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return;

  async function respond() {
    const cache = await caches.open(CACHE);

    if (ASSETS.includes(url.pathname)) {
      const response = await cache.match(url.pathname);
      if (response) return response;
    }

    try {
      const response = await fetch(event.request);

      if (!(response instanceof Response)) {
        throw new Error('Invalid response from fetch');
      }

      if (response.status === 200 && !response.headers.get('cache-control')?.includes('no-store')) {
        cache.put(event.request, response.clone());
      }

      return response;
    } catch (error) {
      const response = await cache.match(event.request);
      if (response) return response;
      throw error;
    }
  }

  event.respondWith(respond());
});
