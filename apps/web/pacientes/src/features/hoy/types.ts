import type { ComidaPlan, ItemPlan } from '@/features/plan/types';

/**
 * Las comidas que `/me/today` incluye son el mismo plan que sirve
 * `/me/meal_plan`, serializado por la misma función. Se declaran una sola vez,
 * en la feature dueña del plan, y aquí se conservan los nombres con los que ya
 * se lee el resto de Hoy.
 */
export type ItemPlanHoy = ItemPlan;
export type ComidaPlanHoy = ComidaPlan;

export type PlanHoy = {
  id: string;
  calorias_diarias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  comidas: ComidaPlanHoy[];
};

export type RegistroComidaHoy = {
  id: string;
  meal_plan_meal_id: string | null;
  fecha: string;
  dia: string;
  hora: string | null;
  nombre: string;
  calorias: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
  origen: 'MANUAL' | 'IA';
  foto_url: string | null;
  comentario_paciente: string | null;
  created_at: string;
};

export type AdherenciaHoy = {
  porcentaje: number;
  racha: number;
  dias_evaluados: number;
  comidas_registradas: number;
  comidas_esperadas: number;
};

export type ResumenHoy = {
  dia: string;
  zona_horaria: string;
  plan: PlanHoy | null;
  comidas_marcadas: string[];
  registros: RegistroComidaHoy[];
  agua: { vasos: number; meta: number };
  adherencia: AdherenciaHoy | null;
};

export type EstimacionComida = {
  alimento: string;
  calorias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
};

export type RespuestaEstimacion = {
  tipo: 'ESTIMACION_COMIDA';
  formato: 'estructurado';
  datos: EstimacionComida;
  aviso: string;
  cuota: { usadas: number; limite: number; restantes: number };
};

export type TurnoCoach = {
  rol: 'paciente' | 'coach';
  texto: string;
};

export type RespuestaCoach = {
  tipo: 'COACH_PACIENTE';
  formato: 'texto';
  texto: string;
  aviso: string;
  cuota: { usadas: number; limite: number; restantes: number };
};

export type { TotalesNutricionales } from '@/features/plan/calculos';
