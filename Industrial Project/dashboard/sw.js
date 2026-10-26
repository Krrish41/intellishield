/**
 * IntelliShield PWA Service Worker
 * Provides offline caching for client-side simulator and defense viva presentations.
 */

const CACHE_NAME = 'intellishield-shell-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/layout.css',
  './css/animations.css',
  './css/pages.css',
  './js/app.js',
  './js/router.js',
  './js/theme.js',
  './js/cursor.js',
  './js/background.js',
  './js/datasource.js',
  './js/model.js',
  './js/components/icons.js',
  './js/components/charts.js',
  './js/components/topology.js',
  './js/components/globe.js',
  './js/components/modal.js',
  './js/components/command_palette.js',
  './js/pages/overview.js',
  './js/pages/console.js',
  './js/pages/architecture.js',
  './js/pages/ml_lab.js',
  './js/pages/mitigation.js',
  './js/pages/simulator.js',
  './js/pages/benchmarks.js',
  './js/pages/globe_page.js',
  './js/pages/docs.js',
  './js/pages/research.js',
  './js/pages/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Never cache dynamic API or status telemetry endpoints
  if (e.request.url.includes('/intellishield/') || e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
