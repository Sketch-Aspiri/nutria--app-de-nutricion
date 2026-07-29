import { recordAuditEvent } from '@/server/audit';
import { requiereNutriologo } from '@/server/auth/guards';
import {
  type MotivoInvitacionRechazada,
  invitarPaciente,
} from '@/server/auth/invitaciones';
import { enviarInvitacionPaciente } from '@/server/email';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  notFound,
} from '@/server/http';
import { logger } from '@/server/logger';
import { rateLimit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_INVITACIONES_POR_NUTRIOLOGO = 30;
const VENTANA_MS = 60 * 60 * 1000;

type Contexto = { params: Promise<{ id: string }> };

/** Traduce el motivo del dominio al código y estado del contrato de la API. */
function respuestaDeRechazo(motivo: MotivoInvitacionRechazada) {
  switch (motivo) {
    case 'no_encontrado':
      return notFound('No se encontró el paciente.');
    case 'ya_vinculado':
      return jsonError(
        409,
        ErrorCode.PATIENT_ALREADY_LINKED,
        'Este paciente ya tiene cuenta en la app. Pídele que recupere su contraseña.',
      );
    case 'archivado':
      return jsonError(
        422,
        ErrorCode.PATIENT_NOT_INVITABLE,
        'El expediente está archivado. Reactívalo antes de invitar al paciente.',
      );
    case 'sin_correo':
      return jsonError(
        422,
        ErrorCode.PATIENT_NOT_INVITABLE,
        'Agrega el correo del paciente en su expediente para poder invitarlo.',
      );
    case 'sin_consentimiento':
      return jsonError(
        422,
        ErrorCode.PATIENT_NOT_INVITABLE,
        'Registra el consentimiento de datos sensibles antes de dar acceso a la app.',
      );
  }
}

/**
 * POST /api/v1/patients/{id}/invite — invita al paciente a la app `pacientes`.
 *
 * Emite un token de un solo uso y manda el enlace de activación al correo del
 * expediente. La respuesta nunca incluye el token: si el correo no sale, se
 * reinvita, no se copia el enlace desde el panel.
 */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  // Tope por nutriólogo, no por IP: la invitación manda correo a un tercero y
  // ya exige sesión, así que lo que hay que acotar es la cuenta que lo dispara.
  const limite = await rateLimit(
    `invite:${sesion.userId}`,
    MAX_INVITACIONES_POR_NUTRIOLOGO,
    VENTANA_MS,
  );
  if (!limite.permitido) {
    return jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Enviaste demasiadas invitaciones. Espera unos minutos antes de continuar.',
    );
  }

  const { id } = await params;

  try {
    const resultado = await invitarPaciente(sesion.userId, id);
    if (!resultado.ok) return respuestaDeRechazo(resultado.motivo);

    const envio = await enviarInvitacionPaciente({
      para: resultado.email,
      pacienteNombre: resultado.pacienteNombre,
      consultorio: resultado.consultorio,
      token: resultado.token,
    });

    await recordAuditEvent({
      userId: sesion.userId,
      action: 'PATIENT_APP_INVITED',
      resource: 'patient',
      resourceId: id,
      request,
      metadata: { delivered: envio.enviado },
    });

    return jsonCreated({
      invitacion_enviada: envio.enviado,
      expira_en: resultado.expiraEn.toISOString(),
      // Solo en desarrollo sin proveedor de correo configurado.
      enlace_activacion_dev: envio.enviado ? undefined : envio.enlaceDev,
    });
  } catch (error: unknown) {
    logger.error('Falló la invitación del paciente a la app', error);
    return internalError();
  }
}
