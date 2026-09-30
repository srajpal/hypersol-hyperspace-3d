// Review of 2026-09-30, finding M3: a service worker's requests go through
// the shield. This worker answers every request of its page by fetching
// it itself, so the request the network sees is the worker's, not the
// page's; and it keeps the addresses it handled, which the page asks for.
const handled = [];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  handled.push(event.request.url);
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data === 'handled?') event.source.postMessage({ handled: [...handled] });
});
