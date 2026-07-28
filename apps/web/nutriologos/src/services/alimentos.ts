import type { AlimentoFicha, GrupoAlimento } from '@nutria/shared';

import { ApiError, type ErrorApi } from '@/services/pacientes';

/**
 * Cliente de `/api/v1/foods`.
 *
 * La respuesta del servidor ya viene con la forma de `AlimentoFicha`, así que
 * aquí no hay traducción de dominio: solo el transporte y la paginación.
 * Ningún componente llama a `fetch` directamente (ver `rules/code-style.md`).
 */

export type ListaAlimentos = {
  data: AlimentoFicha[];
  meta: { page: number; per_page: number; total: number };
};

export type GrupoConTotal = {
  grupo: GrupoAlimento;
  nombre: string;
  total: number;
};

export type FiltrosAlimentos = {
  query?: string;
  grupo?: GrupoAlimento;
  soloPropios?: boolean;
  page?: number;
  perPage?: number;
};

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (respuesta.status === 204) return undefined as T;

  const cuerpo = (await respuesta.json().catch(() => null)) as { error?: ErrorApi } | T | null;

  if (!respuesta.ok) {
    const error = (cuerpo as { error?: ErrorApi } | null)?.error;
    throw new ApiError(
      error ?? { code: 'NETWORK_ERROR', message: 'No pudimos contactar al servidor.' },
    );
  }

  return cuerpo as T;
}

export function listarAlimentos(filtros: FiltrosAlimentos): Promise<ListaAlimentos> {
  const parametros = new URLSearchParams();

  if (filtros.query) parametros.set('query', filtros.query);
  if (filtros.grupo) parametros.set('grupo', filtros.grupo);
  if (filtros.soloPropios) parametros.set('solo_propios', 'true');
  if (filtros.page) parametros.set('page', String(filtros.page));
  if (filtros.perPage) parametros.set('per_page', String(filtros.perPage));

  return pedir<ListaAlimentos>(`/api/v1/foods?${parametros.toString()}`);
}

export function listarGruposAlimento(): Promise<{ data: GrupoConTotal[] }> {
  return pedir<{ data: GrupoConTotal[] }>('/api/v1/foods/groups');
}

/** Alta de un alimento propio. Los campos van tal cual los pide la API. */
export type AlimentoPropioPayload = Omit<AlimentoFicha, 'id' | 'es_propio' | 'fuente'> & {
  equivalentes?: AlimentoFicha['equivalentes'];
};

export function crearAlimento(payload: AlimentoPropioPayload): Promise<AlimentoFicha> {
  return pedir<AlimentoFicha>('/api/v1/foods', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarAlimento(
  id: string,
  payload: Partial<AlimentoPropioPayload>,
): Promise<AlimentoFicha> {
  return pedir<AlimentoFicha>(`/api/v1/foods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function archivarAlimento(id: string): Promise<void> {
  return pedir<void>(`/api/v1/foods/${id}`, { method: 'DELETE' });
}
