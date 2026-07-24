import type { Prisma } from '@prisma/client';

export const citaInclude = {
  patient: { select: { id: true, nombre: true, fotoUrl: true, email: true } },
} satisfies Prisma.AppointmentInclude;

export type CitaConPaciente = Prisma.AppointmentGetPayload<{
  include: typeof citaInclude;
}>;

/** Fechas siempre en ISO 8601 UTC, como exige `rules/api-conventions.md`. */
export function serializarCita(cita: CitaConPaciente) {
  return {
    id: cita.id,
    patient_id: cita.patientId,
    paciente: {
      id: cita.patient.id,
      nombre: cita.patient.nombre,
      foto_url: cita.patient.fotoUrl,
    },
    inicio: cita.inicio.toISOString(),
    duracion_min: cita.duracionMin,
    tipo: cita.tipo,
    estado: cita.estado,
    notas: cita.notas,
    video_url: cita.videoUrl,
    recordatorio_enviado_at: cita.recordatorioEnviadoAt?.toISOString() ?? null,
    created_at: cita.createdAt.toISOString(),
    updated_at: cita.updatedAt.toISOString(),
  };
}

export type CitaSerializada = ReturnType<typeof serializarCita>;
