/**
 * Cliente HTTP compartido por los servicios de `/api/v1`.
 *
 * Traduce el sobre de error del contrato (`{ error: { code, message } }`) a una
 * excepción tipada, para que los componentes puedan distinguir un
 * `APPOINTMENT_CONFLICT` de un fallo de red sin leer el cuerpo a mano.
 *
 * `pacientes.ts`, `planes.ts`, `alimentos.ts` y `perfil.ts` todavía llevan su
 * propia copia de este helper; se unifican cuando toque tocarlos, para no
 * mezclar ese barrido con la fase en curso.
 */

export type ErrorApi = {
  code: string;
  message: string;
  details?: Record<string, string[]>;
};

export class ApiError extends Error {
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(error: ErrorApi) {
    super(error.message);
    this.name = 'ApiError';
    this.code = error.code;
    this.details = error.details;
  }
}

export async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (respuesta.status === 204) return undefined as T;

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { error?: ErrorApi }
    | T
    | null;

  if (!respuesta.ok) {
    const error = (cuerpo as { error?: ErrorApi } | null)?.error;
    throw new ApiError(
      error ?? { code: 'NETWORK_ERROR', message: 'No pudimos contactar al servidor.' },
    );
  }

  return cuerpo as T;
}
