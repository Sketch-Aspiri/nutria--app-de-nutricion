import { Prisma } from '@prisma/client';

import { PRIVACY_NOTICE_VERSION } from '@/config/privacy';
import { recordAuditEvent } from '@/server/audit';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { decryptText, ENCRYPTION_CONTEXT } from '@/server/crypto';
import { prisma } from '@/server/db';

/**
 * Cuenta y derechos ARCO del paciente (§9, fase 11).
 *
 * Tres operaciones que el paciente ejecuta sobre sí mismo: descargar sus datos,
 * cambiar su contraseña y darse de baja. Todas reciben el `patientId` o el
 * `userId` que resolvió `requierePaciente` desde la sesión —ninguna los acepta
 * del cliente— y todas dejan rastro en `audit_logs`.
 */

/**
 * Qué se exporta.
 *
 * Lo que el paciente registró y lo que su nutrióloga le compartió, más las
 * mediciones que le tomó y la evidencia de su consentimiento.
 *
 * **Qué NO se exporta, y por qué.** Las notas de consulta (`motivo`,
 * `hallazgos`, `plan`, `seguimiento`) y el expediente médico de texto libre son
 * el razonamiento clínico de la profesional, sujeto a NOM-004-SSA3, y §9 es
 * explícito: el expediente clínico permanece con el nutriólogo, que es su
 * responsable. El canal para pedirlo completo es ella, y
 * `GET /api/v1/patients/{id}/export` ya existe de su lado para atenderlo. La
 * respuesta lo dice en `expediente_clinico_completo` en vez de dejar al
 * paciente creyendo que este archivo lo es todo.
 */
const EXPORT_INCLUDE = {
  // Solo el objetivo, no el texto libre del expediente: `medicalRecord`
  // guarda además antecedentes y medicamentos, que son nota clínica.
  medicalRecord: { select: { objetivo: true, objetivoOtro: true } },
  foodPreference: true,
  measurements: { orderBy: { fecha: 'asc' as const } },
  mealPlans: {
    where: { compartidoAt: { not: null } },
    orderBy: { createdAt: 'asc' as const },
    include: {
      meals: { orderBy: { orden: 'asc' as const }, include: { items: true } },
    },
  },
  recipes: { where: { estado: 'ENVIADA' as const }, orderBy: { createdAt: 'asc' as const } },
  activityPlans: {
    where: { compartidoAt: { not: null } },
    orderBy: { createdAt: 'asc' as const },
  },
  mealLogs: { orderBy: { fecha: 'asc' as const } },
  weightLogs: { orderBy: { fecha: 'asc' as const } },
  exerciseLogs: { orderBy: { fecha: 'asc' as const } },
  waterLogs: { orderBy: { fecha: 'asc' as const } },
  appointments: { orderBy: { inicio: 'asc' as const } },
  messages: { orderBy: { createdAt: 'asc' as const } },
  nutritionist: {
    select: {
      name: true,
      email: true,
      nutritionistProfile: { select: { nombreCompleto: true } },
    },
  },
} satisfies Prisma.PatientInclude;

/** Mismo criterio que `perfilDe`: el nombre profesional gana al del usuario. */
function nombreDelNutriologo(nutricionista: {
  name: string | null;
  nutritionistProfile: { nombreCompleto: string } | null;
}): string {
  return nutricionista.nutritionistProfile?.nombreCompleto ?? nutricionista.name ?? '';
}

/** Mismo tope que la exportación del panel: más filas exigen soporte asistido. */
const MAX_EXPORT_ROWS = 10_000;

export class ExportacionDemasiadoGrandeError extends Error {
  constructor() {
    super('Tus datos exceden el tamaño permitido para una descarga inmediata.');
    this.name = 'ExportacionDemasiadoGrandeError';
  }
}

export async function exportarDatosDelPaciente(patientId: string) {
  const volumen = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: {
      _count: {
        select: {
          measurements: true,
          mealPlans: true,
          mealLogs: true,
          weightLogs: true,
          exerciseLogs: true,
          waterLogs: true,
          activityPlans: true,
          appointments: true,
          messages: true,
          recipes: true,
        },
      },
    },
  });
  if (!volumen) return null;

  const filas = Object.values(volumen._count).reduce((total, cuenta) => total + cuenta, 0);
  if (filas > MAX_EXPORT_ROWS) throw new ExportacionDemasiadoGrandeError();

  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    include: EXPORT_INCLUDE,
  });
  if (!paciente) return null;

  return {
    schema_version: 1,
    generado_en: new Date().toISOString(),
    version_aviso_privacidad: PRIVACY_NOTICE_VERSION,
    expediente_clinico_completo: {
      incluido: false,
      motivo:
        'Las notas de consulta y el expediente clínico son responsabilidad de tu nutrióloga ' +
        '(NOM-004-SSA3). Solicítaselos directamente para recibirlos completos.',
      responsable: nombreDelNutriologo(paciente.nutritionist),
      contacto: paciente.nutritionist.email,
    },
    paciente: {
      id: paciente.id,
      nombre: paciente.nombre,
      fecha_nacimiento: paciente.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
      genero: paciente.genero,
      email: paciente.email,
      telefono: paciente.telefono,
      objetivo: paciente.medicalRecord?.objetivo ?? null,
      objetivo_otro: paciente.medicalRecord?.objetivoOtro ?? null,
      estado: paciente.estado,
      consentimiento_datos_sensibles: {
        otorgado_en: paciente.sensitiveDataConsentAt?.toISOString() ?? null,
        version_aviso: paciente.sensitiveDataConsentVersion,
        metodo: paciente.sensitiveDataConsentMethod,
        aviso_enviado_en: paciente.privacyNoticeSentAt?.toISOString() ?? null,
      },
      preferencias_alimentarias: paciente.foodPreference,
      mediciones: paciente.measurements,
      planes_alimenticios_compartidos: paciente.mealPlans,
      recetas_enviadas: paciente.recipes,
      planes_actividad_compartidos: paciente.activityPlans,
      comidas_registradas: paciente.mealLogs,
      pesos_registrados: paciente.weightLogs,
      ejercicio_registrado: paciente.exerciseLogs,
      agua_registrada: paciente.waterLogs,
      citas: paciente.appointments.map((cita) => ({
        id: cita.id,
        inicio: cita.inicio,
        duracion_min: cita.duracionMin,
        tipo: cita.tipo,
        estado: cita.estado,
      })),
      mensajes: paciente.messages.map((mensaje) => ({
        id: mensaje.id,
        emisor: mensaje.emisor,
        texto: decryptText(mensaje.texto, ENCRYPTION_CONTEXT.messageText),
        leido_at: mensaje.leidoAt,
        created_at: mensaje.createdAt,
      })),
    },
  };
}

export function registrarExportacionPropia(
  userId: string,
  patientId: string,
  request?: Request,
): Promise<void> {
  return recordAuditEvent({
    userId,
    action: 'PATIENT_SELF_EXPORT',
    resource: 'patient',
    resourceId: patientId,
    request,
    metadata: { format: 'json', schema_version: 1, origen: 'app_paciente' },
  });
}

export type ResultadoCambioPassword =
  | { ok: true }
  | { ok: false; motivo: 'password_incorrecta' | 'sin_cuenta' };

/**
 * Cambio de contraseña.
 *
 * Exige la contraseña actual: sin ese paso, una sesión robada o un teléfono
 * prestado bastaría para dejar al dueño fuera de su propia cuenta.
 */
export async function cambiarPassword(
  userId: string,
  actual: string,
  nueva: string,
): Promise<ResultadoCambioPassword> {
  const usuario = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { passwordHash: true },
  });
  if (!usuario) return { ok: false, motivo: 'sin_cuenta' };

  if (!(await verifyPassword(actual, usuario.passwordHash))) {
    return { ok: false, motivo: 'password_incorrecta' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(nueva) },
  });

  await recordAuditEvent({
    userId,
    action: 'PATIENT_PASSWORD_CHANGED',
    resource: 'patient',
    resourceId: userId,
    metadata: { origen: 'app_paciente' },
  });

  return { ok: true };
}

/** Confirma que quien pide una acción irreversible sabe la contraseña. */
export async function verificarPassword(userId: string, password: string): Promise<boolean> {
  const usuario = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { passwordHash: true },
  });
  return verifyPassword(password, usuario?.passwordHash ?? null);
}

export type ResultadoBaja = {
  ok: boolean;
  /** Para avisarle a quien sigue siendo responsable del expediente. */
  nutriologo: { nombre: string; email: string } | null;
  pacienteNombre: string;
};

/**
 * Baja de la cuenta de la app.
 *
 * Hace exactamente lo que §9 describe y nada más: **desvincula** `user_id` y
 * borra la cuenta de acceso. El expediente clínico —mediciones, notas, planes,
 * historial— permanece intacto con la nutrióloga, que es su responsable ante la
 * NOM-004, y se le notifica.
 *
 * Borrar el expediente desde aquí sería que el paciente destruyera el registro
 * clínico de un tercero obligado a conservarlo. Ejercer cancelación sobre esos
 * datos se pide a la responsable, y el aviso de privacidad dice cómo.
 *
 * Las dos escrituras van en una transacción: una cuenta desvinculada pero viva,
 * o una cuenta muerta todavía vinculada, dejarían un estado que ningún guard
 * sabe leer.
 */
export async function darDeBajaCuenta(patientId: string, userId: string): Promise<ResultadoBaja> {
  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: {
      nombre: true,
      nutritionist: {
        select: {
          name: true,
          email: true,
          nutritionistProfile: { select: { nombreCompleto: true } },
        },
      },
    },
  });

  await prisma.$transaction([
    prisma.patient.update({ where: { id: patientId }, data: { userId: null } }),
    prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
  ]);

  await recordAuditEvent({
    userId,
    action: 'PATIENT_ACCOUNT_DELETED',
    resource: 'patient',
    resourceId: patientId,
    metadata: { origen: 'app_paciente', expediente_conservado: true },
  });

  return {
    ok: true,
    nutriologo: paciente
      ? {
          nombre: nombreDelNutriologo(paciente.nutritionist),
          email: paciente.nutritionist.email,
        }
      : null,
    pacienteNombre: paciente?.nombre ?? '',
  };
}
