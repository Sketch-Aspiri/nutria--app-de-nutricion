export type ItemPlanHoy = {
  id: string;
  descripcion_libre: string | null;
  energia_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  lipidos_g: number;
  food: {
    nombre: string;
    porcion_descripcion: string;
  } | null;
};

export type ComidaPlanHoy = {
  id: string;
  orden: number;
  nombre: string;
  horario: string | null;
  descripcion: string | null;
  items: ItemPlanHoy[];
};

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

export type TotalesNutricionales = {
  calorias: number;
  proteina: number;
  carbos: number;
  grasa: number;
};
