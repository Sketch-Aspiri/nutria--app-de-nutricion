import { z } from 'zod';

import { normalizarEmail } from '@/server/auth/password';
import { crearTokenVerificacion } from '@/server/auth/tokens';
import { prisma } from '@/server/db';
import { enviarVerificacionEmail } from '@/server/email';
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

const MAX_REENVIOS_POR_IP = 5;
const VENTANA_MS = 60 * 60 * 1000;

const reenvioSchema = z.object({
  email: z.email('El correo no tiene un formato válido.'),
});

/**
 * POST /api/v1/auth/resend_verification — reenvía el correo de verificación.
 * Responde igual exista o no la cuenta, para no revelar qué correos están dados de alta.
 */
export async function POST(request: Request) {
  const limite = await rateLimit(
    `resend:${ipDe(request)}`,
    MAX_REENVIOS_POR_IP,
    VENTANA_MS,
  );
  if (!limite.permitido) {
    return jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Demasiados reenvíos. Espera unos minutos antes de reintentar.',
    );
  }

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = reenvioSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const respuestaNeutra = jsonOk({
    mensaje: 'Si la cuenta existe y está pendiente de verificar, enviamos un nuevo enlace.',
  });

  try {
    const usuario = await prisma.user.findUnique({
      where: { email: normalizarEmail(parsed.data.email) },
      select: { id: true, email: true, emailVerified: true, deletedAt: true },
    });

    if (!usuario || usuario.deletedAt || usuario.emailVerified) {
      return respuestaNeutra;
    }

    const token = await crearTokenVerificacion(usuario.id);
    await enviarVerificacionEmail(usuario.email, token);
    return respuestaNeutra;
  } catch (error: unknown) {
    logger.error('Falló el reenvío de verificación', error);
    return internalError();
  }
}
