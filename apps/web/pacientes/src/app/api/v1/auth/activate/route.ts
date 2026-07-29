import { activarCuentaPaciente } from '@/server/auth/invitaciones';
import { activarCuentaSchema } from '@/server/auth/schemasPaciente';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { ipDe, rateLimit } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/v1/auth/activate` — el paciente consume su invitación y crea su
 * cuenta.
 *
 * La lógica completa —transacción, enlace con el expediente y quema del token—
 * la escribió y probó la fase 3 en `activarCuentaPaciente`; aquí solo se
 * envuelve con validación, límite de tasa y traducción a HTTP, que es lo que
 * esa fase dejó pendiente por no existir todavía esta app.
 *
 * Es de las poquísimas rutas sin sesión de la app, así que el límite va por IP:
 * no hay cuenta contra la cual contar todavía.
 */

const INTENTOS_POR_IP = 10;
const VENTANA_MS = 15 * 60 * 1000;

/**
 * Los cinco motivos de rechazo se responden **igual**: 400 `INVALID_TOKEN` con
 * un solo mensaje. Distinguir "expirado" de "ya usado" o de "el expediente está
 * archivado" le contaría a quien pruebe tokens al azar en qué estado está una
 * cuenta que no es suya. La salida para el paciente legítimo es la misma en los
 * cinco casos: pedirle a su nutrióloga que le reenvíe la invitación.
 */
const RECHAZO =
  'Este enlace ya no es válido. Pídele a tu nutrióloga que te reenvíe la invitación.';

export async function POST(request: Request) {
  const limite = await rateLimit(`activar:${ipDe(request)}`, INTENTOS_POR_IP, VENTANA_MS);
  if (!limite.permitido) {
    return jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
    );
  }

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = activarCuentaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const resultado = await activarCuentaPaciente(parsed.data.token, parsed.data.password);
    if (!resultado.ok) {
      return jsonError(400, ErrorCode.INVALID_TOKEN, RECHAZO);
    }

    // El correo se devuelve para prellenar el formulario de acceso; ni el
    // token ni el identificador del expediente salen de aquí.
    return jsonCreated({ email: resultado.email });
  } catch (error: unknown) {
    logger.error('Falló la activación de la cuenta del paciente', error);
    return internalError();
  }
}
