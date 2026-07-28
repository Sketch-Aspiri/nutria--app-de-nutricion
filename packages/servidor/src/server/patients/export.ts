import { Prisma } from '@prisma/client';

import { PRIVACY_NOTICE_VERSION } from '@/config/privacy';
import { recordAuditEvent } from '@/server/audit';
import { decryptText, ENCRYPTION_CONTEXT } from '@/server/crypto';
import { prisma } from '@/server/db';

const EXPORT_INCLUDE = {
  medicalRecord: true,
  foodPreference: true,
  measurements: { orderBy: { fecha: 'asc' as const } },
  consultationNotes: { orderBy: { fecha: 'asc' as const } },
  mealPlans: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      meals: {
        orderBy: { orden: 'asc' as const },
        include: { items: true },
      },
    },
  },
  mealLogs: { orderBy: { fecha: 'asc' as const } },
  weightLogs: { orderBy: { fecha: 'asc' as const } },
  exerciseLogs: { orderBy: { fecha: 'asc' as const } },
  activityPlans: { orderBy: { createdAt: 'asc' as const } },
  appointments: { orderBy: { inicio: 'asc' as const } },
  messages: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PatientInclude;

type ExportPatient = Prisma.PatientGetPayload<{
  include: typeof EXPORT_INCLUDE;
}>;

const MAX_EXPORT_ROWS = 10_000;

export class PatientExportTooLargeError extends Error {
  constructor() {
    super('El expediente excede el tamaño permitido para exportación inmediata.');
    this.name = 'PatientExportTooLargeError';
  }
}

function exportMedicalRecord(record: ExportPatient['medicalRecord']) {
  if (!record) return null;
  return {
    condiciones: record.condiciones,
    antecedentes: decryptText(
      record.antecedentes,
      ENCRYPTION_CONTEXT.medicalAntecedentes,
    ),
    medicamentos: decryptText(
      record.medicamentos,
      ENCRYPTION_CONTEXT.medicalMedicamentos,
    ),
    nivel_actividad: record.nivelActividad,
    objetivo: record.objetivo,
    objetivo_otro: record.objetivoOtro,
  };
}

/**
 * Exportación portable del expediente para ejercer acceso/portabilidad.
 *
 * Excluye hashes, llaves, ids del profesional y metadatos internos. Los textos
 * cifrados se descifran únicamente después de filtrar pertenencia en la query.
 */
export async function exportPatientRecord(
  nutritionistId: string,
  patientId: string,
) {
  const volume = await prisma.patient.findFirst({
    where: { id: patientId, nutritionistId },
    select: {
      _count: {
        select: {
          measurements: true,
          consultationNotes: true,
          mealPlans: true,
          mealLogs: true,
          weightLogs: true,
          exerciseLogs: true,
          activityPlans: true,
          appointments: true,
          messages: true,
        },
      },
    },
  });
  if (!volume) return null;
  const totalRows = Object.values(volume._count).reduce(
    (total, count) => total + count,
    0,
  );
  if (totalRows > MAX_EXPORT_ROWS) throw new PatientExportTooLargeError();

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, nutritionistId },
    include: EXPORT_INCLUDE,
  });
  if (!patient) return null;

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    privacy_notice_version: PRIVACY_NOTICE_VERSION,
    patient: {
      id: patient.id,
      nombre: patient.nombre,
      fecha_nacimiento: patient.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
      genero: patient.genero,
      email: patient.email,
      telefono: patient.telefono,
      estado: patient.estado,
      consentimiento_datos_sensibles: {
        otorgado_en: patient.sensitiveDataConsentAt?.toISOString() ?? null,
        version_aviso: patient.sensitiveDataConsentVersion,
        metodo: patient.sensitiveDataConsentMethod,
        aviso_enviado_en: patient.privacyNoticeSentAt?.toISOString() ?? null,
      },
      expediente_medico: exportMedicalRecord(patient.medicalRecord),
      preferencias_alimentarias: patient.foodPreference,
      mediciones: patient.measurements,
      notas_consulta: patient.consultationNotes.map((note) => ({
        id: note.id,
        fecha: note.fecha,
        motivo: decryptText(
          note.motivo,
          ENCRYPTION_CONTEXT.consultationMotivo,
        ),
        hallazgos: decryptText(
          note.hallazgos,
          ENCRYPTION_CONTEXT.consultationHallazgos,
        ),
        plan: decryptText(note.plan, ENCRYPTION_CONTEXT.consultationPlan),
        seguimiento: decryptText(
          note.seguimiento,
          ENCRYPTION_CONTEXT.consultationSeguimiento,
        ),
        origen: note.origen,
        firmada_at: note.firmadaAt,
      })),
      planes_alimenticios: patient.mealPlans,
      comidas_registradas: patient.mealLogs,
      pesos_registrados: patient.weightLogs,
      ejercicio_registrado: patient.exerciseLogs,
      planes_actividad: patient.activityPlans,
      citas: patient.appointments,
      mensajes: patient.messages.map((message) => ({
        id: message.id,
        emisor: message.emisor,
        texto: decryptText(message.texto, ENCRYPTION_CONTEXT.messageText),
        leido_at: message.leidoAt,
        created_at: message.createdAt,
      })),
    },
  };
}

export async function recordPatientExport(
  userId: string,
  patientId: string,
  request?: Request,
): Promise<void> {
  await recordAuditEvent({
    userId,
    action: 'PATIENT_RECORD_EXPORTED',
    resource: 'patient',
    resourceId: patientId,
    request,
    metadata: { format: 'json', schema_version: 1 },
  });
}
