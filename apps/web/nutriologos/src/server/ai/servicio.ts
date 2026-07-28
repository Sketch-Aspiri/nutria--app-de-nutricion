import type { ZodType } from 'zod';

import { type CuotaIA, extraerJSON } from '@nutria/shared';

import { enriquecerPlanBorrador } from './borrador';
import { type EsquemaJson, type ResultadoTexto, generar, generarConStream } from './cliente';
import { CONFIGURACION, REINTENTOS_VALIDACION, type TipoGeneracion } from './config';
import {
  type AlimentoCatalogo,
  type ContextoPaciente,
  cargarCatalogoAlimentos,
  cargarContextoPaciente,
  identificadoresDePaciente,
  limpiarTextoDelNutriologo,
} from './contexto';
import {
  SISTEMA_NOTA_CLINICA,
  SISTEMA_PLAN,
  SISTEMA_PLAN_ACTIVIDAD,
  SISTEMA_RECETA,
  SISTEMA_RESPUESTA_MENSAJE,
  promptNotaClinica,
  promptPlan,
  promptPlanActividad,
  promptReceta,
  promptRespuestaMensaje,
} from './prompts';
import {
  type GenerarInput,
  NOTA_CLINICA_JSON_SCHEMA,
  PLAN_JSON_SCHEMA,
  type PlanBorrador,
  RECETA_JSON_SCHEMA,
  notaClinicaBorradorSchema,
  planBorradorSchema,
  recetaBorradorSchema,
} from './schemas';
import {
  type ResultadoValidacion,
  validarPlan,
  validarReceta,
} from './validacion';
import { devolverGeneracion, registrarTokens, reservarGeneracion } from './uso';

/**
 * Orquestador de los cinco casos de uso de IA.
 *
 * El flujo es siempre el mismo: reservar cuota → cargar contexto seudonimizado →
 * armar prompt → llamar al modelo → validar → registrar consumo. La cuota se
 * reserva antes de llamar y se devuelve si la llamada falla, para que un error
 * del proveedor no le cueste una generación al nutriólogo.
 */

export class PacienteNoEncontradoError extends Error {
  constructor() {
    super('PACIENTE_NO_ENCONTRADO');
    this.name = 'PacienteNoEncontradoError';
  }
}

export class CuotaAgotadaError extends Error {
  constructor(readonly cuota: CuotaIA) {
    super('CUOTA_IA_AGOTADA');
    this.name = 'CuotaAgotadaError';
  }
}

export type EventoProgreso =
  /** Texto parcial; solo en los tipos de salida libre. */
  | { tipo: 'delta'; texto: string }
  /** Avance de una salida estructurada, que no tiene sentido mostrar cruda. */
  | { tipo: 'progreso'; caracteres: number }
  /** La salida no pasó la validación clínica y se está reintentando. */
  | { tipo: 'reintento'; motivos: string[] };

export type SalidaGeneracion = {
  tipo: TipoGeneracion;
  /** `estructurado` trae `datos`; `texto` trae `texto` para editar a mano. */
  formato: 'estructurado' | 'texto';
  datos: unknown | null;
  texto: string | null;
  /** Por qué se degradó a texto, si se degradó. Se muestra al nutriólogo. */
  advertencias: string[];
  cuota: CuotaIA;
};

type Preparado = {
  sistema: string;
  prompt: string;
  contexto: ContextoPaciente;
  alimentos: AlimentoCatalogo[];
  jsonSchema: EsquemaJson | null;
  /** Valida forma (Zod) y contenido clínico. */
  validar: ((datos: unknown) => ResultadoValidacion & { datos?: unknown }) | null;
  /** Post-proceso de la salida ya validada (resolver alimentos, totales…). */
  enriquecer?: (datos: unknown) => unknown;
};

/** Une la validación de forma con la clínica en un solo paso. */
function validadorDe<T>(
  schema: ZodType<T>,
  clinica: (datos: T) => ResultadoValidacion,
): (datos: unknown) => ResultadoValidacion & { datos?: unknown } {
  return (crudo: unknown) => {
    const parseado = schema.safeParse(crudo);
    if (!parseado.success) {
      return {
        ok: false,
        motivos: parseado.error.issues.map(
          (issue) => `${issue.path.join('.') || 'raíz'}: ${issue.message}`,
        ),
      };
    }
    const resultado = clinica(parseado.data);
    return resultado.ok ? { ok: true, datos: parseado.data } : resultado;
  };
}

async function preparar(
  nutritionistId: string,
  entrada: GenerarInput,
): Promise<Preparado> {
  const contexto = await cargarContextoPaciente(nutritionistId, entrada.patient_id);
  if (!contexto) throw new PacienteNoEncontradoError();

  const identificadores =
    (await identificadoresDePaciente(nutritionistId, entrada.patient_id)) ?? {};
  /** El texto libre del nutriólogo también pasa por el filtro antes de salir. */
  const limpiar = (texto: string | undefined | null): string | null =>
    texto?.trim() ? limpiarTextoDelNutriologo(texto, identificadores) : null;

  switch (entrada.tipo) {
    case 'PLAN': {
      const alimentos = await cargarCatalogoAlimentos(nutritionistId);
      return {
        sistema: SISTEMA_PLAN,
        prompt: promptPlan(contexto, alimentos, limpiar(entrada.notas)),
        contexto,
        alimentos,
        jsonSchema: PLAN_JSON_SCHEMA,
        validar: validadorDe(planBorradorSchema, (plan) =>
          validarPlan(plan, contexto, alimentos),
        ),
        enriquecer: (datos) => enriquecerPlanBorrador(datos as PlanBorrador, alimentos),
      };
    }
    case 'NOTA_CLINICA':
      return {
        sistema: SISTEMA_NOTA_CLINICA,
        prompt: promptNotaClinica(contexto, limpiar(entrada.texto) ?? ''),
        contexto,
        alimentos: [],
        jsonSchema: NOTA_CLINICA_JSON_SCHEMA,
        validar: validadorDe(notaClinicaBorradorSchema, () => ({ ok: true })),
      };
    case 'RECETA':
      return {
        sistema: SISTEMA_RECETA,
        prompt: promptReceta(contexto, limpiar(entrada.idea), entrada.calorias_objetivo ?? null),
        contexto,
        alimentos: [],
        jsonSchema: RECETA_JSON_SCHEMA,
        validar: validadorDe(recetaBorradorSchema, (receta) => validarReceta(receta, contexto)),
      };
    case 'RESPUESTA_MENSAJE':
      return {
        sistema: SISTEMA_RESPUESTA_MENSAJE,
        prompt: promptRespuestaMensaje(
          contexto,
          limpiar(entrada.mensaje) ?? '',
          limpiar(entrada.intencion),
        ),
        contexto,
        alimentos: [],
        jsonSchema: null,
        validar: null,
      };
    case 'PLAN_ACTIVIDAD':
      return {
        sistema: SISTEMA_PLAN_ACTIVIDAD,
        prompt: promptPlanActividad(contexto, limpiar(entrada.notas)),
        contexto,
        alimentos: [],
        jsonSchema: null,
        validar: null,
      };
  }
}

/** Reintento: se le devuelve al modelo su salida y el motivo del rechazo. */
function promptDeCorreccion(prompt: string, salida: string, motivos: string[]): string {
  return [
    prompt,
    '',
    'INTENTO ANTERIOR RECHAZADO. Esto respondiste:',
    salida,
    '',
    'Motivos del rechazo:',
    ...motivos.map((motivo) => `- ${motivo}`),
    '',
    'Corrige exactamente esos puntos y vuelve a responder con el mismo formato.',
  ].join('\n');
}

async function llamar(
  opciones: Parameters<typeof generar>[0],
  alProgreso: ((evento: EventoProgreso) => void) | undefined,
  conStream: boolean,
  estructurado: boolean,
): Promise<ResultadoTexto> {
  if (!conStream || !alProgreso) return generar(opciones);

  let acumulados = 0;
  return generarConStream(opciones, (fragmento) => {
    if (estructurado) {
      // El JSON a medio construir no se le enseña a nadie; solo se reporta el
      // avance para que la UI pueda mover un indicador.
      acumulados += fragmento.length;
      alProgreso({ tipo: 'progreso', caracteres: acumulados });
    } else {
      alProgreso({ tipo: 'delta', texto: fragmento });
    }
  });
}

/**
 * Ejecuta una generación completa.
 *
 * `alProgreso` es opcional: cuando el cliente pidió SSE, la ruta lo usa para
 * empujar eventos; sin él, el flujo es idéntico pero sin reportes intermedios.
 */
export async function generarContenido(
  userId: string,
  entrada: GenerarInput,
  alProgreso?: (evento: EventoProgreso) => void,
): Promise<SalidaGeneracion> {
  const { permitida, cuota } = await reservarGeneracion(userId);
  if (!permitida) throw new CuotaAgotadaError(cuota);

  try {
    const preparado = await preparar(userId, entrada);
    const config = CONFIGURACION[entrada.tipo];
    const opcionesBase = {
      modelo: config.modelo,
      maxTokens: config.maxTokens,
      sistema: preparado.sistema,
      ...(preparado.jsonSchema ? { jsonSchema: preparado.jsonSchema } : {}),
      ...(config.effort ? { effort: config.effort } : {}),
    };

    let prompt = preparado.prompt;
    let ultimo: ResultadoTexto | null = null;
    let motivos: string[] = [];

    for (let intento = 0; intento <= REINTENTOS_VALIDACION; intento += 1) {
      const respuesta = await llamar(
        { ...opcionesBase, prompt },
        alProgreso,
        entrada.stream,
        config.estructurado,
      );
      await registrarTokens(userId, respuesta.uso);
      ultimo = respuesta;

      if (!preparado.validar) {
        return salidaTexto(entrada.tipo, respuesta.texto, [], cuota);
      }

      let crudo: unknown;
      try {
        crudo = extraerJSON(respuesta.texto);
      } catch {
        motivos = ['La respuesta no fue JSON válido.'];
        prompt = promptDeCorreccion(preparado.prompt, respuesta.texto, motivos);
        alProgreso?.({ tipo: 'reintento', motivos });
        continue;
      }

      const validacion = preparado.validar(crudo);
      if (validacion.ok) {
        const datos = validacion.datos ?? crudo;
        return {
          tipo: entrada.tipo,
          formato: 'estructurado',
          datos: preparado.enriquecer ? preparado.enriquecer(datos) : datos,
          texto: null,
          advertencias: [],
          cuota,
        };
      }

      motivos = validacion.motivos;
      prompt = promptDeCorreccion(preparado.prompt, respuesta.texto, motivos);
      alProgreso?.({ tipo: 'reintento', motivos });
    }

    // Agotados los reintentos, se entrega el último texto para que el
    // nutriólogo lo edite: perder el trabajo sería peor que entregarlo crudo.
    return salidaTexto(entrada.tipo, ultimo?.texto ?? '', motivos, cuota);
  } catch (error: unknown) {
    // Nada se generó: la reserva se reembolsa.
    await devolverGeneracion(userId);
    throw error;
  }
}

function salidaTexto(
  tipo: TipoGeneracion,
  texto: string,
  advertencias: string[],
  cuota: CuotaIA,
): SalidaGeneracion {
  return { tipo, formato: 'texto', datos: null, texto: texto.trim(), advertencias, cuota };
}
