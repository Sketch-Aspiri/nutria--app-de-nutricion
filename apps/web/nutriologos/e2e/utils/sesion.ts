import type { BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import type { CuentaPrueba } from './cuentas';

/**
 * Siembra la cookie de sesión sin pasar por el formulario de login.
 *
 * Por qué: `authorize()` limita el login a 15 intentos por IP cada 15 minutos
 * (`packages/servidor/src/server/auth/index.ts`). La suite completa hace más de
 * treinta inicios de sesión, todos desde 127.0.0.1 y contra un mismo proceso de
 * servidor, así que a partir del decimosexto la defensa —haciendo exactamente
 * su trabajo— devolvía credenciales inválidas y los tests morían esperando la
 * navegación a `/pacientes`.
 *
 * No se eleva ni se elimina el tope para acomodar la suite: sembrar la cookie
 * evita gastar intentos en tests cuyo objetivo no es autenticar. El formulario
 * conserva el límite real en `sesion.spec.ts`.
 *
 * El formulario real se sigue ejercitando en `sesion.spec.ts`, que es donde
 * corresponde probarlo.
 */

/**
 * Auth.js usa el prefijo `__Secure-` solo sobre HTTPS. Los E2E corren en
 * http://localhost, así que la cookie va sin prefijo.
 */
const NOMBRE_COOKIE = 'authjs.session-token';

/** Igual que `SESION_MAX_SEGUNDOS` en la configuración de Auth.js. */
const DURACION_SEGUNDOS = 60 * 60 * 8;

/**
 * El token debe traer los mismos campos que pone el callback `jwt`, o el
 * callback `session` construirá una sesión incompleta y el middleware mandará
 * a `/verificar`.
 */
export async function sembrarSesion(context: BrowserContext, cuenta: CuentaPrueba): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET no está definido. `playwright.config.ts` debe fijar la clave E2E; ' +
        'sin él la cookie sembrada no coincidiría con la que el servidor sabe leer.',
    );
  }

  const token = await encode({
    salt: NOMBRE_COOKIE,
    secret,
    maxAge: DURACION_SEGUNDOS,
    token: {
      sub: cuenta.id,
      userId: cuenta.id,
      role: 'NUTRITIONIST',
      emailVerificado: true,
      name: cuenta.nombre,
      email: cuenta.email,
    },
  });

  await context.addCookies([
    {
      name: NOMBRE_COOKIE,
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + DURACION_SEGUNDOS,
    },
  ]);
}
