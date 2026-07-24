import type { NextResponse } from 'next/server';

import { requiereNutriologo } from '@/server/auth/guards';
import { IaNoConfiguradaError, IaUpstreamError, iaConfigurada } from '@/server/ai/cliente';
import {
  CuotaAgotadaError,
  type EventoProgreso,
  PacienteNoEncontradoError,
  type SalidaGeneracion,
  generarContenido,
} from '@/server/ai/servicio';
import { generarSchema } from '@/server/ai/schemas';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';

/**
 * `POST /api/v1/ai/generate` — único endpoint de IA del panel, con `tipo`
 * discriminado (sección 8 del plan V2).
 *
 * Con `stream: true` responde Server-Sent Events; sin él, JSON normal. En ambos
 * casos el resultado final tiene la misma forma, para que la UI no dependa del
 * transporte.
 *
 * Nada de lo que entra o sale se loggea: son datos clínicos.
 */

export const runtime = 'nodejs';
/** Una generación de plan puede tardar; el default de Vercel se queda corto. */
export const maxDuration = 120;

function mensajeDeUpstream(status?: number): string {
  if (status === 429) {
    return 'El servicio de IA está saturado en este momento. Intenta de nuevo en unos segundos.';
  }
  return 'El servicio de IA no está disponible en este momento. Intenta de nuevo.';
}

function errorDeGeneracion(error: unknown): NextResponse {
  if (error instanceof CuotaAgotadaError) {
    return jsonError(
      429,
      ErrorCode.AI_LIMIT_REACHED,
      `Agotaste las ${error.cuota.limite} generaciones de IA de este mes en tu plan ${error.cuota.plan}. Mejora tu plan para continuar.`,
    );
  }
  if (error instanceof PacienteNoEncontradoError) return notFound('No se encontró el paciente.');
  if (error instanceof IaNoConfiguradaError) {
    return jsonError(
      503,
      ErrorCode.AI_NOT_CONFIGURED,
      'El asistente de IA no está configurado en el servidor.',
    );
  }
  if (error instanceof IaUpstreamError) {
    return jsonError(502, ErrorCode.AI_UPSTREAM_ERROR, mensajeDeUpstream(error.status));
  }
  logger.error('Falló una generación de IA', error);
  return internalError();
}

/** Serializa un evento SSE. `event:` permite a la UI distinguir sin inspeccionar. */
function sse(evento: string, datos: unknown): string {
  return `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
}

function respuestaStream(
  userId: string,
  entrada: Parameters<typeof generarContenido>[1],
): Response {
  const codificador = new TextEncoder();

  const cuerpo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const enviar = (evento: string, datos: unknown) =>
        controlador.enqueue(codificador.encode(sse(evento, datos)));

      try {
        const salida: SalidaGeneracion = await generarContenido(
          userId,
          entrada,
          (evento: EventoProgreso) => enviar(evento.tipo, evento),
        );
        enviar('final', salida);
      } catch (error: unknown) {
        // El stream ya respondió 200, así que el error viaja como evento y la
        // UI lo trata igual que un error HTTP.
        const respuesta = errorDeGeneracion(error);
        const cuerpoError = (await respuesta.json()) as { error: { code: string; message: string } };
        enviar('error', cuerpoError.error);
      } finally {
        controlador.close();
      }
    },
  });

  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evita que un proxy intermedio acumule la respuesta y anule el streaming.
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  if (!iaConfigurada()) {
    return jsonError(
      503,
      ErrorCode.AI_NOT_CONFIGURED,
      'El asistente de IA no está configurado en el servidor.',
    );
  }

  const cuerpo = await readJson(request);
  if (cuerpo === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parseado = generarSchema.safeParse(cuerpo);
  if (!parseado.success) return validationError(parseado.error);

  const entrada = parseado.data;
  if (entrada.stream) return respuestaStream(sesion.userId, entrada);

  try {
    return jsonOk(await generarContenido(sesion.userId, entrada));
  } catch (error: unknown) {
    return errorDeGeneracion(error);
  }
}
