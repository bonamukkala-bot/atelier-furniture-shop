// Atelier Minimal Service Worker for PWA Installability
const CACHE_NAME = 'atelier-pwa-v1';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for older workers to shut down
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim control over all open clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Passthrough fetch to fulfill installability criteria without stale cache side-effects
  event.respondWith(fetch(event.request));
});
