import { requiereNutriologo } from '@/server/auth/guards';
import { recordAuditEvent } from '@/server/audit';
import { getEntitlements } from '@/server/billing/entitlements';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  parsePagination,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { enviarAvisoPrivacidadPaciente } from '@/server/email';
import {
  buscarPaciente,
  crearPaciente,
  listarPacientes,
  markPrivacyNoticeSent,
} from '@/server/patients/repository';
import { crearPacienteSchema } from '@/server/patients/schemas';
import {
  serializarPacienteDetalle,
  serializarPacienteResumen,
} from '@/server/patients/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/patients — listado paginado del nutriólogo autenticado. */
export async function GET(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { searchParams } = new URL(request.url);
  const { page, perPage, skip, take } = parsePagination(searchParams);

  try {
    const { pacientes, total } = await listarPacientes(sesion.userId, {
      skip,
      take,
      busqueda: searchParams.get('query')?.trim() || undefined,
      incluirArchivados: searchParams.get('incluir_archivados') === 'true',
    });

    return jsonList(pacientes.map(serializarPacienteResumen), {
      page,
      per_page: perPage,
      total,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de pacientes', error);
    return internalError();
  }
}

/** POST /api/v1/patients — alta completa desde el asistente de 4 pasos. */
export async function POST(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = crearPacienteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    // El cupo del plan se comprueba en el servidor, no escondiendo el botón:
    // el alta también se puede llamar por API. Durante la beta comercial
    // `alcanzado` es siempre `false` y esto no estorba a nadie.
    const entitlements = await getEntitlements(sesion.userId);
    if (entitlements.pacientes.alcanzado) {
      return jsonError(
        402,
        ErrorCode.PLAN_LIMIT,
        `Tu plan ${entitlements.plan} incluye ${entitlements.pacientes.limite} pacientes activos. Mejora tu plan o archiva a un paciente para dar de alta a otro.`,
      );
    }

    let paciente = await crearPaciente(sesion.userId, parsed.data);
    await recordAuditEvent({
      userId: sesion.userId,
      action: 'PATIENT_SENSITIVE_CONSENT_RECORDED',
      resource: 'patient',
      resourceId: paciente.id,
      request,
      metadata: {
        notice_version: paciente.sensitiveDataConsentVersion ?? 'unknown',
        method: paciente.sensitiveDataConsentMethod ?? 'unknown',
        actor: 'nutritionist_on_behalf_of_patient',
      },
    });
    if (paciente.email) {
      const notice = await enviarAvisoPrivacidadPaciente(
        paciente.email,
        paciente.nombre,
      );
      if (notice.enviado) {
        await markPrivacyNoticeSent(sesion.userId, paciente.id);
        paciente = (await buscarPaciente(sesion.userId, paciente.id)) ?? paciente;
      }
    }
    return jsonCreated(serializarPacienteDetalle(paciente));
  } catch (error: unknown) {
    logger.error('Falló el alta de paciente', error);
    return internalError();
  }
}
