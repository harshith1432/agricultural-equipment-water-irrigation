/**
 * Self-destructing service worker.
 * This domain previously served the Android app's own web build, which
 * registered a PWA service worker caching the old app shell. Any browser
 * that visited before has that worker still intercepting navigation and
 * serving the stale cached app instead of this marketing site. Browsers
 * periodically re-fetch /sw.js to check for byte differences - once they
 * see this file, they install + activate it immediately (skipWaiting +
 * clients.claim), it wipes every cache, unregisters itself, and never
 * intercepts a fetch again.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  );
});
