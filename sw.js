/* Ninho — Service Worker
   * App shell em cache (funciona offline)
   * Bibliotecas de CDN: stale-while-revalidate
   * Dados de saúde (Supabase) NUNCA entram no cache do SW
   * Recebe Web Push e abre o app ao tocar na notificação */
const VERSION = 'ninho-v2.0.0';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/clinical.js', 'js/store.js', 'js/alerts.js', 'js/notify.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDN = /^(https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com))\//;

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/supabase\.co$/.test(url.hostname)) return;                    // dados: só rede
  if (CDN.test(req.url)) {                                            // bibliotecas
    e.respondWith(caches.open(VERSION + '-cdn').then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin === location.origin) {                               // app shell: rede primeiro, cache se offline
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
  }
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ninho', { body: d.body || 'Você tem um lembrete 💜', tag: d.tag || 'ninho', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.focus(); return w.navigate ? w.navigate(url) : null; }
    return self.clients.openWindow(url);
  }));
});
