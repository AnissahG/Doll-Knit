// Doll knit Pattern Studio — offline app-shell cache (PWA only; the APK bundles its files).
// Bump CACHE_NAME whenever any file changes so returning visitors get the new version.
const CACHE_NAME = 'doll-knit-v29';
const ASSETS = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/platform.js', './js/backup.js', './js/drawing.js', './js/dolls.js', './js/app.js',
  './vendor/fonts/fraunces-400.woff2', './vendor/fonts/fraunces-600.woff2', './vendor/fonts/fraunces-700.woff2',
  './vendor/fonts/inter-400.woff2', './vendor/fonts/inter-600.woff2', './vendor/fonts/inter-700.woff2',
  './vendor/fonts/jetbrains-mono-400.woff2', './vendor/fonts/jetbrains-mono-600.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/logo.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
    if (res && res.status === 200 && new URL(event.request.url).origin === location.origin) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
    }
    return res;
  }).catch(() => cached)));
});
