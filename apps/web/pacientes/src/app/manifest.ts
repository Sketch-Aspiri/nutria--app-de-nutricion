import type { MetadataRoute } from 'next';

/**
 * Manifiesto de instalación. Next lo sirve en `/manifest.webmanifest`.
 *
 * Sin `shortcuts` ni `share_target` en la V1: cada atajo apunta a una pantalla
 * que todavía no tiene contenido propio, y prometer desde el icono del sistema
 * algo que no está sería peor que no ofrecerlo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'nutria — tu plan de nutrición',
    short_name: 'nutria',
    description: 'Tu plan, tu progreso y tu nutrióloga, siempre contigo.',
    // `standalone` es lo que quita la barra del navegador al abrirla desde el
    // icono; sin él, Chrome no ofrece instalar.
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    scope: '/',
    lang: 'es-MX',
    dir: 'ltr',
    background_color: '#fafaf9',
    theme_color: '#064e3b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // `maskable` deja que Android recorte el icono a la forma del sistema sin
      // comerse el logotipo: el arte ya trae margen para eso.
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
