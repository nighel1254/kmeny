// DK Plánovač – Service Worker v3
const CACHE_VERSION = 'v3';
const MAX_STALE_MS = 5 * 60 * 1000; // 5 minut – starší notifikace zahazujeme

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
  let data = { title: '⚔️ DK útok!', body: 'Čas odeslat útok!', tag: 'dk-alarm', url: '/kmeny/plan.html' }
  if (e.data) {
    try { data = { ...data, ...e.data.json() } } catch(err) {
      try { data.body = e.data.text() } catch(e2) {}
    }
  }

  // Zahodit staré notifikace (prohlížeč může buffrem doručit push s dlouhým zpožděním)
  if (data.send_time && Date.now() - data.send_time > MAX_STALE_MS) {
    console.log('[SW] Zahozena stará notifikace, stáří:', Math.round((Date.now()-data.send_time)/1000), 's');
    return;
  }

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
  )
})

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
