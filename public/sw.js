// PulseMeet service worker — self-unregistering kill switch.
//
// Earlier dev builds registered a caching service worker; on devices that
// visited then, a stale SW kept serving outdated JS. Browsers re-fetch this
// file on navigation and, seeing it changed, install this version — which
// clears all caches, unregisters itself, and reloads open tabs so they get
// fresh code. (A real caching SW will be reintroduced for production/offline
// when the app is deployed over HTTPS.)

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        // Reload each open tab so it loads fresh, un-intercepted assets.
        client.navigate(client.url);
      }
    })(),
  );
});
