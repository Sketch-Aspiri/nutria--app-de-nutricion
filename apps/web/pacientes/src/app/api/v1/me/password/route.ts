import { requierePaciente } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { cambiarPassword } from '@/server/me/cuenta';
import { cambiarPasswordSchema } from '@/server/me/schemas';
import { rateLimit } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Límite propio, más estrecho que el de escritura general.
 *
 * Este endpoint comprueba una contraseña, así que es un oráculo: sin un tope
 * bajo, una sesión robada podría usarlo para adivinar la contraseña original a
 * fuerza bruta.
 */
const INTENTOS_POR_HORA = 5;

/** `POST /api/v1/me/password` — el paciente cambia su propia contraseña. */
export async function POST(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await rateLimit(`me:password:${sesion.userId}`, INTENTOS_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) {
    return jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Demasiados intentos. Espera un rato antes de volver a intentarlo.',
    );
  }

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = cambiarPasswordSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const resultado = await cambiarPassword(
      sesion.userId,
      parsed.data.actual,
      parsed.data.nueva,
    );

    if (!resultado.ok) {
      // Los dos motivos se responden igual. "Sin cuenta" no debería ocurrir
      // detrás de `requierePaciente`, y distinguirlo solo daría señal.
      return jsonError(400, ErrorCode.VALIDATION_ERROR, 'Tu contraseña actual no es correcta.');
    }

    return jsonOk({ actualizada: true });
  } catch (error: unknown) {
    logger.error('Falló el cambio de contraseña del paciente', error);
    return internalError();
  }
}
