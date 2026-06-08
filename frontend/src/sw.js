// Silence workbox's verbose debug logs in production (600+ messages per deploy)
self.__WB_DISABLE_DEV_LOGS = true

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// Clean old caches
cleanupOutdatedCaches()

// Force the service worker to activate immediately
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

// Precache critical assets (JS, CSS, HTML only - configured in vite.config.js)
precacheAndRoute(self.__WB_MANIFEST)

// ─── Runtime Caching ───

// Cache Images (CacheFirst - they don't change often)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
)

// Cache Videos (CacheFirst - includes the EleFam mascot video for offline mode)
registerRoute(
  ({ request }) => request.destination === 'video',
  new CacheFirst({
    cacheName: 'videos',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
)

// Cache Fonts (CacheFirst)
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Year
      }),
    ],
  })
)

// Dashboard stats use IndexedDB + adjustStat offline — never serve stale SW cache for totals
registerRoute(
  ({ url }) => url.pathname.includes('/dashboard/stats'),
  new NetworkOnly()
)

// Cache API calls (NetworkFirst)
// NetworkFirst ensures we ALWAYS get the live, correct data when online (fixing the deposit bug),
// but falls back to the cache if the user is offline or the network is failing.
// iOS Safari may need slightly longer timeout due to network handling differences
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5, // Increased timeout for iOS compatibility
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 Hours
      }),
    ],
  })
)

// Handle update skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ─── Push Notifications ───

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icons/wallets/EF-logo-192.png',
      badge: data.badge || '/icons/wallets/EF-logo-192.png',
      data: data.data || { url: '/' },
      tag: data.tag || 'general',
      renotify: data.renotify || false,
      vibrate: [100, 50, 100],
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  } catch (e) {
    console.error('Push event error:', e)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open with this URL
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
