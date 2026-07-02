// Service worker minimal pour vulu (PWA installable).
// - app shell mis en cache à l'installation (hors routes de redirection)
// - navigations : réseau d'abord (jamais servir une redirection depuis le cache)
// - assets statiques : cache-first avec revalidation
// - données API : réseau d'abord, jamais mises en cache (données privées/fraîches)
const CACHE = "vulu-v2"; // bump : évince l'ancien cache qui contenait "/" (redirection)
const SHELL = ["/login", "/icon.svg", "/manifest.webmanifest"]; // pas de "/" ni "/feed" (redirections/authentifié)

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

  // Navigations (pages) : réseau d'abord. On ne met JAMAIS en cache une réponse
  // redirigée (redirect) et on ne la sert pas depuis le cache -> évite « site inaccessible ».
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/login")));
    return;
  }

  // Données API : réseau d'abord, jamais servi depuis le cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: "OFFLINE" }), { status: 503, headers: { "content-type": "application/json" } })));
    return;
  }

  // Assets statiques : cache-first avec mise à jour en arrière-plan. On ignore
  // les réponses redirigées pour ne jamais polluer le cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
