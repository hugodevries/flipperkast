const NAAM = 'flipperkast-v2';
const BESTANDEN = ['./', './index.html', './spel.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(NAAM).then(c => c.addAll(BESTANDEN))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== NAAM).map(n => caches.delete(n))))); self.clients.claim(); });
// Eerst online proberen (dan krijg je altijd de nieuwste versie), anders uit het geheugen
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).then(r => { const kopie = r.clone(); caches.open(NAAM).then(c => c.put(e.request, kopie)); return r; }).catch(() => caches.match(e.request)));
});
