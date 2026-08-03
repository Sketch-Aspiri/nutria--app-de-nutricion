import type { Metadata, Viewport } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';

import { RegistrarServiceWorker } from '@/components/pwa/RegistrarServiceWorker';

import { Providers } from './providers';

import './globals.css';

/**
 * Las fuentes se cargan con `next/font`: se autoalojan en el build, así que no
 * hay petición a Google desde el navegador del paciente —ni el parpadeo del
 * `<link>` inyectado en `useEffect` que traía el prototipo— y la CSP puede
 * mantener `font-src 'self'`.
 */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'nutria',
  description: 'Tu plan, tu progreso y tu nutrióloga, siempre contigo.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'nutria',
    // La barra de estado se funde con el verde del encabezado al instalarla.
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  // La app del paciente no tiene nada que buscar en Google, y sus URLs son de
  // una persona: se pide explícitamente no indexarla.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#064e3b',
  width: 'device-width',
  initialScale: 1,
  // `viewport-fit=cover` es lo que hace que `env(safe-area-inset-*)` devuelva
  // algo distinto de cero en iPhone; sin él, la barra inferior se corta.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} font-sans`}>
        <Providers>
          {/* Sin marco de teléfono — es una app web real. El ancho ya no se
              limita aquí: cada pantalla decide el suyo (acceso centrado,
              texto legal en columna de lectura, app con barra lateral en
              escritorio), porque un solo límite global no sirve para las tres. */}
          <div className="min-h-screen w-full bg-stone-50">{children}</div>
        </Providers>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
