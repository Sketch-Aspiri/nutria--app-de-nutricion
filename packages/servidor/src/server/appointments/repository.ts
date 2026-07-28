import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';

import type { ActualizarCitaInput, CrearCitaInput, FiltroCitasInput } from './schemas';
import { type CitaConPaciente, citaInclude } from './serializers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esIdValido(id: string): boolean {
  return UUID.test(id);
}

export class CitaEmpalmadaError extends Error {
  constructor(readonly citaId: string) {
    super('CITA_EMPALMADA');
    this.name = 'CitaEmpalmadaError';
  }
}

export type ResultadoListaCitas = {
  citas: CitaConPaciente[];
  total: number;
};

function whereDeFiltros(
  nutritionistId: string,
  filtros: FiltroCitasInput,
): Prisma.AppointmentWhereInput {
  return {
    // La autorización va dentro de la misma consulta: nunca se lee primero y
    // se compara después.
    nutritionistId,
    patient: { deletedAt: null },
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.patient_id ? { patientId: filtros.patient_id } : {}),
    ...(filtros.desde || filtros.hasta
      ? {
          inicio: {
            ...(filtros.desde ? { gte: filtros.desde } : {}),
            ...(filtros.hasta ? { lte: filtros.hasta } : {}),
          },
        }
      : {}),
  };
}

export async function listarCitas(
  nutritionistId: string,
  paginacion: { skip: number; take: number },
  filtros: FiltroCitasInput,
): Promise<ResultadoListaCitas> {
  const where = whereDeFiltros(nutritionistId, filtros);

  const [citas, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: citaInclude,
      orderBy: { inicio: 'asc' },
      skip: paginacion.skip,
      take: paginacion.take,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { citas, total };
}

export async function obtenerCita(
  nutritionistId: string,
  citaId: string,
): Promise<CitaConPaciente | null> {
  if (!esIdValido(citaId)) return null;

  return prisma.appointment.findFirst({
    where: { id: citaId, nutritionistId },
    include: citaInclude,
  });
}

/**
 * Citas que se traslapan con el intervalo dado.
 *
 * Dos consultas a la misma hora casi siempre son un doble clic o un error de
 * captura, no una intención. Se rechaza en el servidor porque el botón
 * deshabilitado del formulario no impide un POST directo.
 */
async function buscarEmpalme(
  nutritionistId: string,
  inicio: Date,
  duracionMin: number,
  excluirCitaId?: string,
): Promise<{ id: string } | null> {
  const fin = new Date(inicio.getTime() + duracionMin * 60_000);

  // Prisma no compara columnas entre sí, así que el traslape se resuelve con
  // la aritmética de intervalos en SQL: (inicio_a < fin_b) AND (fin_a > inicio_b).
  const empalmes = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "appointments"
    WHERE "nutritionist_id" = ${nutritionistId}::uuid
      AND "estado" NOT IN ('cancelada', 'no_asistio')
      AND ${excluirCitaId ?? null}::uuid IS DISTINCT FROM "id"
      AND "inicio" < ${fin}
      AND "inicio" + ("duracion_min" * INTERVAL '1 minute') > ${inicio}
    LIMIT 1
  `;

  return empalmes[0] ?? null;
}

export async function crearCita(
  nutritionistId: string,
  datos: CrearCitaInput,
): Promise<CitaConPaciente | null> {
  if (!esIdValido(datos.patient_id)) return null;

  const paciente = await prisma.patient.findFirst({
    where: { id: datos.patient_id, nutritionistId, deletedAt: null },
    select: { id: true },
  });
  if (!paciente) return null;

  const empalme = await buscarEmpalme(nutritionistId, datos.inicio, datos.duracion_min);
  if (empalme) throw new CitaEmpalmadaError(empalme.id);

  return prisma.appointment.create({
    data: {
      nutritionistId,
      patientId: datos.patient_id,
      inicio: datos.inicio,
      duracionMin: datos.duracion_min,
      tipo: datos.tipo,
      notas: datos.notas ?? null,
      videoUrl: datos.video_url ?? null,
    },
    include: citaInclude,
  });
}

export async function actualizarCita(
  nutritionistId: string,
  citaId: string,
  datos: ActualizarCitaInput,
): Promise<CitaConPaciente | null> {
  const actual = await obtenerCita(nutritionistId, citaId);
  if (!actual) return null;

  const inicio = datos.inicio ?? actual.inicio;
  const duracion = datos.duracion_min ?? actual.duracionMin;
  const estado = datos.estado ?? actual.estado;

  // Una cita cancelada no reserva horario: reprogramarla sí vuelve a competir.
  const ocupaHorario = estado !== 'CANCELADA' && estado !== 'NO_ASISTIO';
  if (ocupaHorario && (datos.inicio || datos.duracion_min || datos.estado)) {
    const empalme = await buscarEmpalme(nutritionistId, inicio, duracion, citaId);
    if (empalme) throw new CitaEmpalmadaError(empalme.id);
  }

  // `updateMany` con el filtro de autorización incluido: 0 filas es un 404.
  const { count } = await prisma.appointment.updateMany({
    where: { id: citaId, nutritionistId },
    data: {
      ...(datos.inicio ? { inicio: datos.inicio } : {}),
      ...(datos.duracion_min !== undefined ? { duracionMin: datos.duracion_min } : {}),
      ...(datos.tipo ? { tipo: datos.tipo } : {}),
      ...(datos.estado ? { estado: datos.estado } : {}),
      ...(datos.notas !== undefined ? { notas: datos.notas ?? null } : {}),
      ...(datos.video_url !== undefined ? { videoUrl: datos.video_url ?? null } : {}),
      // Mover la cita invalida el recordatorio ya enviado: el paciente tiene en
      // su correo una hora que dejó de ser cierta, así que vuelve a la cola.
      ...(datos.inicio ? { recordatorioEnviadoAt: null } : {}),
    },
  });
  if (count === 0) return null;

  return obtenerCita(nutritionistId, citaId);
}

export class CitaNoEditableError extends Error {
  constructor() {
    super('CITA_NO_EDITABLE');
    this.name = 'CitaNoEditableError';
  }
}

/**
 * Cierra la cita (cancelada, completada o inasistencia).
 *
 * Una cita ya cerrada no vuelve a cerrarse: es el registro de lo que pasó en
 * la consulta y reescribirlo a destiempo falsearía la agenda. Para corregir un
 * cierre equivocado está `PATCH`, que sí deja volver a `PROGRAMADA`.
 */
export async function cerrarCita(
  nutritionistId: string,
  citaId: string,
  estado: 'CANCELADA' | 'COMPLETADA' | 'NO_ASISTIO',
): Promise<CitaConPaciente | null> {
  const actual = await obtenerCita(nutritionistId, citaId);
  if (!actual) return null;
  if (actual.estado !== 'PROGRAMADA') throw new CitaNoEditableError();

  const { count } = await prisma.appointment.updateMany({
    where: { id: citaId, nutritionistId, estado: 'PROGRAMADA' },
    data: {
      estado,
      // Cancelar antes de que salga el recordatorio evita el correo: la cita
      // deja de estar PROGRAMADA y el cron ya no la considera.
      ...(estado === 'CANCELADA' ? { recordatorioEnviadoAt: new Date() } : {}),
    },
  });
  // Otra pestaña ganó la carrera y ya la cerró.
  if (count === 0) throw new CitaNoEditableError();

  return obtenerCita(nutritionistId, citaId);
}

export async function eliminarCita(nutritionistId: string, citaId: string): Promise<boolean> {
  if (!esIdValido(citaId)) return false;

  const { count } = await prisma.appointment.deleteMany({
    where: { id: citaId, nutritionistId },
  });
  return count > 0;
}
