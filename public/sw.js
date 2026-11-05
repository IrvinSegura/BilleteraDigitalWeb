// The app's service worker: keeps the app itself (page, scripts, styles, icons) so it opens without a connection.
// It never stores API answers: the data shown offline is the app's own snapshot, cleared when signing out.
// Bump VERSION to drop every cached file at once.
const VERSION = 'v1'
const SHELL = `wallet-shell-${VERSION}`
const ASSETS = `wallet-assets-${VERSION}`
// Old releases' scripts pile up in the assets cache; the oldest go past this
const MAX_ASSETS = 150

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL)
    .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']))
    .then(() => self.skipWaiting()))
})

// On the first visit the app's scripts and styles load before this worker is in control; the page then sends
// the ones it loaded, and those missing are fetched again, so the app opens offline from the second load on
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-assets' || !Array.isArray(event.data.urls)) return
  event.waitUntil((async () => {
    const cache = await caches.open(ASSETS)
    for (const href of event.data.urls) {
      const url = new URL(href, self.location.origin)
      if (url.origin !== self.location.origin || !url.pathname.startsWith('/assets/')) continue
      if (!(await cache.match(url.pathname, { ignoreVary: true }))) await cache.add(url.pathname).catch(() => undefined)
    }
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((name) => name !== SHELL && name !== ASSETS).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()))
})

async function trim(cache) {
  const requests = await cache.keys()
  await Promise.all(requests.slice(0, Math.max(0, requests.length - MAX_ASSETS)).map((request) => cache.delete(request)))
}

// Pages: always the network, so a release is picked up at once; the last page seen when there is none
async function page(request) {
  const cache = await caches.open(SHELL)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put('/', response.clone())
    return response
  } catch {
    return (await cache.match('/')) ?? Response.error()
  }
}

// Hashed files never change: the cache first, the network the first time. Vary is ignored: a copy fetched
// without the Origin header the page's module scripts send is still the same file.
async function asset(request) {
  const cache = await caches.open(ASSETS)
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    void trim(cache)
  }
  return response
}

// Icons and the manifest: the cached copy at once, refreshed for next time
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL)
  const cached = await cache.match(request)
  const network = fetch(request).then((response) => {
    if (response.ok) void cache.put(request, response.clone())
    return response
  })
  return cached ?? network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // The API (and everything else not this app's own) goes straight to the network, never to a cache
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(page(request))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request))
  } else if (url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(request))
  }
})
