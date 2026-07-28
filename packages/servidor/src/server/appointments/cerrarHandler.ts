import type { NextResponse } from 'next/server';

import { requiereNutriologo } from '@/server/auth/guards';
import { ErrorCode, internalError, jsonError, jsonOk, notFound } from '@/server/http';
import { logger } from '@/server/logger';

import { cerrarCita, CitaNoEditableError } from './repository';
import { serializarCita } from './serializers';

/**
 * Cuerpo compartido por `/cancel`, `/complete` y `/no_show`: las tres rutas
 * solo se diferencian en el estado final, y duplicar el manejo de errores en
 * cada una invitaría a que se desincronizaran.
 */
export async function responderCierreDeCita(
  citaId: string,
  estado: 'CANCELADA' | 'COMPLETADA' | 'NO_ASISTIO',
): Promise<NextResponse> {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const cita = await cerrarCita(sesion.userId, citaId, estado);
    if (!cita) return notFound('No se encontró la cita.');
    return jsonOk(serializarCita(cita));
  } catch (error: unknown) {
    if (error instanceof CitaNoEditableError) {
      return jsonError(
        409,
        ErrorCode.APPOINTMENT_NOT_EDITABLE,
        'Esta cita ya está cerrada. Reábrela desde la agenda si necesitas corregirla.',
      );
    }
    logger.error('Falló el cierre de la cita', error);
    return internalError();
  }
}
