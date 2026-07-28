import Anthropic from '@anthropic-ai/sdk';

/**
 * Único punto de contacto con la API de Anthropic.
 *
 * La llave vive solo aquí (`ANTHROPIC_API_KEY`, nunca `NEXT_PUBLIC_*`) y los
 * prompts **jamás se loggean**: llevan datos de salud, aunque estén
 * seudonimizados (regla 1 de `CLAUDE.md`).
 */

export class IaNoConfiguradaError extends Error {
  constructor() {
    super('IA_NO_CONFIGURADA');
    this.name = 'IaNoConfiguradaError';
  }
}

export class IaUpstreamError extends Error {
  constructor(readonly status?: number) {
    super('IA_UPSTREAM');
    this.name = 'IaUpstreamError';
  }
}

/** Uso de tokens de una llamada, lo único que sí se persiste. */
export type UsoTokens = { entrada: number; salida: number };

export type ResultadoTexto = { texto: string; uso: UsoTokens };

export type EsquemaJson = Record<string, unknown>;

export type OpcionesGeneracion = {
  modelo: string;
  maxTokens: number;
  sistema: string;
  prompt: string;
  /** Cuando se pasa, la API restringe la respuesta a ese schema. */
  jsonSchema?: EsquemaJson;
  effort?: 'low' | 'medium' | 'high';
};

let clienteMemo: Anthropic | null = null;

function cliente(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new IaNoConfiguradaError();
  // El cliente se memoiza para reutilizar el pool de conexiones entre
  // invocaciones que comparten instancia serverless.
  if (!clienteMemo) {
    clienteMemo = new Anthropic({
      apiKey,
      // El SDK ya reintenta 429/5xx con backoff exponencial; no se replica.
      maxRetries: 2,
      timeout: 120_000,
    });
  }
  return clienteMemo;
}

/** Solo para tests: descarta el cliente memoizado. */
export function reiniciarClienteIa(): void {
  clienteMemo = null;
}

function cuerpo(opciones: OpcionesGeneracion): Anthropic.MessageCreateParamsNonStreaming {
  const outputConfig: Anthropic.OutputConfig = {
    ...(opciones.effort ? { effort: opciones.effort } : {}),
    ...(opciones.jsonSchema
      ? { format: { type: 'json_schema', schema: opciones.jsonSchema } }
      : {}),
  };

  return {
    model: opciones.modelo,
    max_tokens: opciones.maxTokens,
    system: opciones.sistema,
    messages: [{ role: 'user', content: opciones.prompt }],
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
  };
}

function textoDe(bloques: Array<{ type: string; text?: string }>): string {
  return bloques
    .filter((bloque) => bloque.type === 'text')
    .map((bloque) => bloque.text ?? '')
    .join('');
}

function comoErrorDeIa(error: unknown): never {
  if (error instanceof IaNoConfiguradaError) throw error;
  if (error instanceof Anthropic.APIError) throw new IaUpstreamError(error.status);
  throw new IaUpstreamError();
}

/**
 * Generación sin streaming. Se usa en las tareas cortas y como camino de
 * respaldo cuando el cliente no pidió SSE.
 */
export async function generar(opciones: OpcionesGeneracion): Promise<ResultadoTexto> {
  try {
    const respuesta = await cliente().messages.create(cuerpo(opciones));
    if (respuesta.stop_reason === 'refusal') {
      // El modelo declinó: no hay contenido útil y reintentar el mismo prompt
      // no cambiaría nada.
      throw new IaUpstreamError(200);
    }
    return {
      texto: textoDe(respuesta.content),
      uso: {
        entrada: respuesta.usage.input_tokens,
        salida: respuesta.usage.output_tokens,
      },
    };
  } catch (error: unknown) {
    return comoErrorDeIa(error);
  }
}

/**
 * Generación con streaming. `alRecibir` se invoca con cada fragmento de texto;
 * al terminar devuelve el texto completo y el consumo de tokens.
 */
export async function generarConStream(
  opciones: OpcionesGeneracion,
  alRecibir: (fragmento: string) => void,
): Promise<ResultadoTexto> {
  try {
    const stream = cliente().messages.stream(cuerpo(opciones));
    stream.on('text', alRecibir);
    const mensaje = await stream.finalMessage();
    if (mensaje.stop_reason === 'refusal') throw new IaUpstreamError(200);
    return {
      texto: textoDe(mensaje.content),
      uso: { entrada: mensaje.usage.input_tokens, salida: mensaje.usage.output_tokens },
    };
  } catch (error: unknown) {
    return comoErrorDeIa(error);
  }
}

/** `true` si el servidor tiene con qué llamar al proveedor. */
export function iaConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
