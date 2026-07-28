import type { ActivityPlan, ExerciseLog, MealLog, WeightLog } from '@prisma/client';

import {
  calcularAdherencia,
  desgloseDiario,
  type DiaAdherencia,
  fechaIsoEnZona,
  type FechaIso,
  type ResumenAdherencia,
  tendenciaPeso,
} from '@nutria/shared';

import { prisma } from '@/server/db';
import { esIdValido, pacientePropio, zonaHorariaDe } from '@/server/patients/ownership';

import type {
  ComentarComidaInput,
  ConsultaAdherenciaInput,
  FiltroSeguimientoInput,
  GuardarPlanActividadInput,
  RegistrarComidaInput,
  RegistrarEjercicioInput,
  RegistrarPesoInput,
} from './schemas';

/**
 * Seguimiento del paciente: lo que registra desde la app móvil y lo que el
 * nutriólogo comenta sobre ello.
 *
 * La adherencia y la racha **no se almacenan**: se calculan sobre `meal_logs`
 * contra el plan activo cada vez que se piden. Guardarlas como columnas las
 * dejaría desfasadas en cuanto el paciente registrara algo tarde.
 */

/** Un día `YYYY-MM-DD` se guarda como medianoche UTC en una columna `@db.Date`. */
function aColumnaFecha(dia: FechaIso): Date {
  return new Date(`${dia}T00:00:00Z`);
}

function rangoDeFiltros(filtros: FiltroSeguimientoInput) {
  if (!filtros.desde && !filtros.hasta) return {};
  return {
    fecha: {
      ...(filtros.desde ? { gte: aColumnaFecha(filtros.desde) } : {}),
      ...(filtros.hasta ? { lte: aColumnaFecha(filtros.hasta) } : {}),
    },
  };
}

// --- Comidas registradas -----------------------------------------------------

export type ResultadoComidas = {
  comidas: MealLog[];
  total: number;
  zonaHoraria: string;
};

export async function listarComidas(
  nutritionistId: string,
  patientId: string,
  paginacion: { skip: number; take: number },
  filtros: FiltroSeguimientoInput,
): Promise<ResultadoComidas | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  const where = {
    patientId,
    // El filtro por día se aplica sobre un instante: se abarca el día completo
    // tomando desde su medianoche hasta la del día siguiente.
    ...(filtros.desde || filtros.hasta
      ? {
          fecha: {
            ...(filtros.desde ? { gte: aColumnaFecha(filtros.desde) } : {}),
            ...(filtros.hasta
              ? { lt: new Date(aColumnaFecha(filtros.hasta).getTime() + 86_400_000) }
              : {}),
          },
        }
      : {}),
  };

  const [comidas, total, zonaHoraria] = await Promise.all([
    prisma.mealLog.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: paginacion.skip,
      take: paginacion.take,
    }),
    prisma.mealLog.count({ where }),
    zonaHorariaDe(nutritionistId),
  ]);

  return { comidas, total, zonaHoraria };
}

export async function registrarComida(
  nutritionistId: string,
  patientId: string,
  datos: RegistrarComidaInput,
): Promise<{ comida: MealLog; zonaHoraria: string } | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  // Una comida solo puede colgar de una comida del plan de ESTE paciente: sin
  // la comprobación, un id ajeno ligaría el registro al plan de otro.
  if (datos.meal_plan_meal_id) {
    const comidaDelPlan = await prisma.mealPlanMeal.findFirst({
      where: { id: datos.meal_plan_meal_id, mealPlan: { patientId } },
      select: { id: true },
    });
    if (!comidaDelPlan) return null;
  }

  const [comida, zonaHoraria] = await Promise.all([
    prisma.mealLog.create({
      data: {
        patientId,
        mealPlanMealId: datos.meal_plan_meal_id ?? null,
        fecha: datos.fecha,
        nombre: datos.nombre,
        fotoUrl: datos.foto_url ?? null,
        comentarioPaciente: datos.comentario_paciente ?? null,
      },
    }),
    zonaHorariaDe(nutritionistId),
  ]);

  return { comida, zonaHoraria };
}

/**
 * El nutriólogo comenta una comida ya registrada.
 *
 * Solo toca `comentario_nutriologo`: lo que escribió el paciente sobre su
 * propia comida es su registro y el profesional no lo reescribe.
 */
export async function comentarComida(
  nutritionistId: string,
  comidaId: string,
  datos: ComentarComidaInput,
): Promise<{ comida: MealLog; zonaHoraria: string } | null> {
  if (!esIdValido(comidaId)) return null;

  const { count } = await prisma.mealLog.updateMany({
    where: { id: comidaId, patient: { nutritionistId, deletedAt: null } },
    data: { comentarioNutriologo: datos.comentario_nutriologo },
  });
  if (count === 0) return null;

  const [comida, zonaHoraria] = await Promise.all([
    prisma.mealLog.findUniqueOrThrow({ where: { id: comidaId } }),
    zonaHorariaDe(nutritionistId),
  ]);

  return { comida, zonaHoraria };
}

// --- Peso --------------------------------------------------------------------

export async function listarPesos(
  nutritionistId: string,
  patientId: string,
  filtros: FiltroSeguimientoInput,
): Promise<WeightLog[] | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  return prisma.weightLog.findMany({
    where: { patientId, ...rangoDeFiltros(filtros) },
    orderBy: { fecha: 'asc' },
  });
}

/**
 * Un peso por paciente y día (`@@unique`): volver a pesarse el mismo día
 * corrige la lectura anterior en lugar de duplicar el punto de la gráfica.
 */
export async function registrarPeso(
  nutritionistId: string,
  patientId: string,
  datos: RegistrarPesoInput,
): Promise<WeightLog | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  const fecha = aColumnaFecha(datos.fecha);
  return prisma.weightLog.upsert({
    where: { patientId_fecha: { patientId, fecha } },
    create: { patientId, fecha, pesoKg: datos.peso_kg },
    update: { pesoKg: datos.peso_kg },
  });
}

// --- Ejercicio ---------------------------------------------------------------

export async function listarEjercicio(
  nutritionistId: string,
  patientId: string,
  filtros: FiltroSeguimientoInput,
): Promise<ExerciseLog[] | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  return prisma.exerciseLog.findMany({
    where: { patientId, ...rangoDeFiltros(filtros) },
    orderBy: { fecha: 'desc' },
  });
}

export async function registrarEjercicio(
  nutritionistId: string,
  patientId: string,
  datos: RegistrarEjercicioInput,
): Promise<ExerciseLog | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  return prisma.exerciseLog.create({
    data: {
      patientId,
      fecha: aColumnaFecha(datos.fecha),
      tipo: datos.tipo,
      duracionMin: datos.duracion_min,
    },
  });
}

// --- Adherencia --------------------------------------------------------------

export type ResumenSeguimiento = {
  /** null cuando el paciente no tiene plan activo: no hay contra qué medir. */
  adherencia: ResumenAdherencia | null;
  dias: DiaAdherencia[];
  comidasPorDia: number | null;
  planActivoDesde: FechaIso | null;
  peso: { inicial: number; actual: number; cambioKg: number } | null;
  zonaHoraria: string;
};

export async function resumenDeSeguimiento(
  nutritionistId: string,
  patientId: string,
  consulta: ConsultaAdherenciaInput,
): Promise<ResumenSeguimiento | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  const zonaHoraria = await zonaHorariaDe(nutritionistId);
  const hoy = fechaIsoEnZona(new Date(), zonaHoraria);

  const planActivo = await prisma.mealPlan.findFirst({
    where: { patientId, estado: 'ACTIVO' },
    orderBy: { activadoAt: 'desc' },
    select: {
      activadoAt: true,
      createdAt: true,
      _count: { select: { meals: true } },
    },
  });

  // Ventana amplia: la gráfica de peso muestra la tendencia, no solo la semana.
  const desdeVentana = new Date(Date.now() - consulta.dias * 86_400_000);
  const [comidas, pesos] = await Promise.all([
    prisma.mealLog.findMany({
      where: { patientId, fecha: { gte: desdeVentana } },
      select: { fecha: true },
    }),
    prisma.weightLog.findMany({
      where: { patientId },
      orderBy: { fecha: 'asc' },
      select: { fecha: true, pesoKg: true },
    }),
  ]);

  const peso = tendenciaPeso(
    pesos.map((registro) => ({
      fecha: registro.fecha.toISOString().slice(0, 10),
      pesoKg: registro.pesoKg,
    })),
  );

  if (!planActivo || planActivo._count.meals === 0) {
    // Sin plan activo (o con un plan sin comidas) no se reporta 0 %: se leería
    // como abandono del paciente cuando lo que falta es el plan.
    return {
      adherencia: null,
      dias: [],
      comidasPorDia: null,
      planActivoDesde: null,
      peso,
      zonaHoraria,
    };
  }

  const planActivoDesde = fechaIsoEnZona(
    planActivo.activadoAt ?? planActivo.createdAt,
    zonaHoraria,
  );
  const entrada = {
    registros: comidas.map((comida) => ({ fecha: fechaIsoEnZona(comida.fecha, zonaHoraria) })),
    comidasPorDia: planActivo._count.meals,
    planActivoDesde,
    hoy,
    dias: consulta.dias,
  };

  return {
    adherencia: calcularAdherencia(entrada),
    dias: desgloseDiario(entrada),
    comidasPorDia: planActivo._count.meals,
    planActivoDesde,
    peso,
    zonaHoraria,
  };
}

// --- Plan de actividad -------------------------------------------------------

export async function planActividadVigente(
  nutritionistId: string,
  patientId: string,
): Promise<ActivityPlan | null | undefined> {
  if (!(await pacientePropio(nutritionistId, patientId))) return undefined;

  return prisma.activityPlan.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Guarda el plan de actividad como una versión nueva.
 *
 * No se sobrescribe el anterior: si ya se compartió con el paciente, sigue
 * siendo lo que él tiene a la vista y el expediente debe conservarlo.
 */
export async function guardarPlanActividad(
  nutritionistId: string,
  patientId: string,
  datos: GuardarPlanActividadInput,
): Promise<ActivityPlan | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  return prisma.activityPlan.create({
    data: { patientId, texto: datos.texto, origen: datos.origen },
  });
}

export async function compartirPlanActividad(
  nutritionistId: string,
  planId: string,
): Promise<ActivityPlan | null> {
  if (!esIdValido(planId)) return null;

  const { count } = await prisma.activityPlan.updateMany({
    where: { id: planId, patient: { nutritionistId, deletedAt: null } },
    data: { compartidoAt: new Date() },
  });
  if (count === 0) return null;

  return prisma.activityPlan.findUniqueOrThrow({ where: { id: planId } });
}
