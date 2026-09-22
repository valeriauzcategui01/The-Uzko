// Service worker de Uzko: lo justo para que la app se pueda instalar y
// abra aunque la red falle un momento.
//
// Nunca toca /api/ ni /adjuntos/: ahí hay sesión y datos, y una respuesta
// cacheada enseñaría gastos viejos o de otro usuario. Eso siempre va a la red.
const CACHE = 'uzko-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/')))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/adjuntos/')) return

  // Páginas: primero la red, para que un deploy nuevo se vea al instante.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && url.pathname === '/') {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put('/', copia))
          }
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Los archivos de /assets/ llevan hash en el nombre: si está en caché, sirve.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copia = res.clone()
              caches.open(CACHE).then((c) => c.put(request, copia))
            }
            return res
          }),
      ),
    )
  }
})
