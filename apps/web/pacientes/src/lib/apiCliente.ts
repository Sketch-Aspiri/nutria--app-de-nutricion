/**
 * Cliente HTTP de la app del paciente.
 *
 * Vivía dentro de `features/hoy/api.ts` cuando Hoy era la única pantalla que
 * hablaba con la API. La fase 8 agrega Plan y recetas, y copiar el envoltorio
 * habría duplicado justo lo que no conviene duplicar: el mensaje seguro cuando
 * `fetch` falla, y la regla de no filtrar el error nativo del navegador.
 */

type ErrorApi = {
  code: string;
  message: string;
};

const ERROR_DE_RED: ErrorApi = {
  code: 'NETWORK_ERROR',
  message: 'No pudimos completar la solicitud. Revisa tu conexión e intenta de nuevo.',
};

export class ApiPacienteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(error: ErrorApi, status: number) {
    super(error.message);
    this.name = 'ApiPacienteError';
    this.code = error.code;
    this.status = status;
  }
}

export async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, init);
  } catch {
    throw new ApiPacienteError(ERROR_DE_RED, 0);
  }
  if (respuesta.status === 204) return undefined as T;

  const cuerpo = (await respuesta.json().catch(() => null)) as T | { error?: ErrorApi } | null;

  if (!respuesta.ok) {
    const error = (cuerpo as { error?: ErrorApi } | null)?.error;
    throw new ApiPacienteError(error ?? ERROR_DE_RED, respuesta.status);
  }

  return cuerpo as T;
}

export function json<T>(url: string, method: string, body: unknown): Promise<T> {
  return pedir<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Envoltorio de `GET`s que devuelven `{ data, meta }` según `api-conventions.md`. */
export async function pedirLista<T>(url: string): Promise<T[]> {
  const respuesta = await pedir<{ data: T[] }>(url);
  return Array.isArray(respuesta?.data) ? respuesta.data : [];
}
