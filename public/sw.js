// Service worker minimal pour vulu (PWA installable).
// - app shell mis en cache à l'installation
// - assets statiques : cache-first
// - données API : network-first (jamais de cache obsolète des données privées)
const CACHE = "vulu-v1";
const SHELL = ["/", "/feed", "/login", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Données API : réseau d'abord, jamais servi depuis le cache (données privées/fraîches).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: "OFFLINE" }), { status: 503, headers: { "content-type": "application/json" } })));
    return;
  }

  // Reste : cache-first avec mise à jour en arrière-plan.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
