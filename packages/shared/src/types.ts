export type Genero = 'Femenino' | 'Masculino' | 'Otro';

export type NivelActividad = 'Sedentario' | 'Ligero' | 'Moderado' | 'Activo' | 'Muy activo';

export type Objetivo =
  | 'Pérdida de grasa'
  | 'Ganancia muscular'
  | 'Mantenimiento'
  | 'Control de diabetes'
  | 'Mejora deportiva'
  | 'Otro';

export type ExpedienteMedico = {
  condiciones: string[];
  antecedentes: string;
  medicamentos: string;
  nivelActividad: NivelActividad;
  objetivo: Objetivo;
};

export type RegistroPeso = {
  fecha: string;
  peso: number;
};

export type Antropometria = {
  peso: number;
  altura: number;
  cintura: number;
  cadera: number;
  grasaCorporal: number;
  historial: RegistroPeso[];
};

export type PreferenciasAlimentarias = {
  tipoDieta: string;
  alergias: string[];
  disgustos: string;
  comidasPorDia: number;
  presupuestoTiempo: 'Bajo' | 'Medio' | 'Alto';
};

export type CalculoNutricional = {
  bmr: number;
  tdee: number;
  objetivoCalorias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  pPct: number;
  cPct: number;
  gPct: number;
};

export type ComidaPlan = {
  nombre: string;
  horario: string;
  descripcion: string;
  porcion?: string;
  calorias: number;
};

export type PlanAlimenticio = {
  calorias_diarias: number;
  macros: { proteina_g: number; carbos_g: number; grasa_g: number };
  comidas: ComidaPlan[];
  nota_ia?: string;
  compartido?: string | null;
};

export type PlanEjercicio = {
  texto: string;
  compartido: string | null;
};

export type NotaConsulta = {
  fecha: string;
  motivo: string;
  hallazgos: string;
  plan: string;
  seguimiento: string;
};

export type ComidaRegistrada = {
  id: number;
  fecha: string;
  nombre: string;
  emoji: string;
  comentario: string;
};

export type EjercicioRegistrado = {
  id: number;
  fecha: string;
  tipo: string;
  duracion: string;
};

export type RecetaEnCurso = {
  id: number;
  nombre: string;
  frecuencia: string;
};

export type RecetaSugerida = {
  id: number;
  nombre: string;
  ingredientes: string[];
  pasos_breve: string;
  calorias: number;
  porciones: number;
  enviada: boolean;
};

export type Seguimiento = {
  adherencia: number;
  racha: number;
  comidas: ComidaRegistrada[];
  ejercicio: EjercicioRegistrado[];
  recetasEnCurso: RecetaEnCurso[];
  recetasSugeridas: RecetaSugerida[];
};

export type Paciente = {
  /** UUID asignado por la base de datos. */
  id: string;
  nombre: string;
  foto: string | null;
  /** Años cumplidos, derivados de `fechaNacimiento`; no se almacena. */
  edad: number;
  fechaNacimiento: string | null;
  genero: Genero;
  telefono: string;
  email: string;
  medico: ExpedienteMedico;
  antropometria: Antropometria;
  preferencias: PreferenciasAlimentarias;
  calculo: CalculoNutricional | null;
  planActivo: PlanAlimenticio | null;
  planEjercicio: PlanEjercicio | null;
  notasConsulta: NotaConsulta[];
  seguimiento: Seguimiento;
};

export type Cita = {
  id: number;
  pacienteId: string;
  paciente: string;
  fecha: string;
  hora: string;
  tipo: string;
  recordatorio: boolean;
};

export type MensajeChat = {
  de: 'paciente' | 'nutriologo';
  texto: string;
  hora: string;
};

export type Factura = {
  id: number;
  pacienteId: string;
  paciente: string;
  concepto: string;
  monto: number;
  fecha: string;
  pagada: boolean;
  cfdi: boolean;
};

export type PlantillaPlan = {
  id: number;
  nombre: string;
  objetivo: Objetivo;
  calorias: number;
  descripcion: string;
};

export type Marca = {
  nombre: string;
  profesional: string;
  color: string;
  logo: string | null;
};

export type Alimento = {
  cat: string;
  nombre: string;
  porcion: string;
  kcal: number;
  prot: number;
  carb: number;
  gras: number;
};
