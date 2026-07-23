import type { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

import { prisma } from '@/server/db';
import { ErrorCode, internalError, jsonError, unauthenticated } from '@/server/http';
import { logger } from '@/server/logger';

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

  let usuario;
  try {
    usuario = await prisma.user.findFirst({
      where: { id: sesion.user.id, deletedAt: null },
      select: { emailVerified: true, role: true },
    });
  } catch (error: unknown) {
    logger.error('Falló la validación de la sesión contra la base de datos', error);
    return { ok: false, respuesta: internalError() };
  }
  if (!usuario) {
    return { ok: false, respuesta: unauthenticated() };
  }

  if (!usuario.emailVerified) {
    return {
      ok: false,
      respuesta: jsonError(
        403,
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Confirma tu correo para poder usar la plataforma.',
      ),
    };
  }

  if (usuario.role !== 'NUTRITIONIST' && usuario.role !== 'ADMIN') {
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
