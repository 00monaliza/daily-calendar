const SW_VERSION = 'v2.0.0'
const CACHE_PREFIX = 'pogostim'
const STATIC_CACHE = `${CACHE_PREFIX}-static-v2`
const API_CACHE = `${CACHE_PREFIX}-api-v2`
const IMAGE_CACHE = `${CACHE_PREFIX}-images-v2`
const PAGE_CACHE = `${CACHE_PREFIX}-pages-v2`
const META_CACHE = `${CACHE_PREFIX}-meta-v2`

const OFFLINE_URL = '/offline.html'
const API_SYNC_TAG = 'api-sync-queue'

const IMAGE_TTL_MS = 1000 * 60 * 60 * 24 * 14
const API_TTL_MS = 1000 * 60 * 5
const PAGE_TTL_MS = 1000 * 60 * 30

const IMAGE_CACHE_MAX_ENTRIES = 60
const API_CACHE_MAX_ENTRIES = 80
const PAGE_CACHE_MAX_ENTRIES = 30

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icons/icon-120.png',
  '/icons/icon-152.png',
  '/icons/icon-167.png',
  '/icons/icon-180.png',
  OFFLINE_URL,
]

const ALLOWED_ORIGINS = new Set([self.location.origin])
const IS_DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname)

self.addEventListener('install', (event) => {
  swLog('install: precache start')
  event.waitUntil(precacheCriticalAssets())
})

self.addEventListener('activate', (event) => {
  swLog('activate: cache cleanup start')
  event.waitUntil(
    (async () => {
      await cleanupOldCaches()
      await self.clients.claim()
      await notifyClients({ type: 'SW_ACTIVATED', version: SW_VERSION })
      swLog('activate: completed')
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    swLog('message: SKIP_WAITING received')
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method === 'GET') {
    event.respondWith(handleGetRequest(request))
    return
  }

  if (isApiRequest(request) && isAllowedOrigin(request.url)) {
    event.respondWith(handleWriteRequestWithBackgroundSync(request))
  }
})

self.addEventListener('sync', (event) => {
  if (event.tag === API_SYNC_TAG) {
    event.waitUntil(replayQueuedRequests())
  }
})

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const payload = await parsePushPayload(event.data)
      const title = payload.title || 'Pogostim'
      const options = {
        body: payload.body || 'У вас новое уведомление',
        icon: '/icons/icon-180.png',
        badge: '/icons/icon-120.png',
        data: {
          url: payload.url || '/',
        },
      }

      await self.registration.showNotification(title, options)
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(focusOrOpenClient(targetUrl))
})

async function handleGetRequest(request) {
  try {
    if (!isAllowedOrigin(request.url)) {
      return fetch(request)
    }

    if (isNavigationRequest(request)) {
      return networkFirstNavigation(request)
    }

    if (isStaticAsset(request)) {
      return cacheFirst(request, STATIC_CACHE, PAGE_TTL_MS)
    }

    if (isImageRequest(request)) {
      return staleWhileRevalidate(request, IMAGE_CACHE, IMAGE_TTL_MS, IMAGE_CACHE_MAX_ENTRIES)
    }

    if (isApiRequest(request)) {
      return networkFirstApi(request)
    }

    return fetchWithFallback(request)
  } catch (error) {
    swLog('fetch handler failed', error)
    return getOfflineFallback(request)
  }
}

async function precacheCriticalAssets() {
  const cache = await caches.open(STATIC_CACHE)
  await cache.addAll(PRECACHE_ASSETS)
  swLog('install: precache done')
}

async function cleanupOldCaches() {
  const keep = new Set([STATIC_CACHE, API_CACHE, IMAGE_CACHE, PAGE_CACHE, META_CACHE])
  const keys = await caches.keys()
  await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)))
}

async function cacheFirst(request, cacheName, ttlMs) {
  const cache = await caches.open(cacheName)
  const cached = await getValidCachedResponse(cacheName, request, ttlMs)
  if (cached) {
    await touchCacheEntry(cacheName, request)
    return cached
  }

  const fresh = await fetch(request)
  if (isCacheableResponse(fresh)) {
    await cache.put(request, fresh.clone())
    await setCacheMetadata(cacheName, request, Date.now())
  }
  return fresh
}

async function staleWhileRevalidate(request, cacheName, ttlMs, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await getValidCachedResponse(cacheName, request, ttlMs)

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone())
        await setCacheMetadata(cacheName, request, Date.now())
        await enforceCacheLimit(cacheName, maxEntries)
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    await touchCacheEntry(cacheName, request)
    return cached
  }

  const networkResult = await networkPromise
  if (networkResult) {
    return networkResult
  }

  return getOfflineFallback(request)
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (isCacheableResponse(response)) {
      const cache = await caches.open(PAGE_CACHE)
      await cache.put(request, response.clone())
      await setCacheMetadata(PAGE_CACHE, request, Date.now())
      await enforceCacheLimit(PAGE_CACHE, PAGE_CACHE_MAX_ENTRIES)
    }
    return response
  } catch {
    const cache = await caches.open(PAGE_CACHE)
    const cachedPage = await getValidCachedResponse(PAGE_CACHE, request, PAGE_TTL_MS)
    if (cachedPage) {
      await touchCacheEntry(PAGE_CACHE, request)
      return cachedPage
    }

    const staticCache = await caches.open(STATIC_CACHE)
    const offline = await staticCache.match(OFFLINE_URL)
    return offline || Response.error()
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE)

  try {
    const response = await fetch(request)
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone())
      await setCacheMetadata(API_CACHE, request, Date.now())
      await enforceCacheLimit(API_CACHE, API_CACHE_MAX_ENTRIES)
    }
    return response
  } catch {
    const cached = await getValidCachedResponse(API_CACHE, request, API_TTL_MS)
    if (cached) {
      await touchCacheEntry(API_CACHE, request)
      return cached
    }
    return jsonFallback(503, { error: 'offline', message: 'Network unavailable' })
  }
}

async function fetchWithFallback(request) {
  try {
    return await fetch(request)
  } catch {
    return getOfflineFallback(request)
  }
}

async function getOfflineFallback(request) {
  if (request.mode === 'navigate') {
    const cache = await caches.open(STATIC_CACHE)
    return (await cache.match(OFFLINE_URL)) || Response.error()
  }

  if (request.destination === 'image') {
    return new Response('', { status: 204 })
  }

  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

async function handleWriteRequestWithBackgroundSync(request) {
  try {
    return await fetch(request)
  } catch {
    if (!('SyncManager' in self)) {
      return jsonFallback(503, {
        queued: false,
        error: 'offline',
        message: 'Background Sync is not supported by this browser',
      })
    }

    const queued = await queueRequest(request)
    if (queued) {
      try {
        await self.registration.sync.register(API_SYNC_TAG)
      } catch (error) {
        swLog('sync register failed', error)
      }
    }

    return jsonFallback(202, {
      queued,
      message: 'Request queued and will be retried when connection is restored',
    })
  }
}

async function replayQueuedRequests() {
  const db = await openQueueDb()
  const queued = await dbGetAll(db)
  if (!queued.length) {
    return
  }

  for (const item of queued) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      })

      if (response.ok) {
        await dbDelete(db, item.id)
      }
    } catch (error) {
      swLog('replay failed for queued request', error)
    }
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate'
}

function isStaticAsset(request) {
  return (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  )
}

function isImageRequest(request) {
  return request.destination === 'image'
}

function isApiRequest(request) {
  const url = new URL(request.url)
  return url.pathname.startsWith('/api/') || url.pathname.includes('/rest/v1/')
}

function isAllowedOrigin(rawUrl) {
  const url = new URL(rawUrl)
  if (ALLOWED_ORIGINS.has(url.origin)) {
    return true
  }

  return url.hostname.endsWith('.supabase.co')
}

function isCacheableResponse(response) {
  return response && response.ok && response.type !== 'opaque'
}

function metaKey(cacheName, request) {
  return `${cacheName}::${new URL(request.url).toString()}`
}

async function getValidCachedResponse(cacheName, request, ttlMs) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (!cached) {
    return null
  }

  const meta = await getCacheMetadata(cacheName, request)
  if (!meta) {
    await setCacheMetadata(cacheName, request, Date.now())
    return cached
  }

  if (Date.now() - meta.cachedAt > ttlMs) {
    await cache.delete(request)
    await deleteCacheMetadata(cacheName, request)
    return null
  }

  return cached
}

async function touchCacheEntry(cacheName, request) {
  const meta = await getCacheMetadata(cacheName, request)
  if (!meta) {
    return
  }
  await setCacheMetadata(cacheName, request, meta.cachedAt, Date.now())
}

async function enforceCacheLimit(cacheName, maxEntries) {
  const metadata = await getAllCacheMetadata(cacheName)
  if (metadata.length <= maxEntries) {
    return
  }

  metadata.sort((a, b) => a.lastAccessed - b.lastAccessed)
  const overflow = metadata.length - maxEntries
  const toDelete = metadata.slice(0, overflow)
  const cache = await caches.open(cacheName)

  await Promise.all(
    toDelete.map(async (entry) => {
      await cache.delete(entry.url)
      await deleteCacheMetadataByKey(entry.key)
    }),
  )
}

async function setCacheMetadata(cacheName, request, cachedAt, lastAccessed = Date.now()) {
  const cache = await caches.open(META_CACHE)
  const key = metaKey(cacheName, request)
  const body = JSON.stringify({
    key,
    cacheName,
    url: new URL(request.url).toString(),
    cachedAt,
    lastAccessed,
  })
  await cache.put(key, new Response(body, { headers: { 'Content-Type': 'application/json' } }))
}

async function getCacheMetadata(cacheName, request) {
  const cache = await caches.open(META_CACHE)
  const key = metaKey(cacheName, request)
  const response = await cache.match(key)
  if (!response) {
    return null
  }
  return response.json()
}

async function getAllCacheMetadata(cacheName) {
  const cache = await caches.open(META_CACHE)
  const keys = await cache.keys()
  const related = keys.filter((request) => request.url.includes(`${cacheName}::`))
  const items = []

  for (const request of related) {
    const response = await cache.match(request)
    if (!response) {
      continue
    }
    items.push(await response.json())
  }

  return items
}

async function deleteCacheMetadata(cacheName, request) {
  const cache = await caches.open(META_CACHE)
  await cache.delete(metaKey(cacheName, request))
}

async function deleteCacheMetadataByKey(key) {
  const cache = await caches.open(META_CACHE)
  await cache.delete(key)
}

function jsonFallback(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function parsePushPayload(data) {
  if (!data) {
    return {}
  }

  try {
    return data.json()
  } catch {
    return { body: await data.text() }
  }
}

async function focusOrOpenClient(targetUrl) {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windowClients) {
    if ('focus' in client) {
      client.navigate(targetUrl)
      return client.focus()
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(targetUrl)
  }

  return undefined
}

function swLog(...args) {
  if (IS_DEV) {
    console.info('[SW]', ...args)
  }
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pwa-sync-queue', 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function queueRequest(request) {
  try {
    const db = await openQueueDb()
    const bodyText = await request.clone().text()
    const headers = {}

    for (const [key, value] of request.headers.entries()) {
      headers[key] = value
    }

    await dbAdd(db, {
      url: request.url,
      method: request.method,
      headers,
      body: bodyText || null,
      createdAt: Date.now(),
    })

    return true
  } catch (error) {
    swLog('queue request failed', error)
    return false
  }
}

function dbAdd(db, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('requests', 'readwrite')
    tx.objectStore('requests').add(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function dbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('requests', 'readonly')
    const request = tx.objectStore('requests').getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

function dbDelete(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('requests', 'readwrite')
    tx.objectStore('requests').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clients.forEach((client) => client.postMessage(message))
}
