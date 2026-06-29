// Sanctuary Service Worker — offline caching + background alarms
const CACHE_NAME = 'sanctuary-v2';

// App shell — everything needed to run offline
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── Install: cache app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for API, cache-first for assets ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Supabase / R2 / external API calls
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('cloudflare') ||
    event.request.method !== 'GET'
  ) return;

  // For navigation (HTML pages) — network first, fall back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For static assets (JS/CSS/fonts/icons) — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      });
    })
  );
});

// ── Background alarm scheduling ──
let alarmSchedules = [];
let _alarmTimeout = null;

self.addEventListener('message', event => {
  if (event.data.type === 'SCHEDULE_ALARMS') {
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

  const delay = nextItem.fireAt - now;
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

    // Tell open tabs
    const clientsList = await self.clients.matchAll();
    clientsList.forEach(client => client.postMessage({
      type: 'ALARM_FIRED',
      id: nextItem.id,
      label: nextItem.label,
      alarmType: nextItem.type
    }));

    scheduleNextAlarm();
  }, delay);
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
      for (const w of windows) {
        if ('focus' in w) return w.focus();
      }
      return self.clients.openWindow('/?alarm=1');
    })
  );
});
