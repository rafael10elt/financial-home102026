/*
 * Service worker do Financial Home — Fase 1.
 *
 * Escopo atual (deliberadamente limitado):
 *  - Cache do shell da aplicação (navegação + assets estáticos hashados).
 *  - Rede primeiro para navegação, com fallback ao shell offline.
 *  - NÃO cacheia respostas autenticadas da API (Supabase) nem dados privados.
 *  - Limpa caches privados quando recebe a mensagem 'fh:clear-private'.
 */

const SHELL_CACHE = 'fh-shell-v2'
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'fh:clear-private') {
    event.waitUntil(caches.delete(SHELL_CACHE))
  }
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() ?? '' }
  }
  const title = typeof payload.title === 'string' ? payload.title : 'Financial Home'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Você tem uma nova notificação.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : 'financial-home',
    data: { url: typeof payload.url === 'string' ? payload.url : '/' },
    renotify: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin))
      if (existing) return existing.navigate(destination).then((client) => client?.focus())
      return self.clients.openWindow(destination)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Nunca intercepta a API autenticada.
  if (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(async () => (await caches.match('/')) ?? Response.error()),
    )
    return
  }

  // Assets com hash: cache primeiro, rede em segundo.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
