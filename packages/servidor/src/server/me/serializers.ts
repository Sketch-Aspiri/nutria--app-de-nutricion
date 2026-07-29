import type {
  ActivityPlan,
  Appointment,
  ExerciseLog,
  MealLog,
  Message,
  Recipe,
  WeightLog,
} from '@prisma/client';

import { fechaIsoEnZona } from '@nutria/shared';

import { serializarPlan } from '@/server/plans/serializers';

import type { PerfilPaciente, ResumenHoy, ResumenProgreso } from './repository';

/**
 * JSON público de `/api/v1/me/*`: snake_case y fechas ISO 8601, según
 * `rules/api-conventions.md`.
 *
 * Ninguna respuesta incluye `nutritionist_id`, notas clínicas ni comentarios
 * internos del profesional: el paciente ve lo suyo y lo que le compartieron,
 * no el expediente que el nutriólogo escribe sobre él.
 */

function soloFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function serializarPerfil(perfil: PerfilPaciente) {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    foto_url: perfil.fotoUrl,
    objetivo: perfil.objetivo,
    objetivo_otro: perfil.objetivoOtro,
    nutriologo: {
      nombre: perfil.nutriologo.nombre,
      consultorio: perfil.nutriologo.consultorio,
    },
    meta_agua_vasos: perfil.metaAguaVasos,
    metas: perfil.metas
      ? {
          calorias_diarias: perfil.metas.caloriasDiarias,
          proteina_g: perfil.metas.proteinaG,
          carbos_g: perfil.metas.carbosG,
          grasa_g: perfil.metas.grasaG,
        }
      : null,
  };
}

/**
 * Registro de comida del paciente.
 *
 * Se omite `comentario_nutriologo` a propósito: ese campo es la anotación que
 * el profesional hace para sí mismo sobre la comida, no un mensaje al paciente.
 */
export function serializarRegistroComida(comida: MealLog, zonaHoraria: string) {
  return {
    id: comida.id,
    meal_plan_meal_id: comida.mealPlanMealId,
    fecha: comida.fecha.toISOString(),
    dia: fechaIsoEnZona(comida.fecha, zonaHoraria),
    hora: comida.hora?.toISOString() ?? null,
    nombre: comida.nombre,
    calorias: comida.calorias,
    proteina_g: comida.proteinaG,
    carbos_g: comida.carbosG,
    grasa_g: comida.grasaG,
    origen: comida.origen,
    foto_url: comida.fotoUrl,
    comentario_paciente: comida.comentarioPaciente,
    created_at: comida.createdAt.toISOString(),
  };
}

export function serializarPeso(registro: WeightLog) {
  return {
    id: registro.id,
    fecha: soloFecha(registro.fecha),
    peso_kg: registro.pesoKg,
    created_at: registro.createdAt.toISOString(),
  };
}

export function serializarEjercicio(registro: ExerciseLog) {
  return {
    id: registro.id,
    fecha: soloFecha(registro.fecha),
    tipo: registro.tipo,
    duracion_min: registro.duracionMin,
    created_at: registro.createdAt.toISOString(),
  };
}

export function serializarReceta(receta: Recipe) {
  return {
    id: receta.id,
    nombre: receta.nombre,
    ingredientes: Array.isArray(receta.ingredientes) ? receta.ingredientes : [],
    pasos: receta.pasos,
    calorias: receta.calorias,
    porciones: receta.porciones,
    origen: receta.origen,
    updated_at: receta.updatedAt.toISOString(),
  };
}

export function serializarPlanActividad(plan: ActivityPlan) {
  return {
    id: plan.id,
    texto: plan.texto,
    compartido_at: plan.compartidoAt?.toISOString() ?? null,
    updated_at: plan.updatedAt.toISOString(),
  };
}

export function serializarMensaje(mensaje: Message) {
  return {
    id: mensaje.id,
    emisor: mensaje.emisor,
    texto: mensaje.texto,
    leido_at: mensaje.leidoAt?.toISOString() ?? null,
    created_at: mensaje.createdAt.toISOString(),
  };
}

/** La cita no lleva `notas`: son del nutriólogo, no del paciente. */
export function serializarCita(cita: Appointment) {
  return {
    id: cita.id,
    inicio: cita.inicio.toISOString(),
    duracion_min: cita.duracionMin,
    tipo: cita.tipo,
    estado: cita.estado,
    video_url: cita.videoUrl,
  };
}

export function serializarHoy(resumen: ResumenHoy) {
  return {
    dia: resumen.dia,
    zona_horaria: resumen.zonaHoraria,
    plan: resumen.plan ? serializarPlan(resumen.plan) : null,
    comidas_marcadas: resumen.comidasMarcadas,
    registros: resumen.registros.map((registro) =>
      serializarRegistroComida(registro, resumen.zonaHoraria),
    ),
    agua: { vasos: resumen.agua.vasos, meta: resumen.agua.meta },
    adherencia: resumen.adherencia
      ? {
          porcentaje: resumen.adherencia.adherencia,
          racha: resumen.adherencia.racha,
          dias_evaluados: resumen.adherencia.diasEvaluados,
          comidas_registradas: resumen.adherencia.comidasRegistradas,
          comidas_esperadas: resumen.adherencia.comidasEsperadas,
        }
      : null,
  };
}

export function serializarProgreso(resumen: ResumenProgreso) {
  return {
    pesos: resumen.pesos.map(serializarPeso),
    peso: resumen.peso
      ? {
          inicial: resumen.peso.inicial,
          actual: resumen.peso.actual,
          cambio_kg: resumen.peso.cambioKg,
        }
      : null,
    falta_kg: resumen.faltaKg,
    logros: resumen.logros.map((logro) => ({
      id: logro.id,
      titulo: logro.titulo,
      descripcion: logro.descripcion,
      conseguido: logro.conseguido,
      progreso: logro.progreso,
    })),
  };
}
