// Sanctuary Service Worker — background alarm notifications
// Version bump forces reinstall when updated
const VERSION = 'sanctuary-sw-v3';

// ── Alarm store ──
// Kept in SW memory; refreshed every time the app calls postAlarmsToSW().
let _scheduledAlarms = [];
let _timers = {};

function clearAllTimers() {
  Object.values(_timers).forEach(t => clearTimeout(t));
  _timers = {};
}

function scheduleAlarms(alarms) {
  clearAllTimers();
  _scheduledAlarms = alarms || [];
  const now = Date.now();
  _scheduledAlarms.forEach(alarm => {
    const delay = alarm.fireAt - now;
    if (delay < 0 || delay > 24 * 60 * 60 * 1000) return; // skip past or >24h out
    _timers[alarm.id] = setTimeout(() => fireAlarm(alarm), delay);
  });
}

async function fireAlarm(alarm) {
  // 1. Try to wake/message the app tab first — if it's open and visible,
  //    the in-app ring overlay is better UX than a system notification.
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clients.length > 0) {
    clients.forEach(c => c.postMessage({
      type: 'ALARM_FIRED',
      id: alarm.id,
      label: alarm.label,
      alarmType: alarm.type
    }));
    // Also show notification so device screen lights up even if tab is backgrounded
  }

  // 2. Show a system notification — this works even when the tab is closed.
  //    The 'requireInteraction: true' keeps it on screen until dismissed.
  if (self.registration && Notification.permission !== 'denied') {
    try {
      await self.registration.showNotification(
        alarm.type === 'reminder' ? '🔔 Reminder' : '⏰ Alarm',
        {
          body: alarm.label || (alarm.type === 'reminder' ? 'Reminder' : 'Alarm'),
          icon: '/icons/apple-touch-icon.png',
          badge: '/icons/apple-touch-icon.png',
          tag: 'sanctuary-alarm-' + alarm.id,
          requireInteraction: true,
          vibrate: [400, 200, 400, 200, 400, 200, 400],
          data: { alarmId: alarm.id, alarmType: alarm.type, url: '/?alarm=1' }
        }
      );
    } catch(e) {
      console.warn('[SW] showNotification failed', e);
    }
  }
}

// ── Message handler — receives SCHEDULE_ALARMS from the app ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_ALARMS') {
    scheduleAlarms(event.data.alarms);
  }
});

// ── Notification click — open / focus the app ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/?alarm=1';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If a tab is already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'ALARM_FIRED',
            id: event.notification.data.alarmId,
            label: event.notification.body,
            alarmType: event.notification.data.alarmType
          });
          return;
        }
      }
      // Otherwise open a new tab
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Install / activate — take control immediately ──
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
