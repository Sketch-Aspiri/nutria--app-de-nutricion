import { timingSafeEqual } from 'node:crypto';

import { ErrorCode, jsonError, unauthenticated } from '@/server/http';
import { logger } from '@/server/logger';

import type { NextResponse } from 'next/server';

/**
 * Autorización de las rutas de cron.
 *
 * Vercel Cron invoca la ruta con `Authorization: Bearer $CRON_SECRET`. Sin
 * esta comprobación, cualquiera podría dispararlas desde internet: los
 * recordatorios se enviarían fuera de hora y la ruta sería un amplificador de
 * correo gratuito.
 */

function comparacionConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  // `timingSafeEqual` exige la misma longitud; comparar antes la filtraría,
  // pero la longitud del secreto no es lo que hay que proteger.
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function verificarCron(request: Request): NextResponse | null {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    // Sin secreto configurado la ruta queda cerrada: abrirla "mientras tanto"
    // dejaría un endpoint público en producción.
    logger.error('CRON_SECRET no está configurado; la ruta de cron queda cerrada');
    return jsonError(
      503,
      ErrorCode.INTERNAL_ERROR,
      'Las tareas programadas no están configuradas en este entorno.',
    );
  }

  const cabecera = request.headers.get('authorization') ?? '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  if (!token || !comparacionConstante(token, secreto)) {
    return unauthenticated('Esta ruta solo la puede invocar el programador de tareas.');
  }

  return null;
}
