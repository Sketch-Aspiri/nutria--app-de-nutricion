import { z } from 'zod';

import { consumirTokenVerificacion } from '@/server/auth/tokens';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { ipDe, rateLimit } from '@/server/rate-limit';

const MAX_INTENTOS_POR_IP = 20;
const VENTANA_MS = 15 * 60 * 1000;

const verificarSchema = z.object({
  token: z.string().min(1, 'Falta el token de verificación.'),
});

/** POST /api/v1/auth/verify_email — confirma el correo con el token del enlace. */
export async function POST(request: Request) {
  const limite = rateLimit(`verify:${ipDe(request)}`, MAX_INTENTOS_POR_IP, VENTANA_MS);
  if (!limite.permitido) {
    return jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Demasiados intentos. Espera unos minutos antes de reintentar.',
    );
  }

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = verificarSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const resultado = await consumirTokenVerificacion(parsed.data.token);

    if (!resultado.ok) {
      return resultado.motivo === 'expirado'
        ? jsonError(
            410,
            ErrorCode.TOKEN_EXPIRED,
            'El enlace de verificación venció. Solicita uno nuevo desde la pantalla de acceso.',
          )
        : jsonError(
            400,
            ErrorCode.INVALID_TOKEN,
            'El enlace de verificación no es válido o ya fue usado.',
          );
    }

    return jsonOk({ verificado: true });
  } catch (error: unknown) {
    logger.error('Falló la verificación de correo', error);
    return internalError();
  }
}
