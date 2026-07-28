import type { ActivityPlan, ExerciseLog, MealLog, WeightLog } from '@prisma/client';

import { fechaIsoEnZona } from '@nutria/shared';

/**
 * El registro de comida guarda el instante (sirve saber que cenó a las 23:40),
 * pero el seguimiento razona en días naturales del consultorio. Se exponen los
 * dos: `fecha` completa y `dia` civil ya resuelto en la zona del nutriólogo.
 */
export function serializarComida(comida: MealLog, zonaHoraria: string) {
  return {
    id: comida.id,
    patient_id: comida.patientId,
    meal_plan_meal_id: comida.mealPlanMealId,
    fecha: comida.fecha.toISOString(),
    dia: fechaIsoEnZona(comida.fecha, zonaHoraria),
    nombre: comida.nombre,
    foto_url: comida.fotoUrl,
    comentario_paciente: comida.comentarioPaciente,
    comentario_nutriologo: comida.comentarioNutriologo,
    created_at: comida.createdAt.toISOString(),
  };
}

/** `fecha` es `@db.Date`: solo el día cuenta, sin hora ni conversión de zona. */
export function serializarPeso(registro: WeightLog) {
  return {
    id: registro.id,
    patient_id: registro.patientId,
    fecha: registro.fecha.toISOString().slice(0, 10),
    peso_kg: registro.pesoKg,
    created_at: registro.createdAt.toISOString(),
  };
}

export function serializarEjercicio(registro: ExerciseLog) {
  return {
    id: registro.id,
    patient_id: registro.patientId,
    fecha: registro.fecha.toISOString().slice(0, 10),
    tipo: registro.tipo,
    duracion_min: registro.duracionMin,
    created_at: registro.createdAt.toISOString(),
  };
}

export function serializarPlanActividad(plan: ActivityPlan) {
  return {
    id: plan.id,
    patient_id: plan.patientId,
    texto: plan.texto,
    origen: plan.origen,
    compartido_at: plan.compartidoAt?.toISOString() ?? null,
    created_at: plan.createdAt.toISOString(),
    updated_at: plan.updatedAt.toISOString(),
  };
}

export type ComidaSerializada = ReturnType<typeof serializarComida>;
export type PesoSerializado = ReturnType<typeof serializarPeso>;
export type EjercicioSerializado = ReturnType<typeof serializarEjercicio>;
export type PlanActividadSerializado = ReturnType<typeof serializarPlanActividad>;
