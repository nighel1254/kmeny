// DK Plánovač – Service Worker v2
const CACHE_VERSION = 'v2';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/kmeny/icon-192.png',
      badge: '/kmeny/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'dk-alarm',
      requireInteraction: true,
      data: { url: data.url || '/kmeny/plan.html' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/kmeny/plan.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('plan.html') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
