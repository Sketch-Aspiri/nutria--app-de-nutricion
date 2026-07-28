import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';

import { Providers } from './providers';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'nutria — Panel de nutriólogo',
  description: 'Pacientes, planes alimenticios y seguimiento con IA integrada.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
