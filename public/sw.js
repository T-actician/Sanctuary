// Sanctuary Service Worker — offline-first caching + background alarms
const CACHE_NAME = 'sanctuary-v3';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-384x384.png',
  '/icons/apple-touch-icon.png'
];

// External CDN assets to cache on first use
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com'
];

// ── Install: cache app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache what we can — don't fail install if CDN is unreachable
        return cache.addAll(PRECACHE).catch(() => {});
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept: Supabase, R2/Workers, non-GET
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('hzbcerubdaldvapsajce')
  ) return;

  // App shell navigation → cache-first, network fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then(cached => {
          // Serve cached immediately, update in background
          const networkFetch = fetch(event.request)
            .then(res => {
              if (res && res.status === 200) {
                caches.open(CACHE_NAME).then(c => c.put('/index.html', res.clone()));
              }
              return res;
            })
            .catch(() => null);
          return cached || networkFetch;
        })
    );
    return;
  }

  // CDN assets (icons, fonts, pdfjs, xlsx, mammoth) → cache-first, network fallback, cache result
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Same-origin static assets → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }
});

// ── Background alarm scheduling ──
let alarmSchedules = [];
let _alarmTimeout = null;

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_ALARMS') {
    alarmSchedules = event.data.alarms || [];
    scheduleNextAlarm();
  }
});

function scheduleNextAlarm() {
  if (_alarmTimeout) { clearTimeout(_alarmTimeout); _alarmTimeout = null; }
  if (!alarmSchedules.length) return;
  const now = Date.now();
  let nextItem = null;
  for (const alarm of alarmSchedules) {
    if (alarm.fireAt > now && (!nextItem || alarm.fireAt < nextItem.fireAt)) {
      nextItem = alarm;
    }
  }
  if (!nextItem) return;
  _alarmTimeout = setTimeout(async () => {
    await self.registration.showNotification(
      'Sanctuary ' + (nextItem.type === 'alarm' ? '⏰' : '🔔'),
      {
        body: nextItem.label || (nextItem.type === 'alarm' ? 'Alarm' : 'Reminder'),
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: 'sanctuary-alarm-' + nextItem.id,
        requireInteraction: true,
        actions: [
          { action: 'dismiss', title: 'Dismiss' },
          { action: 'snooze', title: 'Snooze 5 min' }
        ]
      }
    );
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({
      type: 'ALARM_FIRED',
      id: nextItem.id,
      label: nextItem.label,
      alarmType: nextItem.type
    }));
    scheduleNextAlarm();
  }, nextItem.fireAt - now);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  if (event.action === 'snooze') {
    const item = alarmSchedules.find(a => a.id === event.notification.data?.id);
    if (item) { item.fireAt = Date.now() + 5 * 60 * 1000; scheduleNextAlarm(); }
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(windows => {
      for (const w of windows) { if ('focus' in w) return w.focus(); }
      return self.clients.openWindow('/?alarm=1');
    })
  );
});
