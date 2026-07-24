import { Prisma } from '@prisma/client';

import type { SnapshotCalculo } from '@nutria/shared';

import { prisma } from '@/server/db';

import type {
  ActualizarPacienteInput,
  CrearPacienteInput,
  ExpedienteMedicoInput,
  MedicionInput,
  PreferenciasInput,
} from './schemas';

/**
 * Acceso a datos de pacientes.
 *
 * Toda consulta filtra por `nutritionistId`: la pertenencia se comprueba en la
 * misma query, nunca leyendo primero y comparando después. Un paciente de otro
 * nutriólogo es indistinguible de uno inexistente.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prisma lanza si el id no es un UUID; se descarta antes de tocar la base. */
export function esIdValido(id: string): boolean {
  return UUID.test(id);
}

const RELACIONES_DETALLE = {
  medicalRecord: true,
  foodPreference: true,
  measurements: { orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }] },
  // Solo el plan vigente y solo si ya guarda un cálculo: el detalle del
  // paciente muestra el último snapshot, no el histórico de planes.
  mealPlans: {
    where: { calculoSnapshot: { not: Prisma.DbNull } },
    orderBy: { updatedAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.PatientInclude;

function normalizarTexto(valor: string | null | undefined): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

/**
 * El texto libre solo acompaña al objetivo OTRO. Con cualquier otro objetivo se
 * guarda nulo, para que no quede una descripción huérfana contradiciendo al enum.
 */
function objetivoOtroDe(
  objetivo: ExpedienteMedicoInput['objetivo'],
  texto: string | null | undefined,
): string | null {
  return objetivo === 'OTRO' ? normalizarTexto(texto) : null;
}

function fechaDeMedicion(fecha: string | undefined): Date {
  return fecha ? new Date(fecha) : new Date();
}

/** Una medición vacía no aporta nada al expediente y ensucia el histórico. */
function tieneAlgunDato(medicion: MedicionInput | undefined): medicion is MedicionInput {
  if (!medicion) return false;
  return [
    medicion.peso_kg,
    medicion.altura_cm,
    medicion.cintura_cm,
    medicion.cadera_cm,
    medicion.grasa_pct,
    medicion.musculo_pct,
  ].some((valor) => typeof valor === 'number');
}

export async function listarPacientes(
  nutritionistId: string,
  opciones: { skip: number; take: number; busqueda?: string; incluirArchivados: boolean },
) {
  const where: Prisma.PatientWhereInput = {
    nutritionistId,
    deletedAt: null,
    ...(opciones.incluirArchivados ? {} : { estado: 'ACTIVO' }),
    ...(opciones.busqueda
      ? { nombre: { contains: opciones.busqueda, mode: 'insensitive' } }
      : {}),
  };

  const [pacientes, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { medicalRecord: true },
      orderBy: { createdAt: 'desc' },
      skip: opciones.skip,
      take: opciones.take,
    }),
    prisma.patient.count({ where }),
  ]);

  return { pacientes, total };
}

export async function buscarPaciente(nutritionistId: string, patientId: string) {
  if (!esIdValido(patientId)) return null;
  return prisma.patient.findFirst({
    where: { id: patientId, nutritionistId, deletedAt: null },
    include: RELACIONES_DETALLE,
  });
}

export async function crearPaciente(nutritionistId: string, datos: CrearPacienteInput) {
  const medico = datos.expediente_medico;
  const preferencias = datos.preferencias_alimentarias;
  const antropometria = datos.antropometria;

  return prisma.patient.create({
    data: {
      nutritionistId,
      nombre: datos.nombre,
      fechaNacimiento: datos.fecha_nacimiento ? new Date(datos.fecha_nacimiento) : null,
      genero: datos.genero ?? 'OTRO',
      email: normalizarTexto(datos.email),
      telefono: normalizarTexto(datos.telefono),
      fotoUrl: normalizarTexto(datos.foto_url),
      medicalRecord: {
        create: {
          condiciones: medico?.condiciones ?? [],
          antecedentes: normalizarTexto(medico?.antecedentes),
          medicamentos: normalizarTexto(medico?.medicamentos),
          nivelActividad: medico?.nivel_actividad ?? 'MODERADO',
          objetivo: medico?.objetivo ?? 'MANTENIMIENTO',
          objetivoOtro: objetivoOtroDe(medico?.objetivo, medico?.objetivo_otro),
        },
      },
      foodPreference: {
        create: {
          tipoDieta: normalizarTexto(preferencias?.tipo_dieta),
          alergias: preferencias?.alergias ?? [],
          disgustos: normalizarTexto(preferencias?.disgustos),
          comidasPorDia: preferencias?.comidas_por_dia ?? 3,
          presupuestoTiempo: preferencias?.presupuesto_tiempo ?? 'Medio',
        },
      },
      ...(tieneAlgunDato(antropometria)
        ? {
            measurements: {
              create: {
                fecha: fechaDeMedicion(antropometria.fecha),
                pesoKg: antropometria.peso_kg ?? null,
                alturaCm: antropometria.altura_cm ?? null,
                cinturaCm: antropometria.cintura_cm ?? null,
                caderaCm: antropometria.cadera_cm ?? null,
                grasaPct: antropometria.grasa_pct ?? null,
                musculoPct: antropometria.musculo_pct ?? null,
                pliegues: antropometria.pliegues ?? undefined,
              },
            },
          }
        : {}),
    },
    include: RELACIONES_DETALLE,
  });
}

/** Devuelve null si el paciente no es de este nutriólogo (el updateMany no afecta filas). */
export async function actualizarPaciente(
  nutritionistId: string,
  patientId: string,
  datos: ActualizarPacienteInput,
) {
  if (!esIdValido(patientId)) return null;

  const { count } = await prisma.patient.updateMany({
    where: { id: patientId, nutritionistId, deletedAt: null },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.fecha_nacimiento !== undefined
        ? { fechaNacimiento: datos.fecha_nacimiento ? new Date(datos.fecha_nacimiento) : null }
        : {}),
      ...(datos.genero !== undefined ? { genero: datos.genero } : {}),
      ...(datos.email !== undefined ? { email: normalizarTexto(datos.email) } : {}),
      ...(datos.telefono !== undefined ? { telefono: normalizarTexto(datos.telefono) } : {}),
      ...(datos.foto_url !== undefined ? { fotoUrl: normalizarTexto(datos.foto_url) } : {}),
      ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
    },
  });

  if (count === 0) return null;
  return buscarPaciente(nutritionistId, patientId);
}

/**
 * Borrado lógico: un expediente clínico no se elimina físicamente
 * (NOM-004-SSA3 exige conservarlo).
 */
export async function archivarPaciente(nutritionistId: string, patientId: string) {
  if (!esIdValido(patientId)) return false;
  const { count } = await prisma.patient.updateMany({
    where: { id: patientId, nutritionistId, deletedAt: null },
    data: { deletedAt: new Date(), estado: 'ARCHIVADO' },
  });
  return count > 0;
}

export async function actualizarExpedienteMedico(
  nutritionistId: string,
  patientId: string,
  datos: ExpedienteMedicoInput,
) {
  const paciente = await buscarPaciente(nutritionistId, patientId);
  if (!paciente) return null;

  // Actualización parcial: el objetivo vigente puede venir en la petición o ya
  // estar guardado, y de él depende si el texto libre sobrevive.
  const objetivoVigente = datos.objetivo ?? paciente.medicalRecord?.objetivo;
  const tocaObjetivo = datos.objetivo !== undefined || datos.objetivo_otro !== undefined;

  return prisma.medicalRecord.upsert({
    where: { patientId },
    update: {
      ...(datos.condiciones !== undefined ? { condiciones: datos.condiciones } : {}),
      ...(datos.antecedentes !== undefined
        ? { antecedentes: normalizarTexto(datos.antecedentes) }
        : {}),
      ...(datos.medicamentos !== undefined
        ? { medicamentos: normalizarTexto(datos.medicamentos) }
        : {}),
      ...(datos.nivel_actividad !== undefined ? { nivelActividad: datos.nivel_actividad } : {}),
      ...(datos.objetivo !== undefined ? { objetivo: datos.objetivo } : {}),
      ...(tocaObjetivo
        ? { objetivoOtro: objetivoOtroDe(objetivoVigente, datos.objetivo_otro) }
        : {}),
    },
    create: {
      patientId,
      condiciones: datos.condiciones ?? [],
      antecedentes: normalizarTexto(datos.antecedentes),
      medicamentos: normalizarTexto(datos.medicamentos),
      nivelActividad: datos.nivel_actividad ?? 'MODERADO',
      objetivo: datos.objetivo ?? 'MANTENIMIENTO',
      objetivoOtro: objetivoOtroDe(datos.objetivo, datos.objetivo_otro),
    },
  });
}

export async function actualizarPreferencias(
  nutritionistId: string,
  patientId: string,
  datos: PreferenciasInput,
) {
  const paciente = await buscarPaciente(nutritionistId, patientId);
  if (!paciente) return null;

  return prisma.foodPreference.upsert({
    where: { patientId },
    update: {
      ...(datos.tipo_dieta !== undefined ? { tipoDieta: normalizarTexto(datos.tipo_dieta) } : {}),
      ...(datos.alergias !== undefined ? { alergias: datos.alergias } : {}),
      ...(datos.disgustos !== undefined ? { disgustos: normalizarTexto(datos.disgustos) } : {}),
      ...(datos.comidas_por_dia !== undefined ? { comidasPorDia: datos.comidas_por_dia } : {}),
      ...(datos.presupuesto_tiempo !== undefined
        ? { presupuestoTiempo: datos.presupuesto_tiempo }
        : {}),
    },
    create: {
      patientId,
      tipoDieta: normalizarTexto(datos.tipo_dieta),
      alergias: datos.alergias ?? [],
      disgustos: normalizarTexto(datos.disgustos),
      comidasPorDia: datos.comidas_por_dia ?? 3,
      presupuestoTiempo: datos.presupuesto_tiempo ?? 'Medio',
    },
  });
}

export async function listarMediciones(nutritionistId: string, patientId: string) {
  const paciente = await buscarPaciente(nutritionistId, patientId);
  if (!paciente) return null;
  return paciente.measurements;
}

/** El cálculo nuevo prepara el borrador; nunca altera el plan histórico activo. */
async function borradorVigente(patientId: string) {
  return prisma.mealPlan.findFirst({
    where: { patientId, estado: 'BORRADOR' },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Persiste el snapshot del cálculo junto con las metas que produce.
 * Devuelve null si el paciente no es de este nutriólogo.
 */
export async function guardarCalculo(
  nutritionistId: string,
  patientId: string,
  snapshot: SnapshotCalculo,
) {
  const paciente = await buscarPaciente(nutritionistId, patientId);
  if (!paciente) return null;

  const metas = {
    caloriasDiarias: snapshot.resultado.objetivoCalorias,
    proteinaG: snapshot.resultado.proteina_g,
    carbosG: snapshot.resultado.carbos_g,
    grasaG: snapshot.resultado.grasa_g,
    // El snapshot es un documento versionado de `packages/shared`; Prisma lo
    // guarda tal cual en la columna jsonb.
    calculoSnapshot: snapshot as unknown as Prisma.InputJsonValue,
  };

  const plan = await borradorVigente(patientId);
  if (plan) {
    return prisma.mealPlan.update({ where: { id: plan.id }, data: metas });
  }

  return prisma.mealPlan.create({
    data: { patientId, estado: 'BORRADOR', origen: 'MANUAL', ...metas },
  });
}

export async function agregarMedicion(
  nutritionistId: string,
  patientId: string,
  datos: MedicionInput,
) {
  const paciente = await buscarPaciente(nutritionistId, patientId);
  if (!paciente) return null;

  return prisma.anthropometryMeasurement.create({
    data: {
      patientId,
      fecha: fechaDeMedicion(datos.fecha),
      pesoKg: datos.peso_kg ?? null,
      alturaCm: datos.altura_cm ?? null,
      cinturaCm: datos.cintura_cm ?? null,
      caderaCm: datos.cadera_cm ?? null,
      grasaPct: datos.grasa_pct ?? null,
      musculoPct: datos.musculo_pct ?? null,
      pliegues: datos.pliegues ?? undefined,
    },
  });
}
