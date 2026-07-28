import type { CuotaIA } from '@nutria/shared';

import type { AlimentoResumenPlan } from '@/services/planes';

/**
 * Cliente de `/api/v1/ai`. La UI manda intención (tipo + datos), nunca el
 * prompt: armarlo es responsabilidad del servidor, que es quien seudonimiza.
 */

export type ErrorApi = { code: string; message: string };

export class ErrorIA extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorIA';
  }

  /** La UI muestra un CTA de mejora de plan en vez de un error genérico. */
  get esLimiteAlcanzado(): boolean {
    return this.codigo === 'AI_LIMIT_REACHED';
  }
}

export type TipoGeneracion =
  | 'PLAN'
  | 'NOTA_CLINICA'
  | 'RECETA'
  | 'RESPUESTA_MENSAJE'
  | 'PLAN_ACTIVIDAD';

export type PeticionIA =
  | { tipo: 'PLAN'; patient_id: string; notas?: string }
  | { tipo: 'NOTA_CLINICA'; patient_id: string; texto: string }
  | { tipo: 'RECETA'; patient_id: string; idea?: string; calorias_objetivo?: number }
  | { tipo: 'RESPUESTA_MENSAJE'; patient_id: string; mensaje: string; intencion?: string }
  | { tipo: 'PLAN_ACTIVIDAD'; patient_id: string; notas?: string };

export type SalidaIA<T = unknown> = {
  tipo: TipoGeneracion;
  formato: 'estructurado' | 'texto';
  datos: T | null;
  texto: string | null;
  /** Por qué se degradó a texto editable, si se degradó. */
  advertencias: string[];
  cuota: CuotaIA;
};

export type CuotaIAConEstado = CuotaIA & { configurada: boolean };

/**
 * Borrador de plan que devuelve el servidor con `tipo: 'PLAN'`.
 *
 * Ya viene resuelto contra el catálogo de alimentos y con los nutrimentos
 * calculados por el servidor, así que el editor lo consume tal cual.
 */
export type ItemBorradorIa = {
  food_id: string | null;
  descripcion_libre: string | null;
  cantidad_porciones: number;
  energia_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  lipidos_g: number;
  food: AlimentoResumenPlan | null;
};

export type ComidaBorradorIa = {
  orden: number;
  nombre: string;
  horario: string | null;
  descripcion: string | null;
  items: ItemBorradorIa[];
};

export type PlanBorradorIa = {
  calorias_diarias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  nota: string;
  comidas: ComidaBorradorIa[];
  /** Totales recalculados por el servidor desde los alimentos reales. */
  totales: {
    energia_kcal: number;
    proteina_g: number;
    carbohidratos_g: number;
    lipidos_g: number;
  };
};

/** Nota clínica estructurada que devuelve `tipo: 'NOTA_CLINICA'`. */
export type NotaClinicaIa = {
  motivo: string;
  hallazgos: string;
  plan: string;
  seguimiento: string;
};

/** Receta que devuelve `tipo: 'RECETA'`. */
export type RecetaIa = {
  nombre: string;
  ingredientes: string[];
  pasos: string;
  calorias: number;
  porciones: number;
};

const RUTA = '/api/v1/ai/generate';
const ERROR_GENERICO = 'No se pudo completar la generación. Intenta de nuevo.';

function comoError(cuerpo: unknown, respaldo: string): ErrorIA {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo) {
    const { code, message } = (cuerpo as { error: Partial<ErrorApi> }).error ?? {};
    return new ErrorIA(code ?? 'AI_UPSTREAM_ERROR', message ?? respaldo);
  }
  return new ErrorIA('AI_UPSTREAM_ERROR', respaldo);
}

/** Generación sin streaming: se resuelve con el resultado final ya validado. */
export async function generarIA<T = unknown>(peticion: PeticionIA): Promise<SalidaIA<T>> {
  const respuesta = await fetch(RUTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(peticion),
  });
  const cuerpo: unknown = await respuesta.json();
  if (!respuesta.ok) throw comoError(cuerpo, ERROR_GENERICO);
  return cuerpo as SalidaIA<T>;
}

export type EventoIA =
  | { tipo: 'delta'; texto: string }
  | { tipo: 'progreso'; caracteres: number }
  | { tipo: 'reintento'; motivos: string[] };

/**
 * Generación con SSE. `alEvento` recibe el avance; la promesa se resuelve con
 * el mismo objeto que devolvería `generarIA`.
 *
 * Se usa `fetch` con lector manual en vez de `EventSource` porque el endpoint
 * es POST con cuerpo, y `EventSource` solo sabe hacer GET.
 */
export async function generarIAConStream<T = unknown>(
  peticion: PeticionIA,
  alEvento: (evento: EventoIA) => void,
  senal?: AbortSignal,
): Promise<SalidaIA<T>> {
  const respuesta = await fetch(RUTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...peticion, stream: true }),
    signal: senal,
  });

  // Los errores previos al stream (sesión, validación, cuota) llegan como JSON.
  if (!respuesta.ok) throw comoError(await respuesta.json(), ERROR_GENERICO);
  if (!respuesta.body) throw new ErrorIA('AI_UPSTREAM_ERROR', ERROR_GENERICO);

  const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
  let pendiente = '';
  let final: SalidaIA<T> | null = null;
  let fallo: ErrorIA | null = null;

  const procesarBloque = (bloque: string) => {
    let evento = 'message';
    const datos: string[] = [];
    for (const linea of bloque.split('\n')) {
      if (linea.startsWith('event:')) evento = linea.slice(6).trim();
      else if (linea.startsWith('data:')) datos.push(linea.slice(5).trim());
    }
    if (datos.length === 0) return;

    const carga: unknown = JSON.parse(datos.join('\n'));
    if (evento === 'final') final = carga as SalidaIA<T>;
    else if (evento === 'error') fallo = comoError({ error: carga }, ERROR_GENERICO);
    else alEvento(carga as EventoIA);
  };

  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    pendiente += value;
    // Los eventos SSE se separan por línea en blanco; el último trozo puede
    // llegar partido y se conserva para la siguiente lectura.
    const bloques = pendiente.split('\n\n');
    pendiente = bloques.pop() ?? '';
    for (const bloque of bloques) {
      if (bloque.trim()) procesarBloque(bloque);
    }
  }
  if (pendiente.trim()) procesarBloque(pendiente);

  if (fallo) throw fallo;
  if (!final) throw new ErrorIA('AI_UPSTREAM_ERROR', 'La generación terminó sin resultado.');
  return final;
}

export async function obtenerCuotaIA(): Promise<CuotaIAConEstado> {
  const respuesta = await fetch('/api/v1/ai/usage');
  const cuerpo: unknown = await respuesta.json();
  if (!respuesta.ok) throw comoError(cuerpo, 'No se pudo consultar tu cuota de IA.');
  return cuerpo as CuotaIAConEstado;
}
