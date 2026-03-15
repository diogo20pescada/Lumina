const CACHE_NAME = "lumina-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/style.css",
  "/manifest.json",
  "/favicon.png"
];

// Instalar: guarda os assets em cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Ativar: limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve do cache para assets estáticos, rede para API
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Pedidos à API vão sempre para a rede
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/chat") || url.pathname.startsWith("/auth") || url.pathname.startsWith("/historico") || url.pathname.startsWith("/plano") || url.pathname.startsWith("/payment") || url.pathname.startsWith("/perfil")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
