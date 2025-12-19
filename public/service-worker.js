
const CACHE_NAME = 'music-companion-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests and external API calls
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Don't cache API calls or external requests
  if (url.origin !== self.location.origin || 
      url.pathname.startsWith('/api') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('audioscrobbler') ||
      url.hostname.includes('last.fm')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Return a simple fallback for failed requests
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
