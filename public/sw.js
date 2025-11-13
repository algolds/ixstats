// sw.js
// Service Worker for IxCards PWA
// Provides offline fallback, caching, and background sync

const CACHE_NAME = "ixcards-v1";
const RUNTIME_CACHE = "ixcards-runtime-v1";
const IMAGE_CACHE = "ixcards-images-v1";

/**
 * Assets to cache on install
 */
const PRECACHE_ASSETS = [
  "/",
  "/vault/packs",
  "/vault/inventory",
  "/vault/marketplace",
  "/offline.html",
];

/**
 * Install event - precache critical assets
 */
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Precaching app shell");
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[ServiceWorker] Precache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name !== CACHE_NAME &&
              name !== RUNTIME_CACHE &&
              name !== IMAGE_CACHE
            );
          })
          .map((name) => {
            console.log("[ServiceWorker] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event - network-first with cache fallback
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip Chrome extensions and external domains
  if (
    !url.protocol.startsWith("http") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Handle card images with cache-first strategy
  if (
    url.pathname.startsWith("/images/") ||
    url.pathname.includes("/cards/") ||
    url.pathname.includes("nationstates.net")
  ) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/trpc/")) {
    event.respondWith(networkFirstStrategy(request, RUNTIME_CACHE));
    return;
  }

  // Handle navigation requests with network-first strategy
  if (request.mode === "navigate") {
    event.respondWith(networkFirstStrategy(request, RUNTIME_CACHE));
    return;
  }

  // Default: network-first for everything else
  event.respondWith(networkFirstStrategy(request, RUNTIME_CACHE));
});

/**
 * Cache-first strategy (for images)
 */
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    const response = await fetch(request);

    // Cache successful responses
    if (response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn("[ServiceWorker] Cache-first failed:", error);
    return new Response("Offline", { status: 503 });
  }
}

/**
 * Network-first strategy (for pages and API)
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn("[ServiceWorker] Network request failed, trying cache:", error);

    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline.html");
      if (offlinePage) {
        return offlinePage;
      }
    }

    return new Response("Offline", { status: 503 });
  }
}

/**
 * Background sync for trades and crafting
 */
self.addEventListener("sync", (event) => {
  console.log("[ServiceWorker] Background sync:", event.tag);

  if (event.tag === "sync-trades") {
    event.waitUntil(syncTrades());
  } else if (event.tag === "sync-crafting") {
    event.waitUntil(syncCrafting());
  }
});

/**
 * Sync pending trades
 */
async function syncTrades() {
  try {
    console.log("[ServiceWorker] Syncing trades...");
    // TODO: Implement trade sync logic
    // This would read from IndexedDB and POST to API
  } catch (error) {
    console.error("[ServiceWorker] Trade sync failed:", error);
    throw error; // Retry on next sync
  }
}

/**
 * Sync pending crafting
 */
async function syncCrafting() {
  try {
    console.log("[ServiceWorker] Syncing crafting...");
    // TODO: Implement crafting sync logic
    // This would read from IndexedDB and POST to API
  } catch (error) {
    console.error("[ServiceWorker] Crafting sync failed:", error);
    throw error; // Retry on next sync
  }
}

/**
 * Push notifications (future)
 */
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "IxCards";
  const options = {
    body: data.body || "New notification",
    icon: "/images/icons/icon-192x192.png",
    badge: "/images/icons/badge-72x72.png",
    data: data.url || "/",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Notification click handler
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || "/")
  );
});
