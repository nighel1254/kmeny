// DK Plánovač – Service Worker
const CACHE_NAME = 'dk-planovac-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Přijmi naplánované notifikace
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_ALARMS') {
    const alarms = e.data.alarms; // [{time, title, body}]
    alarms.forEach(alarm => {
      const delay = alarm.time - Date.now();
      if (delay <= 0) return;
      setTimeout(() => {
        self.registration.showNotification(alarm.title, {
          body: alarm.body,
          icon: '/kmeny/icon-192.png',
          badge: '/kmeny/icon-192.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: alarm.tag,
          requireInteraction: true, // notifikace zůstane dokud ji nezavřeš
          data: { url: alarm.url }
        });
      }, delay);
    });
  }
  if (e.data?.type === 'CLEAR_ALARMS') {
    // Nelze zrušit setTimeout v SW, ale tag zajistí že se nepřidají duplicity
  }
});

// Kliknutí na notifikaci otevře stránku
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/kmeny/plan.html';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('plan.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
