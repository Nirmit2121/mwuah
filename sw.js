// Mwuah — tiny offline-first service worker.
const CACHE = 'mwuah-v6';
const SHELL = [
  'login.html', 'index.html', 'manifest.webmanifest',
  'styles/tokens.css', 'styles/base.css', 'styles/components.css', 'styles/layout.css', 'styles/pages.css',
  'js/main.js', 'js/config.js', 'js/supabase.js', 'js/api.js', 'js/auth.js', 'js/router.js',
  'js/state.js', 'js/ui.js', 'js/effects.js', 'js/medinfo.js', 'js/push.js',
  'js/pages/home.js', 'js/pages/expenses.js', 'js/pages/cycle.js', 'js/pages/notes.js',
  'js/pages/bucket.js', 'js/pages/memories.js', 'js/pages/dates.js', 'js/pages/savings.js', 'js/pages/meds.js',
  'assets/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Only handle same-origin GETs; let Supabase / fonts / CDN go straight to network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const url = new URL(request.url);
  // Always-fresh for the app code & pages (so edits show up immediately); cache is only a
  // fallback when offline. Other assets (icons, fonts) stay cache-first for speed.
  const fresh = request.mode === 'navigate' || url.pathname.endsWith('.html')
    || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')
    || url.pathname.endsWith('manifest.webmanifest');

  if (fresh) {
    e.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(request))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((hit) =>
      hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => hit)
    )
  );
});

// ---------- Web Push ----------
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text() }; }
  const title = data.title || 'Mwuah 💞';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    data: { url: data.url || './index.html' },
    tag: data.tag || 'mwuah',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
