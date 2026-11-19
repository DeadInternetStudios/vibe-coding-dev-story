/*
 * Offline play. After the first visit the game, its fonts and the voice clips stay on the device.
 * The page and the manifests ask the network first, so a new version shows up on the next visit.
 * Voice clips are served from the device and refreshed behind the scenes.
 */
const CACHE = 'vcds-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function remember(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return response;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch {
    /* storage full or blocked: play on without it */
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await remember(request, await fetch(request));
  } catch (err) {
    const hit = await caches.match(request);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  return hit || remember(request, await fetch(request));
}

async function staleWhileRevalidate(request) {
  const hit = await caches.match(request);
  const refresh = fetch(request).then((res) => remember(request, res)).catch(() => hit);
  return hit || refresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const page = request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const manifest = url.pathname.endsWith('.json') || url.pathname.endsWith('.webmanifest');
  if (page || manifest) event.respondWith(networkFirst(request));
  else if (url.pathname.includes('/audio/')) event.respondWith(staleWhileRevalidate(request));
  else event.respondWith(cacheFirst(request));
});
