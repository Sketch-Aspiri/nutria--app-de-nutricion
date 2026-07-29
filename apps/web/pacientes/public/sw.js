/**
 * Service worker mínimo: cascarón offline y nada más.
 *
 * Reglas que lo mantienen honesto, porque un caché mal puesto en una app de
 * salud es peor que no tener caché:
 *
 * 1. **Solo se cachea el cascarón offline**, no las pantallas. Una versión
 *    vieja del plan o del peso servida desde el disco sería un dato clínico
 *    equivocado presentado como actual.
 * 2. **Nunca se toca `/api/`.** Todo lo que responde la API va anclado a la
 *    sesión del paciente; guardarlo dejaría datos de una cuenta en el disco
 *    para la siguiente que abra el navegador.
 * 3. **Solo GET del propio origen.** Ni POST, ni terceros.
 *
 * La estrategia es "red primero": si hay conexión, siempre gana la red. El
 * caché solo aparece cuando la navegación falla.
 */

const VERSION = 'nutria-paciente-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  // Sin esto, una versión nueva se queda esperando a que se cierren todas las
  // pestañas; en una PWA instalada eso puede tardar días.
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((clave) => clave !== VERSION).map((clave) => caches.delete(clave))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;

  if (peticion.method !== 'GET') return;
  if (new URL(peticion.url).origin !== self.location.origin) return;
  if (new URL(peticion.url).pathname.startsWith('/api/')) return;

  // Solo las navegaciones tienen respaldo. El resto pasa de largo a la red.
  if (peticion.mode !== 'navigate') return;

  evento.respondWith(
    fetch(peticion).catch(() => caches.match(OFFLINE_URL)),
  );
});
