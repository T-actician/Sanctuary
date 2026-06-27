// Service Worker for Sanctuary — handles background alarms/reminders
const CACHE_NAME = 'sanctuary-v1';
const URLS_TO_CACHE = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

let alarmSchedules = [];

self.addEventListener('message', event => {
  if (event.data.type === 'SCHEDULE_ALARMS') {
    alarmSchedules = event.data.alarms || [];
    scheduleNextAlarm();
  }
});

function scheduleNextAlarm() {
  clearTimeout(alarmSchedules._timeout);
  if (!alarmSchedules.length) return;

  const now = Date.now();
  let next = null;
  let nextItem = null;

  for (const alarm of alarmSchedules) {
    if (alarm.fireAt > now && (!next || alarm.fireAt < next)) {
      next = alarm.fireAt;
      nextItem = alarm;
    }
  }

  if (nextItem) {
    const delay = nextItem.fireAt - now;
    alarmSchedules._timeout = setTimeout(async () => {
      // Show notification
      const options = {
        body: nextItem.label || (nextItem.type === 'alarm' ? 'Alarm' : 'Reminder'),
        icon: '/icons/apple-touch-icon.png',
        badge: '/icons/apple-touch-icon.png',
        tag: 'sanctuary-' + nextItem.type,
        requireInteraction: true,
        actions: [
          { action: 'dismiss', title: 'Dismiss' },
          { action: 'snooze', title: 'Snooze 5 min' }
        ]
      };

      await self.registration.showNotification('Sanctuary ' + (nextItem.type === 'alarm' ? '⏰' : '🔔'), options);

      // Tell app about fired alarm
      const clients_list = await clients.matchAll();
      clients_list.forEach(client => {
        client.postMessage({
          type: 'ALARM_FIRED',
          id: nextItem.id,
          label: nextItem.label,
          alarmType: nextItem.type
        });
      });

      scheduleNextAlarm();
    }, delay);
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  if (event.action === 'snooze') {
    // Snooze 5 min
    const idx = alarmSchedules.findIndex(a => a.id === event.notification.tag.split('-')[1]);
    if (idx >= 0) {
      alarmSchedules[idx].fireAt = Date.now() + 5 * 60 * 1000;
      scheduleNextAlarm();
    }
    return;
  }

  // Open/focus app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windows => {
      for (let i = 0; i < windows.length; i++) {
        if (windows[i].url.includes('sanctuary')) {
          return windows[i].focus();
        }
      }
      return clients.openWindow('/?alarm=1');
    })
  );
});

self.addEventListener('notificationclose', event => {
  // Optional: handle dismiss
});
