import type { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

import { ErrorCode, jsonError, unauthenticated } from '@/server/http';

import { auth } from './index';

export type SesionValida = { ok: true; sesion: Session; userId: string };
export type SesionInvalida = { ok: false; respuesta: NextResponse };
export type ResultadoSesion = SesionValida | SesionInvalida;

/**
 * Guarda de autorización para los handlers de `/api/v1`.
 *
 * Cada endpoint la invoca aunque el middleware ya proteja la ruta: el middleware
 * cubre la navegación del panel, no las llamadas directas a la API.
 */
export async function requiereNutriologo(): Promise<ResultadoSesion> {
  const sesion = await auth();

  if (!sesion?.user?.id) {
    return { ok: false, respuesta: unauthenticated() };
  }

  if (!sesion.user.emailVerificado) {
    return {
      ok: false,
      respuesta: jsonError(
        403,
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Confirma tu correo para poder usar la plataforma.',
      ),
    };
  }

  if (sesion.user.role !== 'NUTRITIONIST' && sesion.user.role !== 'ADMIN') {
    return {
      ok: false,
      respuesta: jsonError(
        403,
        ErrorCode.FORBIDDEN,
        'Tu cuenta no tiene acceso al panel de nutriólogo.',
      ),
    };
  }

  return { ok: true, sesion, userId: sesion.user.id };
}
