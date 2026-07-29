import type { ZodType } from 'zod';

import { type CuotaIA, type CuotaPaciente, extraerJSON, tieneConflictoAlergia } from '@nutria/shared';

import { type EsquemaJson, generar } from './cliente';
import {
  AVISO_IA_PACIENTE,
  CONFIGURACION_PACIENTE,
  type TipoGeneracionPaciente,
} from './config';
import {
  type ContextoCoach,
  cargarContextoCoach,
  limpiarTextoDelPaciente,
  recetaEnviadaDelPaciente,
} from './contextoPaciente';
import {
  SISTEMA_COACH,
  SISTEMA_ESTIMACION_COMIDA,
  SISTEMA_SUSTITUCION,
  promptCoach,
  promptEstimacionComida,
  promptSustitucion,
} from './promptsPaciente';
import {
  type CoachInput,
  ESTIMACION_COMIDA_JSON_SCHEMA,
  type EstimacionComidaBorrador,
  type EstimacionComidaInput,
  SUSTITUCION_JSON_SCHEMA,
  type SustitucionBorrador,
  type SustitucionInput,
  estimacionComidaBorradorSchema,
  sustitucionBorradorSchema,
} from './schemasPaciente';
import { registrarTokens } from './uso';
import {
  devolverInteraccionCompleta,
  nutriologoDelPaciente,
  reservarInteraccion,
} from './usoPaciente';

/**
 * Los tres casos de uso de IA del paciente (§8 del plan).
 *
 * El flujo es el mismo en los tres: cargar contexto seudonimizado → reservar la
 * doble cuota → armar el prompt en el servidor → llamar → validar → devolver.
 *
 * Dos garantías estructurales, no solo de prompt:
 *
 * - **Ninguna de estas funciones escribe.** No tocan `meal_plans`, ni
 *   `meal_logs`, ni el expediente. La estimación se *devuelve* y es la app quien
 *   la registra con `POST /me/meal_logs` y `origen = IA`; así, aunque el modelo
 *   alucine, nada queda guardado sin que el paciente lo confirme.
 * - **El `patientId` viene de la sesión.** Lo resuelve `requierePaciente` y se
 *   pasa aquí; ninguna entrada de §8 acepta un identificador de paciente.
 */

export class PacienteSinExpedienteError extends Error {
  constructor() {
    super('PACIENTE_SIN_EXPEDIENTE');
    this.name = 'PacienteSinExpedienteError';
  }
}

export class CuotaPacienteAgotadaError extends Error {
  constructor(readonly cuota: CuotaPaciente) {
    super('CUOTA_IA_PACIENTE_AGOTADA');
    this.name = 'CuotaPacienteAgotadaError';
  }
}

export class CuotaClinicaAgotadaError extends Error {
  constructor(readonly cuota: CuotaIA) {
    super('CUOTA_IA_CLINICA_AGOTADA');
    this.name = 'CuotaClinicaAgotadaError';
  }
}

export class RecetaNoEncontradaError extends Error {
  constructor() {
    super('RECETA_NO_ENCONTRADA');
    this.name = 'RecetaNoEncontradaError';
  }
}

/**
 * La salida del modelo no sirvió. A diferencia del panel —donde un borrador malo
 * se degrada a texto para que el nutriólogo lo edite— aquí no hay a quién
 * entregarle una salida cruda: el paciente no puede juzgarla, así que se
 * rechaza y se le pide reintentar.
 */
export class SalidaIaInvalidaError extends Error {
  constructor(readonly motivo: string) {
    super('SALIDA_IA_INVALIDA');
    this.name = 'SalidaIaInvalidaError';
  }
}

type SalidaBase = {
  aviso: string;
  /** Solo el tope del paciente: la cuota de la clínica no se le muestra. */
  cuota: CuotaPaciente;
};

export type SalidaCoach = SalidaBase & {
  tipo: 'COACH_PACIENTE';
  formato: 'texto';
  texto: string;
};

export type SalidaEstimacionComida = SalidaBase & {
  tipo: 'ESTIMACION_COMIDA';
  formato: 'estructurado';
  datos: EstimacionComidaBorrador;
};

export type SalidaSustitucion = SalidaBase & {
  tipo: 'SUSTITUCION_INGREDIENTE';
  formato: 'estructurado';
  datos: SustitucionBorrador;
};

type Preparado = {
  sistema: string;
  prompt: string;
  jsonSchema: EsquemaJson | null;
};

/** Contexto y cuenta de cobro, resueltos una sola vez por petición. */
async function abrir(patientId: string): Promise<{
  contexto: ContextoCoach;
  nutritionistId: string;
}> {
  const [contexto, nutritionistId] = await Promise.all([
    cargarContextoCoach(patientId),
    nutriologoDelPaciente(patientId),
  ]);
  // Un expediente borrado entre la sesión y esta consulta cae aquí. La guarda ya
  // lo verificó; esto es la carrera, no el control de acceso.
  if (!contexto || !nutritionistId) throw new PacienteSinExpedienteError();
  return { contexto, nutritionistId };
}

/**
 * Reserva, llama al modelo y contabiliza. Devuelve el texto crudo: cada caso de
 * uso decide qué hacer con él.
 */
async function ejecutar(
  userId: string,
  nutritionistId: string,
  tipo: TipoGeneracionPaciente,
  preparado: Preparado,
): Promise<{ texto: string; cuota: CuotaPaciente }> {
  const reserva = await reservarInteraccion(userId, nutritionistId);
  if (!reserva.ok) {
    if (reserva.motivo === 'paciente') throw new CuotaPacienteAgotadaError(reserva.cuota);
    throw new CuotaClinicaAgotadaError(reserva.cuota);
  }

  const config = CONFIGURACION_PACIENTE[tipo];
  try {
    const respuesta = await generar({
      modelo: config.modelo,
      maxTokens: config.maxTokens,
      sistema: preparado.sistema,
      prompt: preparado.prompt,
      ...(preparado.jsonSchema ? { jsonSchema: preparado.jsonSchema } : {}),
    });
    // Los tokens se anotan aunque después falle la validación: se gastaron de
    // verdad. Lo que se reembolsa es la generación, no el consumo real.
    await registrarTokens(nutritionistId, respuesta.uso);
    return { texto: respuesta.texto, cuota: reserva.cuotas.paciente };
  } catch (error: unknown) {
    // Nada se produjo: las dos reservas se deshacen.
    await devolverInteraccionCompleta(userId, nutritionistId);
    throw error;
  }
}

/** Parseo y validación de forma de una salida estructurada. */
function estructurada<T>(texto: string, schema: ZodType<T>): T {
  let crudo: unknown;
  try {
    crudo = extraerJSON(texto);
  } catch {
    throw new SalidaIaInvalidaError('La respuesta no vino en el formato esperado.');
  }

  const parseado = schema.safeParse(crudo);
  if (!parseado.success) {
    throw new SalidaIaInvalidaError('La respuesta no vino en el formato esperado.');
  }
  return parseado.data;
}

/* --- Coach ---------------------------------------------------------------- */

export async function responderCoach(
  patientId: string,
  userId: string,
  entrada: CoachInput,
): Promise<SalidaCoach> {
  const { contexto, nutritionistId } = await abrir(patientId);

  // El texto del paciente pasa por el filtro igual que el del nutriólogo: casi
  // siempre se nombra a sí mismo o a un familiar.
  const mensaje = limpiarTextoDelPaciente(entrada.mensaje, contexto);
  const historial = (entrada.historial ?? []).map((turno) => ({
    rol: turno.rol,
    texto: limpiarTextoDelPaciente(turno.texto, contexto),
  }));

  const { texto, cuota } = await ejecutar(userId, nutritionistId, 'COACH_PACIENTE', {
    sistema: SISTEMA_COACH,
    prompt: promptCoach(contexto, mensaje, historial),
    jsonSchema: null,
  });

  const limpio = texto.trim();
  if (!limpio) throw new SalidaIaInvalidaError('El asistente no devolvió respuesta.');

  return {
    tipo: 'COACH_PACIENTE',
    formato: 'texto',
    texto: limpio,
    aviso: AVISO_IA_PACIENTE,
    cuota,
  };
}

/* --- Estimación de comida -------------------------------------------------- */

export async function estimarComida(
  patientId: string,
  userId: string,
  entrada: EstimacionComidaInput,
): Promise<SalidaEstimacionComida> {
  const { contexto, nutritionistId } = await abrir(patientId);
  const descripcion = limpiarTextoDelPaciente(entrada.texto, contexto);

  const { texto, cuota } = await ejecutar(userId, nutritionistId, 'ESTIMACION_COMIDA', {
    sistema: SISTEMA_ESTIMACION_COMIDA,
    prompt: promptEstimacionComida(contexto, descripcion),
    jsonSchema: ESTIMACION_COMIDA_JSON_SCHEMA,
  });

  return {
    tipo: 'ESTIMACION_COMIDA',
    formato: 'estructurado',
    datos: estructurada(texto, estimacionComidaBorradorSchema),
    aviso: AVISO_IA_PACIENTE,
    cuota,
  };
}

/* --- Sustitución de ingrediente -------------------------------------------- */

export async function sustituirIngrediente(
  patientId: string,
  userId: string,
  entrada: SustitucionInput,
): Promise<SalidaSustitucion> {
  const { contexto, nutritionistId } = await abrir(patientId);

  const receta = entrada.receta_id
    ? await recetaEnviadaDelPaciente(patientId, entrada.receta_id)
    : null;
  if (entrada.receta_id && !receta) throw new RecetaNoEncontradaError();

  const ingrediente = limpiarTextoDelPaciente(entrada.ingrediente, contexto);

  const { texto, cuota } = await ejecutar(userId, nutritionistId, 'SUSTITUCION_INGREDIENTE', {
    sistema: SISTEMA_SUSTITUCION,
    prompt: promptSustitucion(contexto, ingrediente, receta),
    jsonSchema: SUSTITUCION_JSON_SCHEMA,
  });

  const datos = estructurada(texto, sustitucionBorradorSchema);

  // Guarda de alergias en la salida, no solo en el prompt: aquí el que va a
  // comerse la sustitución es el paciente y no hay profesional revisando en
  // medio. Se rechaza sin reintentar — un segundo intento sobre el mismo
  // ingrediente suele reincidir y la respuesta segura es derivar.
  if (tieneConflictoAlergia(`${datos.sustituto} ${datos.razon}`, contexto.alergias)) {
    throw new SalidaIaInvalidaError(
      'No encontré un sustituto que respete tus alergias. Pregúntale a tu nutrióloga.',
    );
  }

  return {
    tipo: 'SUSTITUCION_INGREDIENTE',
    formato: 'estructurado',
    datos,
    aviso: AVISO_IA_PACIENTE,
    cuota,
  };
}
