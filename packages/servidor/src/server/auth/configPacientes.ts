import { NextResponse } from 'next/server';
import type { NextAuthConfig } from 'next-auth';

import { authConfig } from './config';

/**
 * Configuración de sesión de la **app del paciente**, para su middleware.
 *
 * Hereda de `authConfig` lo que de verdad es común —estrategia JWT, duración,
 * callbacks de token y sesión— y sustituye lo que no puede serlo: a qué página
 * se manda a quien no tiene sesión y qué rutas exigen una.
 *
 * Son dos productos con audiencias distintas (§2 del plan). Meter las reglas
 * del paciente dentro de `authConfig` habría dejado un solo archivo decidiendo
 * el acceso a las dos apps, que es justo el acoplamiento que la arquitectura de
 * dos aplicaciones busca evitar.
 *
 * El proveedor de credenciales, el adaptador y los límites de tasa siguen
 * viviendo una sola vez en `./index.ts`: aquí no se duplica nada de eso.
 */

/** Lo único que se puede ver sin sesión. Todo lo demás exige una. */
const RUTAS_PUBLICAS = ['/entrar', '/activar', '/privacidad'];

/** Con sesión de paciente, estas rutas ya no tienen sentido. */
const RUTAS_DE_ENTRADA = ['/entrar', '/activar'];

function coincidePrefijo(pathname: string, prefijos: string[]): boolean {
  return prefijos.some((prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`));
}

export const authConfigPacientes = {
  ...authConfig,
  pages: { signIn: '/entrar' },
  callbacks: {
    ...authConfig.callbacks,
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const usuario = auth?.user;
      const esPublica = coincidePrefijo(nextUrl.pathname, RUTAS_PUBLICAS);

      // Un nutriólogo con sesión del panel no entra aquí. Se le manda a la
      // pantalla de acceso con un motivo, no a un bucle de redirecciones: sin
      // el corte, `authorized` lo rechazaría, Auth.js lo devolvería a /entrar,
      // y desde ahí volvería a intentar entrar indefinidamente.
      if (usuario && usuario.role !== 'END_USER') {
        if (nextUrl.pathname === '/entrar') return true;
        const destino = new URL('/entrar', nextUrl);
        destino.searchParams.set('error', 'sin_acceso');
        return NextResponse.redirect(destino);
      }

      if (usuario && coincidePrefijo(nextUrl.pathname, RUTAS_DE_ENTRADA)) {
        // `/activar` sí se deja pasar con sesión: el enlace de invitación puede
        // abrirse en un navegador donde ya hay otra cuenta iniciada.
        if (nextUrl.pathname.startsWith('/activar')) return true;
        return NextResponse.redirect(new URL('/', nextUrl));
      }

      if (esPublica) return true;

      // Sin sesión: Auth.js redirige a `pages.signIn` con el `callbackUrl`.
      return Boolean(usuario);
    },
  },
} satisfies NextAuthConfig;
