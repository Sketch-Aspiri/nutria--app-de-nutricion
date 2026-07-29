import type { NextResponse } from 'next/server';

import { IaNoConfiguradaError, IaUpstreamError } from '@/server/ai/cliente';
import {
  CuotaClinicaAgotadaError,
  CuotaPacienteAgotadaError,
  PacienteSinExpedienteError,
  RecetaNoEncontradaError,
  SalidaIaInvalidaError,
} from '@/server/ai/servicioPaciente';
import { ErrorCode, internalError, jsonError, notFound } from '@/server/http';
import { logger } from '@/server/logger';

/**
 * Traducción a HTTP de los errores de la IA del paciente.
 *
 * Vive aquí y no en cada ruta porque los tres endpoints de §8 fallan igual y
 * deben responder igual: una diferencia entre ellos solo produciría mensajes
 * inconsistentes en la misma pantalla.
 */

/** Lo que se le dice al paciente cuando se agota la cuota del consultorio. */
const CLINICA_AGOTADA =
  'El asistente no está disponible por ahora. Si necesitas algo, escríbele a tu nutrióloga desde el chat.';

export function errorDeIaPaciente(error: unknown): NextResponse {
  if (error instanceof CuotaPacienteAgotadaError) {
    return jsonError(
      429,
      ErrorCode.AI_LIMIT_REACHED,
      `Ya usaste tus ${error.cuota.limite} consultas al asistente de este mes. Vuelve el mes que entra o escríbele a tu nutrióloga.`,
    );
  }

  // El paciente no se entera de en qué plan está su nutrióloga ni de cuánto le
  // queda: es información comercial de otra persona.
  if (error instanceof CuotaClinicaAgotadaError) {
    return jsonError(429, ErrorCode.AI_LIMIT_REACHED, CLINICA_AGOTADA);
  }

  if (error instanceof RecetaNoEncontradaError) {
    return notFound('No encontramos esa receta entre las que te enviaron.');
  }

  if (error instanceof PacienteSinExpedienteError) {
    return notFound('No encontramos tu expediente.');
  }

  if (error instanceof SalidaIaInvalidaError) {
    return jsonError(422, ErrorCode.AI_INVALID_OUTPUT, error.motivo);
  }

  if (error instanceof IaNoConfiguradaError) {
    return jsonError(503, ErrorCode.AI_NOT_CONFIGURED, 'El asistente no está disponible.');
  }

  if (error instanceof IaUpstreamError) {
    return jsonError(
      502,
      ErrorCode.AI_UPSTREAM_ERROR,
      'El asistente está saturado en este momento. Intenta de nuevo en unos segundos.',
    );
  }

  // El prompt y la respuesta nunca se loggean: llevan lo que el paciente comió,
  // que es dato de salud (regla 1 de CLAUDE.md).
  logger.error('Falló una interacción de IA del paciente', error);
  return internalError();
}
