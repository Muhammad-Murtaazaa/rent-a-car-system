const STATIC_CACHE = "racms-static-v3";
const API_CACHE = "racms-api-v3";
const IDB_NAME = "racms-offline-db";
const IDB_VERSION = 1;
const OUTBOX_STORE = "outbox";

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
    ).then(() => self.clients.claim())
  );
});

// Warm all JS/CSS/images/API URLs on 1st open so offline mode works immediately without refresh
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data.type === "WARM_URLS" && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const staticCache = await caches.open(STATIC_CACHE);
        const apiCache = await caches.open(API_CACHE);
        await Promise.all(
          event.data.urls.map(async (url) => {
            try {
              const targetCache = url.includes("/api/") ? apiCache : staticCache;
              const existing = await targetCache.match(url);
              if (!existing || url.includes("/api/")) {
                const res = await fetch(url, { credentials: "same-origin" });
                if (res && res.ok) {
                  await targetCache.put(url, res.clone());
                }
              }
            } catch {
              // ignore individual failed asset warm
            }
          })
        );
        const clients = await self.clients.matchAll();
        clients.forEach((c) => c.postMessage({ type: "OFFLINE_READY" }));
      })()
    );
  }
});

// Background Sync API: replays queued offline mutations even if app tab was closed
function openIdbInSw() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("apiCache")) {
        db.createObjectStore("apiCache", { keyPath: "url" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reconstructBodyInSw(entry) {
  if (entry.bodyType === "none" || !entry.bodyData) return undefined;
  if (entry.bodyType === "formdata") {
    const fd = new FormData();
    for (const item of entry.bodyData) {
      if (item.isFile) fd.append(item.key, item.blob, item.name);
      else fd.append(item.key, item.value);
    }
    return fd;
  }
  return entry.bodyData;
}

async function replayOutboxInSw() {
  const db = await openIdbInSw();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    const req = tx.objectStore(OUTBOX_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  items.sort((a, b) => a.id - b.id);

  let synced = 0;
  for (const item of items) {
    const res = await fetch(item.url, {
      method: item.method,
      headers: item.bodyType === "formdata" ? undefined : (item.headers || { "Content-Type": "application/json" }),
      body: reconstructBodyInSw(item)
    });
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(OUTBOX_STORE, "readwrite");
        const req = tx.objectStore(OUTBOX_STORE).delete(item.id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      if (res.ok) synced++;
    } else {
      throw new Error("Server error during background sync");
    }
  }

  if (synced > 0) {
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.postMessage({ type: "BG_SYNC_COMPLETE", syncedCount: synced }));
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "racms-outbox-sync") {
    event.waitUntil(replayOutboxInSw());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
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
