const DB_NAME = "racms-offline-db";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const CACHE_STORE = "apiCache";

let dbPromise = null;
let isSyncing = false;
const originalFetch = window.fetch.bind(window);

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "url" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbPut(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function notifyQueueChange(count) {
  window.dispatchEvent(new CustomEvent("racms-offline-change", { detail: { count } }));
}

export async function getPendingSyncCount() {
  try {
    const items = await idbGetAll(OUTBOX_STORE);
    return items.length;
  } catch {
    return 0;
  }
}

async function serializeBody(body) {
  if (!body) return { bodyType: "none", bodyData: null, previewObj: {} };
  if (body instanceof FormData) {
    const entries = [];
    const previewObj = {};
    for (const [k, v] of body.entries()) {
      if (v instanceof File || v instanceof Blob) {
        entries.push({ key: k, isFile: true, name: v.name || "upload.bin", type: v.type, blob: v });
      } else {
        entries.push({ key: k, isFile: false, value: String(v) });
        previewObj[k] = String(v);
      }
    }
    return { bodyType: "formdata", bodyData: entries, previewObj };
  }
  if (typeof body === "string") {
    let previewObj = {};
    try { previewObj = JSON.parse(body); } catch {}
    return { bodyType: "json", bodyData: body, previewObj };
  }
  return { bodyType: "json", bodyData: JSON.stringify(body), previewObj: body };
}

function reconstructBody(entry) {
  if (entry.bodyType === "none" || !entry.bodyData) return undefined;
  if (entry.bodyType === "formdata") {
    const fd = new FormData();
    for (const item of entry.bodyData) {
      if (item.isFile) {
        fd.append(item.key, item.blob, item.name);
      } else {
        fd.append(item.key, item.value);
      }
    }
    return fd;
  }
  return entry.bodyData;
}

function normalizeCollectionPath(url) {
  return url.split("?")[0].replace(/\/+$/, "");
}

function makeJsonResponse(data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

export async function syncOfflineQueue() {
  if (isSyncing || !navigator.onLine) return 0;
  isSyncing = true;
  let syncedCount = 0;

  try {
    const items = await idbGetAll(OUTBOX_STORE);
    items.sort((a, b) => a.id - b.id);

    for (const item of items) {
      try {
        const fetchOpts = {
          method: item.method,
          headers: item.bodyType === "formdata" ? undefined : (item.headers || { "Content-Type": "application/json" }),
          body: reconstructBody(item)
        };
        const res = await originalFetch(item.url, fetchOpts);
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          await idbDelete(OUTBOX_STORE, item.id);
          if (res.ok) syncedCount++;
        } else {
          // Server 5xx: pause sync and retry later
          break;
        }
      } catch {
        // Still offline / unreachable
        break;
      }
    }

    const remaining = await getPendingSyncCount();
    notifyQueueChange(remaining);
    if (syncedCount > 0) {
      window.dispatchEvent(new CustomEvent("racms-sync-complete", { detail: { syncedCount, remaining } }));
    }
  } finally {
    isSyncing = false;
  }
  return syncedCount;
}

export function initOfflineSync() {
  if (window.__racmsOfflineInit) return;
  window.__racmsOfflineInit = true;

  // Register Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration skipped:", err);
      });
    });
  }

  // Intercept /api/* requests for seamless offline reads + queued offline writes
  window.fetch = async (input, init = {}) => {
    const urlStr = typeof input === "string" ? input : input?.url || "";
    const method = (init.method || (typeof input !== "string" && input?.method) || "GET").toUpperCase();

    // Only manage same-origin /api/ calls (skip /api/health & auth)
    const isApiCall = urlStr.startsWith("/api/") && !urlStr.startsWith("/api/health") && !urlStr.startsWith("/api/auth/");
    if (!isApiCall) {
      return originalFetch(input, init);
    }

    // 1. GET Requests: Network-first, cache to IDB, fallback to IDB + optimistic outbox items
    if (method === "GET") {
      try {
        const res = await originalFetch(input, init);
        if (res.ok) {
          const clone = res.clone();
          clone.json().then((data) => {
            idbPut(CACHE_STORE, { url: normalizeCollectionPath(urlStr), data, updatedAt: Date.now() }).catch(() => {});
          }).catch(() => {});
        }
        return res;
      } catch {
        const basePath = normalizeCollectionPath(urlStr);
        const cached = await idbGet(CACHE_STORE, basePath).catch(() => null);
        let payload = cached ? cached.data : [];

        // Merge any offline-created items queued for this collection
        if (Array.isArray(payload)) {
          const outbox = await idbGetAll(OUTBOX_STORE).catch(() => []);
          const pendingCreates = outbox
            .filter(o => o.method === "POST" && normalizeCollectionPath(o.url) === basePath && o.previewObj)
            .map(o => ({ ...o.previewObj, id: -(o.id || 1), _offline_queued: true }));
          if (pendingCreates.length > 0) {
            payload = [...pendingCreates, ...payload];
          }
        }
        return makeJsonResponse(payload, { "X-Offline-IDB": "1" });
      }
    }

    // 2. Mutations (POST/PUT/PATCH/DELETE): Try online first, queue into IndexedDB if offline
    const queueMutation = async () => {
      const headersObj = {};
      if (init.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => { headersObj[k] = v; });
        } else {
          Object.assign(headersObj, init.headers);
        }
      }
      const { bodyType, bodyData, previewObj } = await serializeBody(init.body);
      const id = await idbPut(OUTBOX_STORE, {
        url: urlStr,
        method,
        headers: headersObj,
        bodyType,
        bodyData,
        previewObj,
        createdAt: Date.now()
      });
      const count = await getPendingSyncCount();
      notifyQueueChange(count);
      return makeJsonResponse(
        { ...previewObj, id: -id, _offline_queued: true, message: "Saved offline. Will auto-sync when connected." },
        { "X-Offline-Queued": "1" }
      );
    };

    if (!navigator.onLine) {
      return queueMutation();
    }

    try {
      const res = await originalFetch(input, init);
      return res;
    } catch {
      return queueMutation();
    }
  };

  // Auto-sync when connection returns
  window.addEventListener("online", () => {
    setTimeout(() => syncOfflineQueue(), 800);
  });

  // Periodic retry every 15s if online & outbox is non-empty
  setInterval(async () => {
    if (navigator.onLine && (await getPendingSyncCount()) > 0) {
      syncOfflineQueue();
    }
  }, 15000);
}
