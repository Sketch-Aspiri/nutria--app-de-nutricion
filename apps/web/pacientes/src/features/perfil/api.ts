import { json, pedir } from '@/lib/apiCliente';

/**
 * Perfil, cuenta y derechos ARCO del paciente.
 *
 * La fase 10 creó este módulo con la sola lectura que el encabezado del hilo
 * necesitaba. La 11 lo completa: el resto del perfil, el cambio de contraseña y
 * los derechos de acceso y cancelación.
 *
 * Ninguna función manda identificadores. El `patientId` y el `userId` salen de
 * la sesión en el servidor; si viajaran en el cuerpo, existiría un campo que
 * manipular para leer —o borrar— la cuenta de alguien más.
 */

export type Objetivo =
  | 'PERDIDA_DE_GRASA'
  | 'GANANCIA_MUSCULAR'
  | 'MANTENIMIENTO'
  | 'CONTROL_DE_DIABETES'
  | 'MEJORA_DEPORTIVA'
  | 'OTRO';

/** Metas del plan vigente. `null` mientras no haya plan compartido (§5.4). */
export type MetasDelPlan = {
  calorias_diarias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
};

export type PerfilPaciente = {
  id: string;
  nombre: string;
  email: string | null;
  foto_url: string | null;
  objetivo: Objetivo | null;
  objetivo_otro: string | null;
  nutriologo: {
    nombre: string;
    consultorio: string | null;
  };
  meta_agua_vasos: number;
  metas: MetasDelPlan | null;
};

export function obtenerPerfil(): Promise<PerfilPaciente> {
  return pedir<PerfilPaciente>('/api/v1/me');
}

export type CambiarPasswordPayload = {
  actual: string;
  nueva: string;
};

export function cambiarPassword(payload: CambiarPasswordPayload): Promise<{ actualizada: true }> {
  return json<{ actualizada: true }>('/api/v1/me/password', 'POST', payload);
}

export type DarDeBajaPayload = {
  password: string;
  confirmacion: true;
};

export function darDeBaja(payload: DarDeBajaPayload): Promise<{ baja: true }> {
  return json<{ baja: true }>('/api/v1/me/account', 'DELETE', payload);
}

/**
 * Descarga de los propios datos (derecho de acceso y portabilidad).
 *
 * Se pide con `fetch` y se guarda como Blob en vez de apuntar un `<a download>`
 * al endpoint: así un 429 o un 413 se leen como error en pantalla, en lugar de
 * bajar un archivo con el JSON del error adentro.
 */
export async function descargarMisDatos(): Promise<{ nombreArchivo: string; url: string }> {
  const respuesta = await pedirCrudo('/api/v1/me/export');
  const blob = await respuesta.blob();
  return { nombreArchivo: 'mis-datos-nutria.json', url: URL.createObjectURL(blob) };
}

/** `pedir` asume JSON; la exportación es un archivo y necesita la respuesta cruda. */
async function pedirCrudo(url: string): Promise<Response> {
  const { ApiPacienteError } = await import('@/lib/apiCliente');

  let respuesta: Response;
  try {
    respuesta = await fetch(url);
  } catch {
    throw new ApiPacienteError(
      {
        code: 'NETWORK_ERROR',
        message: 'No pudimos completar la solicitud. Revisa tu conexión e intenta de nuevo.',
      },
      0,
    );
  }

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { code: string; message: string };
    } | null;
    throw new ApiPacienteError(
      cuerpo?.error ?? {
        code: 'EXPORT_FAILED',
        message: 'No pudimos preparar tus datos. Intenta de nuevo.',
      },
      respuesta.status,
    );
  }

  return respuesta;
}
