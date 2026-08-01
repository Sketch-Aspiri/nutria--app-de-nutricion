import {
  activarCuentaPaciente,
  type MotivoActivacionRechazada,
} from '@/server/auth/invitaciones';
import { activarCuentaSchema } from '@/server/auth/schemasPaciente';
import { avisarAltaAlEquipo } from '@/server/email';
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
 * Todos los rechazos son 400 `INVALID_TOKEN`; lo que cambia es el mensaje, y
 * solo para los motivos que exigen **tener** un token real en la mano.
 *
 * Quien prueba tokens al azar nunca encuentra uno (son 256 bits aleatorios):
 * su respuesta es siempre `RECHAZO`, así que no aprende en qué estado está una
 * cuenta ajena. Al paciente legítimo, en cambio, el mensaje único lo dejaba
 * atorado: con varias invitaciones en el buzón —cada emisión apaga la anterior—
 * "pídele que te reenvíe" solo genera otro correo y el mismo error. Distinguir
 * "hay uno más nuevo" de "ya tienes cuenta" es lo que lo desatora.
 */
const RECHAZO =
  'Este enlace ya no es válido. Pídele a tu nutrióloga que te reenvíe la invitación.';

const MENSAJES: Record<MotivoActivacionRechazada, string> = {
  invalido: RECHAZO,
  reemplazado:
    'Esta invitación se reemplazó por una más reciente. Abre el último correo de nutria y usa el enlace de ahí.',
  expirado: 'Este enlace venció. Pídele a tu nutrióloga que te reenvíe la invitación.',
  ya_vinculado:
    'Esta invitación ya se usó para crear tu cuenta. Entra con tu correo y tu contraseña.',
  paciente_inactivo: RECHAZO,
  /**
   * Llegar aquí exige una invitación vigente en la mano, así que el paciente ya
   * conoce el correo del que se habla: decírselo no revela nada que no tenga, y
   * callarlo lo dejaba pidiendo reenvíos contra un choque que ningún correo
   * nuevo resuelve.
   */
  correo_ocupado:
    'Ya existe una cuenta de nutria con este correo. Si es tuya, entra con tu contraseña; si no, pídele a tu nutrióloga que te invite con otro correo.',
};

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
      // Solo el motivo: ni token, ni correo, ni expediente. Sin esta línea, un
      // rechazo en producción es indistinguible de otro y el diagnóstico pasa
      // por leer la base a mano.
      logger.warn('Activación rechazada', { motivo: resultado.motivo });
      return jsonError(400, ErrorCode.INVALID_TOKEN, MENSAJES[resultado.motivo]);
    }

    // Aviso interno de operación. No lanza y su resultado no cambia la
    // respuesta: la cuenta ya quedó creada y el paciente tiene que poder entrar
    // aunque el buzón administrativo esté caído.
    await avisarAltaAlEquipo({
      tipo: 'paciente',
      email: resultado.email,
      consultorio: resultado.consultorio,
    });

    // El correo se devuelve para prellenar el formulario de acceso; ni el
    // token ni el identificador del expediente salen de aquí.
    return jsonCreated({ email: resultado.email });
  } catch (error: unknown) {
    logger.error('Falló la activación de la cuenta del paciente', error);
    return internalError();
  }
}
