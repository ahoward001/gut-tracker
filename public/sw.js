// Service Worker for Gut Tracker PWA
// Handles background check-in reminders via Periodic Background Sync

const CHECK_TIMES = [
  { hour: 7,  minute: 0,  label: 'Wake-up' },
  { hour: 9,  minute: 0,  label: 'Morning' },
  { hour: 13, minute: 0,  label: 'Lunch' },
  { hour: 17, minute: 0,  label: 'Afternoon' },
  { hour: 21, minute: 0,  label: 'Evening' },
]

// Cache name for offline support
const CACHE_NAME = 'gut-tracker-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Periodic Background Sync — fires when browser allows (Android Chrome PWA)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'gut-check-in') {
    event.waitUntil(checkAndNotify())
  }
})

// Push notification handler (if server-sent push is ever added)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Gut Check 🌿', {
      body: data.body || 'Time to log how you\'re feeling.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'gut-checkin',
      renotify: true,
      data: { url: '/' }
    })
  )
})

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow('/')
    })
  )
})

async function checkAndNotify() {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()

  for (const slot of CHECK_TIMES) {
    // Fire if we're within 5 minutes of a check-in time (before or after)
    const timeDiff = Math.abs(hour * 60 + minute - (slot.hour * 60 + slot.minute))
    const within5Min = timeDiff <= 5 || (60 * 24 - timeDiff) <= 5 // Handle day wrap-around

    if (within5Min) {
      const existingNotifs = await self.registration.getNotifications({ tag: `gut-${slot.hour}` })
      if (existingNotifs.length === 0) {
        await self.registration.showNotification(`Gut Check — ${slot.label} 🌿`, {
          body: 'Tap to log how you\'re feeling.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `gut-${slot.hour}`,
          renotify: true,
          data: { url: '/' }
        })
      }
    }
  }
}

// Fetch handler — serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return
  if (event.request.url.startsWith('chrome-extension')) return

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request)
    })
  )
})
