const STATIC_CACHE = "racms-static-v2";
const API_CACHE = "racms-api-v2";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/pwa-192x192.png",
  "/icons/pwa-512x512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Cache external Google Fonts gracefully
    if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
      event.respondWith(
        caches.match(request).then((cached) => {
          const networkFetch = fetch(request).then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            }
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      );
    }
    return;
  }

  // Never cache /api/health so connectivity checks stay real
  if (url.pathname === "/api/health") return;

  // 1. API GET Requests: Network-First with Cache Fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Offline-Fallback": "1" }
          });
        })
    );
    return;
  }

  // 2. HTML Navigation: Network-First with Cached App Shell Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put("/index.html", clone));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match("/index.html")) || (await caches.match("/"));
        })
    );
    return;
  }

  // 3. Static Assets (/assets/, /images/, /uploads/, /icons/): Cache-First + Background Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkRes;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
