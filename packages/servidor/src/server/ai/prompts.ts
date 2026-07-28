import { SISTEMA_BASE, TOLERANCIA_ENERGIA } from './config';
import type { AlimentoCatalogo, ContextoPaciente } from './contexto';
import { MAX_NOTA_BORRADOR } from './schemas';

/**
 * Construcción de los prompts, en el servidor.
 *
 * La UI manda intención (`tipo`, notas, texto) y el servidor arma el prompt con
 * el contexto ya seudonimizado. Si el cliente pudiera mandar el prompt completo,
 * cualquier pantalla nueva podría saltarse la seudonimización sin darse cuenta.
 */

const SIN_DATO = 'sin registrar';

function lista(valores: string[]): string {
  return valores.length > 0 ? valores.join(', ') : 'ninguna';
}

function opcional(valor: string | null): string {
  return valor && valor.trim() ? valor : SIN_DATO;
}

function numero(valor: number | null, unidad: string): string {
  return typeof valor === 'number' ? `${valor} ${unidad}` : SIN_DATO;
}

/** Ficha clínica común a todos los casos de uso. */
export function fichaPaciente(contexto: ContextoPaciente): string {
  return [
    'FICHA DEL PACIENTE (seudonimizada):',
    `- Edad: ${contexto.edad !== null ? `${contexto.edad} años` : SIN_DATO}`,
    `- Género: ${contexto.genero}`,
    `- Peso: ${numero(contexto.pesoKg, 'kg')} · Altura: ${numero(contexto.alturaCm, 'cm')}`,
    `- Nivel de actividad: ${contexto.nivelActividad}`,
    `- Objetivo: ${contexto.objetivo}`,
    `- Condiciones: ${lista(contexto.condiciones)}`,
    `- Antecedentes: ${opcional(contexto.antecedentes)}`,
    `- Medicamentos: ${opcional(contexto.medicamentos)}`,
    `- Tipo de dieta: ${opcional(contexto.tipoDieta)}`,
    `- ALERGIAS (restricción absoluta): ${lista(contexto.alergias)}`,
    `- Alimentos que no le gustan: ${opcional(contexto.disgustos)}`,
    `- Comidas por día: ${contexto.comidasPorDia}`,
  ].join('\n');
}

function metaEnergetica(contexto: ContextoPaciente): string {
  if (!contexto.meta) {
    return [
      'META ENERGÉTICA: el expediente todavía no tiene un cálculo guardado.',
      'Propón cifras conservadoras acordes al objetivo y advierte en la nota que faltan por validar.',
    ].join(' ');
  }
  const { calorias, proteinaG, carbosG, grasaG, ecuacion } = contexto.meta;
  const margen = Math.round(calorias * TOLERANCIA_ENERGIA);
  return [
    `META ENERGÉTICA calculada (${ecuacion}): ${calorias} kcal, ${proteinaG} g de proteína, ${carbosG} g de carbohidratos, ${grasaG} g de grasa.`,
    `El total del día debe quedar entre ${calorias - margen} y ${calorias + margen} kcal; fuera de ese rango el borrador se rechaza.`,
  ].join(' ');
}

function catalogo(alimentos: AlimentoCatalogo[]): string {
  if (alimentos.length === 0) {
    return 'CATÁLOGO: vacío. Usa food_id null y describe cada alimento en texto.';
  }
  const filas = alimentos.map(
    (alimento) =>
      `${alimento.id} | ${alimento.nombre} | ${alimento.grupo} | ${alimento.porcion} | ${alimento.energiaKcal} kcal, P ${alimento.proteinaG} g, HC ${alimento.carbosG} g, L ${alimento.lipidosG} g`,
  );
  return [
    'CATÁLOGO DE ALIMENTOS DISPONIBLES (id | nombre | grupo | porción | aporte por porción):',
    ...filas,
    'Usa exclusivamente identificadores de esta lista en food_id. Si necesitas un alimento que no está, pon food_id en null y descríbelo en `descripcion`. Nunca inventes un identificador.',
  ].join('\n');
}

export const SISTEMA_PLAN = [
  SISTEMA_BASE,
  'Construyes borradores de plan alimenticio de UN día anclados al cálculo del expediente y a un catálogo de alimentos real.',
  'Regla dura: ningún alimento puede contener, ni siquiera como ingrediente, algo de la lista de alergias del paciente.',
  'Reparte la energía entre los tiempos de comida indicados y respeta la meta de macronutrimentos.',
].join(' ');

export function promptPlan(
  contexto: ContextoPaciente,
  alimentos: AlimentoCatalogo[],
  notas: string | null,
): string {
  return [
    fichaPaciente(contexto),
    '',
    metaEnergetica(contexto),
    '',
    catalogo(alimentos),
    '',
    `ENFOQUE PEDIDO POR EL NUTRIÓLOGO: ${notas?.trim() || 'ninguno en particular'}`,
    '',
    `Genera el borrador con ${contexto.comidasPorDia} tiempos de comida. En \`nota\`, escribe qué debe revisar el nutriólogo antes de aprobarlo: los puntos que de verdad requieren su criterio, sin repetir lo que ya se ve en el plan, y sin pasar de ${MAX_NOTA_BORRADOR} caracteres.`,
  ].join('\n');
}

export const SISTEMA_NOTA_CLINICA = [
  SISTEMA_BASE,
  'Conviertes notas o transcripciones de consulta en un resumen clínico estructurado (motivo, hallazgos, plan, seguimiento).',
  'No agregues información que no esté en el texto: si un apartado no se mencionó, escribe "No se registró en esta consulta".',
  'Conserva las cifras exactamente como aparecen en el texto original.',
].join(' ');

export function promptNotaClinica(contexto: ContextoPaciente, texto: string): string {
  return [
    fichaPaciente(contexto),
    '',
    'TEXTO DE LA CONSULTA (dictado o escrito por el nutriólogo):',
    texto,
    '',
    'Estructura ese texto. No inventes hallazgos ni indicaciones que no aparezcan arriba.',
  ].join('\n');
}

export const SISTEMA_RECETA = [
  SISTEMA_BASE,
  'Propones recetas caseras, realizables con ingredientes que se consiguen en México.',
  'Regla dura: ningún ingrediente puede ser, ni contener, algo de la lista de alergias del paciente.',
  'Calcula las calorías por porción de forma conservadora y coherente con los ingredientes.',
].join(' ');

export function promptReceta(
  contexto: ContextoPaciente,
  idea: string | null,
  caloriasObjetivo: number | null,
): string {
  const objetivo =
    caloriasObjetivo ??
    (contexto.meta ? Math.round(contexto.meta.calorias / contexto.comidasPorDia) : null);

  return [
    fichaPaciente(contexto),
    '',
    `IDEA DE PARTIDA: ${idea?.trim() || 'ninguna; propón algo acorde al objetivo y a las preferencias'}`,
    objetivo
      ? `META POR PORCIÓN: alrededor de ${objetivo} kcal.`
      : 'META POR PORCIÓN: no hay cálculo guardado; propón una porción razonable y dilo en los pasos.',
    '',
    'Devuelve una sola receta, con ingredientes en cantidades caseras y pasos numerados.',
  ].join('\n');
}

export const SISTEMA_RESPUESTA_MENSAJE = [
  SISTEMA_BASE,
  'Redactas un BORRADOR de respuesta que el nutriólogo leerá, editará y enviará él mismo.',
  'Escribe en segunda persona, cálido y breve (máximo 5 líneas), sin saludos protocolarios largos.',
  'No prometas resultados, no ajustes el plan por tu cuenta y no des indicaciones médicas: si el mensaje requiere una decisión clínica, sugiere agendar consulta.',
].join(' ');

export function promptRespuestaMensaje(
  contexto: ContextoPaciente,
  mensaje: string,
  intencion: string | null,
): string {
  return [
    fichaPaciente(contexto),
    '',
    'MENSAJE DEL PACIENTE:',
    mensaje,
    '',
    `INTENCIÓN DE LA RESPUESTA: ${intencion?.trim() || 'responder de forma útil y empática'}`,
    '',
    'Devuelve solo el texto de la respuesta, sin comillas ni encabezados.',
  ].join('\n');
}

export const SISTEMA_PLAN_ACTIVIDAD = [
  SISTEMA_BASE,
  'Propones un borrador de plan de actividad física semanal, progresivo y realista.',
  'Ajusta el volumen y la intensidad al nivel de actividad actual y a las condiciones del expediente; si hay una condición que contraindique el ejercicio intenso, dilo y propón alternativas de bajo impacto.',
  'Estructura la respuesta por días, con duración y esfuerzo aproximado.',
].join(' ');

export function promptPlanActividad(contexto: ContextoPaciente, notas: string | null): string {
  return [
    fichaPaciente(contexto),
    '',
    `PREFERENCIAS O LIMITACIONES INDICADAS: ${notas?.trim() || 'ninguna adicional'}`,
    '',
    'Devuelve el plan como texto plano, listo para que el nutriólogo lo edite. Cierra con una línea sobre qué revisar antes de entregarlo.',
  ].join('\n');
}
