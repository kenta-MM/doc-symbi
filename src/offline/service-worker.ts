/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL, getCacheKeyForURL, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };
const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/\/tests\//] }));
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
  if (event.data?.type === 'CHECK_READY') event.waitUntil((async () => {
    const cached = await Promise.all(manifest.map(async entry => {
      const key = getCacheKeyForURL(typeof entry === 'string' ? entry : entry.url); return key ? Boolean(await caches.match(key)) : false;
    }));
    event.ports[0]?.postMessage({ ready: cached.length > 0 && cached.every(Boolean) });
  })());
});
