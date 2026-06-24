const CACHE_PREFIX = "doomscrollr";
const APP_SHELL_CACHE = `${CACHE_PREFIX}-app-shell-v2-001`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-v2-001`;
const APP_SHELL_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
  "/apple-touch-icon.png",
];
const STATIC_DESTINATIONS = new Set(["font", "image", "manifest", "script", "style"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) =>
              key.startsWith(CACHE_PREFIX) && ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key)
            )
            .map((key) => caches.delete(key)),
        )
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(cacheFirst(request));
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    return await caches.match(request) ?? await caches.match("/") ??
      await caches.match("/offline.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}
