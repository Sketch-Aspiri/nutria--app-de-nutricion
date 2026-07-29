import type {
  EstimacionComida,
  RegistroComidaHoy,
  RespuestaCoach,
  RespuestaEstimacion,
  ResumenHoy,
  TurnoCoach,
} from './types';

type ErrorApi = {
  code: string;
  message: string;
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

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, init);
  } catch {
    throw new ApiPacienteError(
      {
        code: 'NETWORK_ERROR',
        message: 'No pudimos completar la solicitud. Revisa tu conexión e intenta de nuevo.',
      },
      0,
    );
  }
  if (respuesta.status === 204) return undefined as T;

  const cuerpo = (await respuesta.json().catch(() => null)) as T | { error?: ErrorApi } | null;

  if (!respuesta.ok) {
    const error = (cuerpo as { error?: ErrorApi } | null)?.error;
    throw new ApiPacienteError(
      error ?? {
        code: 'NETWORK_ERROR',
        message: 'No pudimos completar la solicitud. Revisa tu conexión e intenta de nuevo.',
      },
      respuesta.status,
    );
  }

  return cuerpo as T;
}

function json<T>(url: string, method: string, body: unknown): Promise<T> {
  return pedir<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function obtenerHoy(): Promise<ResumenHoy> {
  return pedir<ResumenHoy>('/api/v1/me/today');
}

export type RegistrarComidaPayload = {
  meal_plan_meal_id?: string;
  nombre: string;
  calorias?: number;
  proteina_g?: number;
  carbos_g?: number;
  grasa_g?: number;
  foto_url?: string;
  comentario_paciente?: string;
  origen: 'MANUAL' | 'IA';
};

export function registrarComida(payload: RegistrarComidaPayload): Promise<RegistroComidaHoy> {
  return json<RegistroComidaHoy>('/api/v1/me/meal_logs', 'POST', payload);
}

export function borrarRegistroComida(id: string): Promise<void> {
  return pedir<void>(`/api/v1/me/meal_logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function guardarAgua(fecha: string, vasos: number): Promise<{ vasos: number }> {
  return json<{ vasos: number }>('/api/v1/me/water_logs', 'PUT', { fecha, vasos });
}

export function estimarComida(texto: string): Promise<RespuestaEstimacion> {
  return json<RespuestaEstimacion>('/api/v1/me/ai/meal_estimate', 'POST', { texto });
}

export async function subirFoto(archivo: File): Promise<string> {
  const form = new FormData();
  form.append('foto', archivo);
  const respuesta = await pedir<{ foto_url: string }>('/api/v1/me/photos', {
    method: 'POST',
    body: form,
  });
  return respuesta.foto_url;
}

export async function registrarFoto(
  archivo: File,
  descripcion: string,
): Promise<RegistroComidaHoy> {
  const fotoUrl = await subirFoto(archivo);
  return registrarComida({
    nombre: descripcion,
    foto_url: fotoUrl,
    comentario_paciente: descripcion,
    origen: 'MANUAL',
  });
}

export function registrarPeso(fecha: string, pesoKg: number): Promise<unknown> {
  return json('/api/v1/me/weight_logs', 'POST', { fecha, peso_kg: pesoKg });
}

export function registrarEjercicio(
  fecha: string,
  tipo: string,
  duracionMin: number,
): Promise<unknown> {
  return json('/api/v1/me/exercise_logs', 'POST', {
    fecha,
    tipo,
    duracion_min: duracionMin,
  });
}

export function preguntarCoach(mensaje: string, historial: TurnoCoach[]): Promise<RespuestaCoach> {
  return json<RespuestaCoach>('/api/v1/me/ai/coach', 'POST', { mensaje, historial });
}

export function payloadDeEstimacion(estimacion: EstimacionComida): RegistrarComidaPayload {
  return {
    nombre: estimacion.alimento,
    calorias: estimacion.calorias,
    proteina_g: estimacion.proteina_g,
    carbos_g: estimacion.carbos_g,
    grasa_g: estimacion.grasa_g,
    origen: 'IA',
  };
}
