/* ================================================================
   SERVICE WORKER — Mode hors ligne
   Plan stratégique — Muni-Consul
   ================================================================ */
const CACHE_NAME   = 'plan-strategique-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/auth.js',
  './js/alerts.js',
  './js/config.js',
  './js/data.js',
  './js/export.js',
  './js/modal.js',
  './js/navigation.js',
  './js/render.js',
  './js/settings.js',
  './js/sharepoint.js',
  './js/state.js',
  './js/utils.js',
];

/* ----- INSTALL : mettre en cache les fichiers statiques ----- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ----- ACTIVATE : supprimer les vieux caches ----- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ----- FETCH : réseau d'abord, cache en fallback ----- */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requêtes SharePoint / Graph API → réseau seulement (pas de cache)
  if (url.hostname.includes('sharepoint.com') ||
      url.hostname.includes('graph.microsoft.com') ||
      url.hostname.includes('microsoftonline.com')) {
    return; // laisser passer sans interception
  }

  // Ressources statiques → cache d'abord, réseau en fallback
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached); // hors ligne → retourner le cache
        return cached || networkFetch;
      })
    );
  }
});
