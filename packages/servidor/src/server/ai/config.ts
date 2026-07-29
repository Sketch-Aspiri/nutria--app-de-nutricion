/**
 * Configuración del servicio de IA: qué modelo y qué presupuesto de tokens
 * corresponde a cada caso de uso (sección 8 del plan V2).
 *
 * Sonnet para lo que tiene consecuencia clínica (plan, receta, resumen de la
 * nota); Haiku para las tareas ligeras, donde la latencia y el costo pesan más
 * que el matiz. `maxTokens` se acota por tipo: un borrador de plan necesita
 * espacio, una sugerencia de respuesta no.
 */

export const TIPOS_GENERACION = [
  'PLAN',
  'NOTA_CLINICA',
  'RECETA',
  'RESPUESTA_MENSAJE',
  'PLAN_ACTIVIDAD',
] as const;

export type TipoGeneracion = (typeof TIPOS_GENERACION)[number];

/** Modelo de calidad clínica. */
const SONNET = 'claude-sonnet-5';
/** Modelo económico para tareas cortas. */
const HAIKU = 'claude-haiku-4-5';

export type ConfiguracionTipo = {
  modelo: string;
  maxTokens: number;
  /**
   * `true` cuando la respuesta se pide con schema JSON y se valida con Zod.
   * El resto devuelve texto libre que el nutriólogo edita.
   */
  estructurado: boolean;
  /**
   * El parámetro `effort` solo existe en los modelos que lo soportan; mandarlo
   * a Haiku 4.5 devuelve 400.
   */
  effort?: 'low' | 'medium' | 'high';
};

export const CONFIGURACION: Record<TipoGeneracion, ConfiguracionTipo> = {
  PLAN: { modelo: SONNET, maxTokens: 8_000, estructurado: true, effort: 'medium' },
  NOTA_CLINICA: { modelo: SONNET, maxTokens: 1_500, estructurado: true, effort: 'low' },
  RECETA: { modelo: SONNET, maxTokens: 2_000, estructurado: true, effort: 'low' },
  RESPUESTA_MENSAJE: { modelo: HAIKU, maxTokens: 600, estructurado: false },
  PLAN_ACTIVIDAD: { modelo: HAIKU, maxTokens: 900, estructurado: false },
};

/* -------------------------------------------------------------------------- */
/* IA de la app del paciente (sección 8 del plan de pacientes)                 */
/* -------------------------------------------------------------------------- */

export const TIPOS_GENERACION_PACIENTE = [
  'COACH_PACIENTE',
  'ESTIMACION_COMIDA',
  'SUSTITUCION_INGREDIENTE',
] as const;

export type TipoGeneracionPaciente = (typeof TIPOS_GENERACION_PACIENTE)[number];

/**
 * Los tres son Haiku y con presupuesto corto a propósito: son respuestas de
 * pantalla de teléfono, las paga la suscripción del nutriólogo y ninguna tiene
 * consecuencia clínica —la IA del paciente orienta, no decide—.
 */
export const CONFIGURACION_PACIENTE: Record<TipoGeneracionPaciente, ConfiguracionTipo> = {
  COACH_PACIENTE: { modelo: HAIKU, maxTokens: 400, estructurado: false },
  ESTIMACION_COMIDA: { modelo: HAIKU, maxTokens: 300, estructurado: true },
  SUSTITUCION_INGREDIENTE: { modelo: HAIKU, maxTokens: 300, estructurado: true },
};

/**
 * Aviso que acompaña a toda salida de IA que ve el paciente. Viaja en la
 * respuesta —no lo escribe la UI— para que ninguna pantalla nueva pueda
 * mostrar una respuesta del modelo sin él. Texto tomado del prototipo.
 */
export const AVISO_IA_PACIENTE = 'Orientación general. No sustituye a tu nutrióloga.';

/**
 * Instrucción común de la IA del paciente.
 *
 * `SISTEMA_BASE` habla con un profesional que revisa borradores; aquí el lector
 * es el paciente y no hay revisión de por medio, así que las prohibiciones son
 * más duras: nada de diagnósticos, nada de cambiar el plan y derivación
 * explícita a la nutrióloga en cuanto la pregunta pida criterio clínico.
 */
export const SISTEMA_BASE_PACIENTE = [
  'Eres el asistente de una app de nutrición y le escribes directamente al paciente.',
  'NO eres su nutrióloga y no la sustituyes: orientas sobre lo que ya le indicó y le ayudas a registrar lo que come.',
  'Nunca emitas diagnósticos, nunca interpretes síntomas, nunca hables de medicamentos ni de suplementos, y nunca afirmes que algo es seguro para su salud.',
  'NUNCA cambies su plan alimenticio, sus metas ni sus horarios, ni le sugieras hacerlo por su cuenta: si necesita un ajuste, dile que se lo pida a su nutrióloga desde el chat de la app.',
  'Ante cualquier pregunta médica, síntoma, malestar, embarazo, medicación o duda que requiera criterio clínico, no respondas el fondo: deriva a su nutrióloga en una frase.',
  'Los datos que recibes están seudonimizados: no conoces su nombre ni su contacto. No los pidas ni los inventes.',
  'Escribe en español de México, de tú, cálido y breve.',
].join(' ');

/** Tolerancia respecto a la meta energética antes de rechazar un borrador. */
export const TOLERANCIA_ENERGIA = 0.05;

/** Reintentos de la propia generación (aparte de los reintentos HTTP del SDK). */
export const REINTENTOS_VALIDACION = 1;

/** Alimentos que se ofrecen al modelo como catálogo para armar el plan. */
export const MAX_ALIMENTOS_EN_PROMPT = 120;

/**
 * Instrucción común: la IA propone y el nutriólogo aprueba. No es decoración —
 * `CLAUDE.md` prohíbe que el producto emita indicaciones clínicas automáticas.
 */
export const SISTEMA_BASE = [
  'Eres un asistente para nutriólogos profesionales en México.',
  'Todo lo que produces es un BORRADOR que el nutriólogo revisa, edita y aprueba antes de usarlo con el paciente.',
  'Nunca emitas diagnósticos, nunca indiques medicamentos y nunca afirmes que una propuesta es definitiva.',
  'Los datos que recibes están seudonimizados: al paciente se le llama [PACIENTE] y no conoces su nombre ni su contacto. No inventes datos personales ni pidas identificarlo.',
  'Si falta información clínica para responder con seguridad, dilo explícitamente en lugar de suponerla.',
  'Escribe en español de México, en un registro profesional y directo.',
].join(' ');
