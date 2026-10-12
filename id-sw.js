// Service worker minimo di Estji ID: serve solo a rendere la pagina installabile.
// Non mette mai in cache le chiamate /api e prende sempre la pagina dalla rete (la cache è solo un ripiego offline).
const CACHE = 'estji-id-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/api/') === 0) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(r, c)); return res; })
      .catch(() => caches.match(r)));
  }
});
