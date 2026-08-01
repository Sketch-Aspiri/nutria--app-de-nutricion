import { requierePaciente } from '@/server/auth/guards';
import { avisarBajaDePacienteApp } from '@/server/email';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { darDeBajaCuenta, verificarPassword } from '@/server/me/cuenta';
import { darDeBajaSchema } from '@/server/me/schemas';
import { rateLimit } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTENTOS_POR_HORA = 5;

/**
 * `DELETE /api/v1/me/account` — derecho de cancelación sobre la cuenta (ARCO).
 *
 * Desvincula `user_id` y borra la cuenta de acceso. **El expediente clínico
 * permanece** con la nutrióloga, que es su responsable ante la NOM-004, y se le
 * notifica. Esa frontera está explicada en `cuenta.ts` y repetida en la
 * pantalla que llama a este endpoint: el paciente confirma sabiendo qué se va y
 * qué se queda.
 *
 * Lleva cuerpo aunque sea un `DELETE`. Es la única acción irreversible de la
 * app, y pedir la contraseña evita que un teléfono desbloqueado sobre una mesa
 * baste para ejecutarla.
 */
export async function DELETE(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await rateLimit(`me:baja:${sesion.userId}`, INTENTOS_POR_HORA, 60 * 60 * 1000);
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

  const parsed = darDeBajaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (!(await verificarPassword(sesion.userId, parsed.data.password))) {
      return jsonError(400, ErrorCode.VALIDATION_ERROR, 'Tu contraseña no es correcta.');
    }

    const resultado = await darDeBajaCuenta(sesion.patientId, sesion.userId);

    // Aviso a quien sigue siendo responsable del expediente. No lanza y su
    // resultado no cambia la respuesta: la baja ya se ejecutó en la
    // transacción y no puede deshacerse porque el correo falle.
    if (resultado.nutriologo) {
      await avisarBajaDePacienteApp(resultado.nutriologo.email, resultado.pacienteNombre);
    }

    return jsonOk({ baja: true });
  } catch (error: unknown) {
    logger.error('Falló la baja de la cuenta del paciente', error);
    return internalError();
  }
}
