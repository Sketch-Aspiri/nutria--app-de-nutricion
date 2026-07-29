import { SISTEMA_BASE_PACIENTE } from './config';
import type { ContextoCoach, RecetaParaSustitucion } from './contextoPaciente';
import type { TurnoCoach } from './schemasPaciente';

/**
 * Prompts de la IA del paciente, armados en el servidor.
 *
 * La app manda intención (una pregunta, un texto, un ingrediente) y el servidor
 * agrega el contexto ya seudonimizado. Si el cliente pudiera mandar el prompt
 * completo, una pantalla nueva podría saltarse la seudonimización sin notarlo.
 */

const SIN_DATO = 'sin registrar';

function lista(valores: string[]): string {
  return valores.length > 0 ? valores.join(', ') : 'ninguna';
}

function opcional(valor: string | null): string {
  return valor && valor.trim() ? valor : SIN_DATO;
}

/**
 * Ficha mínima del paciente, común a los tres casos de uso.
 *
 * No lleva edad, peso, altura, condiciones ni medicamentos: la salida la lee el
 * paciente, no un profesional, y ninguno de esos datos mejora una orientación
 * general. Las alergias sí van siempre — son restricción absoluta.
 */
export function fichaCoach(contexto: ContextoCoach): string {
  const metas = contexto.metas
    ? `${contexto.metas.calorias} kcal, ${contexto.metas.proteinaG} g de proteína, ${contexto.metas.carbosG} g de carbohidratos, ${contexto.metas.grasaG} g de grasa`
    : 'su nutrióloga aún no le comparte un plan, así que NO tiene metas asignadas; no inventes cifras';

  return [
    'CONTEXTO DEL PACIENTE (seudonimizado; no conoces su nombre):',
    `- Objetivo: ${contexto.objetivo}`,
    `- Metas diarias de su plan: ${metas}`,
    `- ALERGIAS (restricción absoluta): ${lista(contexto.alergias)}`,
    `- Tipo de dieta: ${opcional(contexto.tipoDieta)}`,
    `- Alimentos que no le gustan: ${opcional(contexto.disgustos)}`,
    `- Comidas por día: ${contexto.comidasPorDia}`,
  ].join('\n');
}

export const SISTEMA_COACH = [
  SISTEMA_BASE_PACIENTE,
  'Respondes dudas cotidianas sobre alimentación y sobre cómo usar la app.',
  'Máximo 4 frases. Sin listas largas, sin cifras que no estén en su contexto y sin prometer resultados.',
  'Si te pide cambiar su plan, sus metas o sus horarios, explícale en una frase que eso lo decide su nutrióloga y que puede escribirle desde el chat de la app.',
].join(' ');

/** El historial viaja en el prompt: el coach no guarda conversación en la base. */
function transcripcion(historial: TurnoCoach[]): string[] {
  if (historial.length === 0) return [];
  return [
    'CONVERSACIÓN PREVIA (de más antigua a más reciente):',
    ...historial.map((turno) => `${turno.rol === 'paciente' ? 'Paciente' : 'Tú'}: ${turno.texto}`),
    '',
  ];
}

export function promptCoach(
  contexto: ContextoCoach,
  mensaje: string,
  historial: TurnoCoach[],
): string {
  return [
    fichaCoach(contexto),
    '',
    ...transcripcion(historial),
    'PREGUNTA DEL PACIENTE:',
    mensaje,
    '',
    'Responde solo con el texto de tu respuesta, sin encabezados ni comillas.',
  ].join('\n');
}

export const SISTEMA_ESTIMACION_COMIDA = [
  SISTEMA_BASE_PACIENTE,
  'Tu única tarea aquí es estimar el aporte nutrimental de lo que el paciente describe que comió, para que él lo registre en su diario.',
  'Estima con criterio conservador y con porciones caseras mexicanas; si la descripción es ambigua, asume la porción más común y refléjalo en el campo `alimento`.',
  'No opines sobre si estuvo bien o mal comerlo, no felicites ni regañes: solo estima.',
].join(' ');

export function promptEstimacionComida(contexto: ContextoCoach, texto: string): string {
  return [
    fichaCoach(contexto),
    '',
    'LO QUE EL PACIENTE DESCRIBE HABER COMIDO:',
    texto,
    '',
    'Estima el total de la descripción completa, no de una sola porción, y devuelve las cifras del esquema.',
  ].join('\n');
}

export const SISTEMA_SUSTITUCION = [
  SISTEMA_BASE_PACIENTE,
  'Propones el reemplazo de UN ingrediente por otro equivalente, fácil de conseguir en México.',
  'Regla dura: el sustituto no puede ser, ni contener, nada de la lista de alergias del paciente.',
  'Mantén el aporte parecido al del ingrediente original y respeta su tipo de dieta y lo que no le gusta.',
  'No rediseñes la receta ni cambies otros ingredientes: solo el que te piden.',
].join(' ');

export function promptSustitucion(
  contexto: ContextoCoach,
  ingrediente: string,
  receta: RecetaParaSustitucion | null,
): string {
  const contextoReceta = receta
    ? [
        `RECETA EN LA QUE SE USA: ${receta.nombre}`,
        `Ingredientes de la receta: ${lista(receta.ingredientes)}`,
        '',
      ]
    : ['RECETA: el paciente no indicó receta; propón un reemplazo de uso general.', ''];

  return [
    fichaCoach(contexto),
    '',
    ...contextoReceta,
    `INGREDIENTE A SUSTITUIR: ${ingrediente}`,
    '',
    'Devuelve un solo sustituto con su cantidad equivalente y una razón breve dirigida al paciente.',
  ].join('\n');
}
