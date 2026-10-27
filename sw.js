// ============================================================================
// SERVICE WORKER (PWA — APLICATIVO INSTALÁVEL NO CELULAR E PC)
// ============================================================================
// Permite que o navegador reconheça o sistema como um aplicativo instalável
// e mantenha os arquivos essenciais em cache para abertura rápida.

const CACHE_NAME = 'financas-casal-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/utils.js',
  './js/data-seed.js',
  './js/state.js',
  './js/finance-engine.js',
  './js/importer-backup.js',
  './js/actions.js',
  './js/supabase-sync.js',
  './js/ui-render.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Segurança: só guardamos em cache os arquivos do próprio app (mesma origem).
  // Respostas do Supabase (dados financeiros) e de CDNs NUNCA entram no cache,
  // para não deixar dados sensíveis guardados no aparelho fora do controle do app.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
