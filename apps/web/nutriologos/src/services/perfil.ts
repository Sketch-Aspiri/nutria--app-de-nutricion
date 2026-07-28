import { ApiError, type ErrorApi } from '@/services/pacientes';

export type PerfilApi = {
  id: string;
  email: string;
  nombre: string | null;
  role: 'END_USER' | 'NUTRITIONIST' | 'ADMIN';
  email_verificado: boolean;
  perfil: {
    nombre_completo: string;
    cedula_profesional: string | null;
    telefono: string | null;
    especialidad: string | null;
    marca_nombre: string | null;
    marca_color: string;
    marca_logo_url: string | null;
  } | null;
  suscripcion: {
    plan: 'FREE' | 'PRO' | 'CLINICA';
    status: string;
    current_period_end: string | null;
  } | null;
};

export type ActualizarPerfilPayload = {
  nombre_completo?: string;
  cedula_profesional?: string | null;
  telefono?: string | null;
  especialidad?: string | null;
  marca_nombre?: string | null;
  marca_color?: string;
  marca_logo_url?: string | null;
};

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as { error?: ErrorApi } | T | null;

  if (!respuesta.ok) {
    const error = (cuerpo as { error?: ErrorApi } | null)?.error;
    throw new ApiError(
      error ?? { code: 'NETWORK_ERROR', message: 'No pudimos contactar al servidor.' },
    );
  }

  return cuerpo as T;
}

export function obtenerPerfil(): Promise<PerfilApi> {
  return pedir<PerfilApi>('/api/v1/me');
}

export function actualizarPerfil(payload: ActualizarPerfilPayload): Promise<PerfilApi> {
  return pedir<PerfilApi>('/api/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
