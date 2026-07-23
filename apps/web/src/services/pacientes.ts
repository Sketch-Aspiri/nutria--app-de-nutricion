import type {
  GeneroDb,
  NivelActividadDb,
  ObjetivoDb,
  Paciente,
  RegistroPeso,
} from '@nutria/shared';
import { generoDesdeDb, nivelActividadDesdeDb, objetivoDesdeDb } from '@nutria/shared';

/**
 * Cliente de `/api/v1/patients` y traducción al tipo de dominio `Paciente`.
 * Ningún componente llama a `fetch` directamente (ver `rules/code-style.md`).
 */

export type MedicionApi = {
  id: string;
  fecha: string | null;
  peso_kg: number | null;
  altura_cm: number | null;
  cintura_cm: number | null;
  cadera_cm: number | null;
  grasa_pct: number | null;
  musculo_pct: number | null;
};

export type PacienteApi = {
  id: string;
  nombre: string;
  fecha_nacimiento: string | null;
  edad: number;
  genero: GeneroDb;
  email: string | null;
  telefono: string | null;
  foto_url: string | null;
  estado: 'ACTIVO' | 'ARCHIVADO';
  expediente_medico: {
    condiciones: string[];
    antecedentes: string | null;
    medicamentos: string | null;
    nivel_actividad: NivelActividadDb;
    objetivo: ObjetivoDb;
  } | null;
  preferencias_alimentarias: {
    tipo_dieta: string | null;
    alergias: string[];
    disgustos: string | null;
    comidas_por_dia: number;
    presupuesto_tiempo: string;
  } | null;
  mediciones: MedicionApi[];
  ultima_medicion: MedicionApi | null;
};

export type PacienteResumenApi = Omit<
  PacienteApi,
  'expediente_medico' | 'preferencias_alimentarias' | 'mediciones' | 'ultima_medicion'
> & { objetivo: ObjetivoDb | null };

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

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
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

const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

function etiquetaDeFecha(iso: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(`${iso}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? '—' : FORMATO_FECHA.format(fecha);
}

/** La gráfica de evolución necesita el peso de la más antigua a la más reciente. */
function historialDePeso(mediciones: MedicionApi[]): RegistroPeso[] {
  return mediciones
    .filter((m): m is MedicionApi & { peso_kg: number } => typeof m.peso_kg === 'number')
    .map((m) => ({ fecha: etiquetaDeFecha(m.fecha), peso: m.peso_kg }))
    .reverse();
}

/**
 * Campos que todavía no viven en la base (cálculo, plan, seguimiento, recetas).
 * Los aporta el almacén puente del cliente hasta que sus fases los migren.
 */
export type ExtrasPaciente = Pick<
  Paciente,
  'calculo' | 'planActivo' | 'planEjercicio' | 'notasConsulta' | 'seguimiento'
>;

export const EXTRAS_VACIOS: ExtrasPaciente = {
  calculo: null,
  planActivo: null,
  planEjercicio: null,
  notasConsulta: [],
  seguimiento: {
    adherencia: 0,
    racha: 0,
    comidas: [],
    ejercicio: [],
    recetasEnCurso: [],
    recetasSugeridas: [],
  },
};

export function aPacienteDominio(api: PacienteApi, extras: ExtrasPaciente): Paciente {
  const medico = api.expediente_medico;
  const preferencias = api.preferencias_alimentarias;
  const ultima = api.ultima_medicion;

  return {
    id: api.id,
    nombre: api.nombre,
    foto: api.foto_url,
    edad: api.edad,
    fechaNacimiento: api.fecha_nacimiento,
    genero: generoDesdeDb(api.genero),
    telefono: api.telefono ?? '',
    email: api.email ?? '',
    medico: {
      condiciones: medico?.condiciones.length ? medico.condiciones : ['Ninguna'],
      antecedentes: medico?.antecedentes ?? '',
      medicamentos: medico?.medicamentos ?? '',
      nivelActividad: nivelActividadDesdeDb(medico?.nivel_actividad ?? 'MODERADO'),
      objetivo: objetivoDesdeDb(medico?.objetivo ?? 'MANTENIMIENTO'),
    },
    antropometria: {
      // 0 significa "sin capturar": las fórmulas lanzan EXPEDIENTE_INCOMPLETO.
      peso: ultima?.peso_kg ?? 0,
      altura: ultima?.altura_cm ?? 0,
      cintura: ultima?.cintura_cm ?? 0,
      cadera: ultima?.cadera_cm ?? 0,
      grasaCorporal: ultima?.grasa_pct ?? 0,
      historial: historialDePeso(api.mediciones),
    },
    preferencias: {
      tipoDieta: preferencias?.tipo_dieta ?? 'Omnívoro',
      alergias: preferencias?.alergias.length ? preferencias.alergias : ['Ninguna'],
      disgustos: preferencias?.disgustos ?? '',
      comidasPorDia: preferencias?.comidas_por_dia ?? 3,
      presupuestoTiempo:
        (preferencias?.presupuesto_tiempo as Paciente['preferencias']['presupuestoTiempo']) ??
        'Medio',
    },
    ...extras,
  };
}

export type CrearPacientePayload = {
  nombre: string;
  fecha_nacimiento?: string | null;
  genero?: GeneroDb;
  email?: string | null;
  telefono?: string | null;
  foto_url?: string | null;
  expediente_medico?: {
    condiciones?: string[];
    antecedentes?: string | null;
    medicamentos?: string | null;
    nivel_actividad?: NivelActividadDb;
    objetivo?: ObjetivoDb;
  };
  preferencias_alimentarias?: {
    tipo_dieta?: string | null;
    alergias?: string[];
    disgustos?: string | null;
    comidas_por_dia?: number;
    presupuesto_tiempo?: 'Bajo' | 'Medio' | 'Alto';
  };
  antropometria?: {
    peso_kg?: number | null;
    altura_cm?: number | null;
    cintura_cm?: number | null;
    cadera_cm?: number | null;
    grasa_pct?: number | null;
  };
};

export function listarPacientes(): Promise<{ data: PacienteResumenApi[] }> {
  return pedir<{ data: PacienteResumenApi[] }>('/api/v1/patients?per_page=100');
}

export function obtenerPaciente(id: string): Promise<PacienteApi> {
  return pedir<PacienteApi>(`/api/v1/patients/${id}`);
}

export function crearPacienteApi(payload: CrearPacientePayload): Promise<PacienteApi> {
  return pedir<PacienteApi>('/api/v1/patients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function agregarMedicionApi(
  id: string,
  medicion: NonNullable<CrearPacientePayload['antropometria']>,
): Promise<MedicionApi> {
  return pedir<MedicionApi>(`/api/v1/patients/${id}/measurements`, {
    method: 'POST',
    body: JSON.stringify(medicion),
  });
}
