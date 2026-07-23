import type {
  CalculoNutricional,
  EcuacionBmr,
  GeneroDb,
  GrupoSmae,
  ModoProteina,
  NivelActividadDb,
  ObjetivoDb,
  Paciente,
  Pliegues,
  RegistroPeso,
  SnapshotCalculo,
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
  pliegues: Pliegues | null;
};

/** Cálculo guardado: el snapshot versionado más los datos de su persistencia. */
export type CalculoApi = {
  meal_plan_id: string;
  guardado_en: string;
  snapshot: SnapshotCalculo;
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
  calculo: CalculoApi | null;
};

export type PacienteResumenApi = Omit<
  PacienteApi,
  'expediente_medico' | 'preferencias_alimentarias' | 'mediciones' | 'ultima_medicion' | 'calculo'
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

/** Los pliegues se toman de la medición más reciente que los tenga registrados. */
function ultimosPliegues(mediciones: MedicionApi[]): Pliegues | null {
  return mediciones.find((m) => m.pliegues)?.pliegues ?? null;
}

/**
 * Campos que todavía no viven en la base (plan, seguimiento, recetas, notas).
 * Los aporta el almacén puente del cliente hasta que sus fases los migren.
 */
export type ExtrasPaciente = Pick<
  Paciente,
  'planActivo' | 'planEjercicio' | 'notasConsulta' | 'seguimiento'
>;

export const EXTRAS_VACIOS: ExtrasPaciente = {
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
      pliegues: ultimosPliegues(api.mediciones),
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
    // Del snapshot guardado solo el resultado energético entra al dominio; el
    // detalle auditable (comparativa, equivalentes) lo lee `TabCalculo` aparte.
    calculo: resultadoDeCalculo(api.calculo),
    ...extras,
  };
}

export function resultadoDeCalculo(calculo: CalculoApi | null): CalculoNutricional | null {
  return calculo?.snapshot?.resultado ?? null;
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

export type MedicionPayload = NonNullable<CrearPacientePayload['antropometria']> & {
  pliegues?: Pliegues | null;
};

export function agregarMedicionApi(id: string, medicion: MedicionPayload): Promise<MedicionApi> {
  return pedir<MedicionApi>(`/api/v1/patients/${id}/measurements`, {
    method: 'POST',
    body: JSON.stringify(medicion),
  });
}

/**
 * Opciones del cálculo. Solo el método: los resultados los produce el servidor
 * a partir del expediente, para que el snapshot guardado sea auditable.
 */
export type OpcionesCalculo = {
  ecuacion?: EcuacionBmr;
  modo_proteina?: ModoProteina;
  proteina_g_por_kg?: number | null;
  usar_peso_ajustado?: boolean;
  minimos_equivalentes?: Partial<Record<GrupoSmae, number>>;
};

export function guardarCalculoApi(id: string, opciones: OpcionesCalculo): Promise<CalculoApi> {
  return pedir<CalculoApi>(`/api/v1/patients/${id}/calculations`, {
    method: 'POST',
    body: JSON.stringify(opciones),
  });
}
