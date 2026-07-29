import { calcularRacha } from './adherencia';
import { type FechaIso, rangoDeDias, sumarDias } from './fechas';

/**
 * Logros del paciente, **calculados** a partir de sus registros reales.
 *
 * No hay tabla ni columna: guardarlos obligaría a mantener sincronizado un
 * estado derivado que se desfasa en cuanto el paciente registra algo tarde o
 * corrige un peso. Al calcularlos aquí, la única fuente de verdad son los
 * registros, y la fórmula se comparte entre la app del paciente y el panel.
 */

export const RACHA_OBJETIVO_DIAS = 7;
export const AGUA_OBJETIVO_DIAS = 7;
export const SEMANA_COMPLETA_DIAS = 7;
export const PRIMEROS_KG_OBJETIVO = 2;
export const DIAS_ACTIVO_OBJETIVO = 10;

export type IdLogro =
  | 'racha_dias'
  | 'agua_meta'
  | 'semana_completa'
  | 'primeros_kg'
  | 'peso_meta'
  | 'dias_activo';

export type Logro = {
  id: IdLogro;
  titulo: string;
  descripcion: string;
  conseguido: boolean;
  /** Avance de 0 a 1, redondeado a centésimas. Permite pintar una barra. */
  progreso: number;
};

export type EntradaLogros = {
  /** Días naturales con al menos un registro de comida. */
  diasConRegistro: FechaIso[];
  /** Días en los que se alcanzó la meta de vasos de agua. */
  diasConMetaAgua: FechaIso[];
  /** Días con al menos un registro de ejercicio. */
  diasConEjercicio: FechaIso[];
  pesoInicial: number | null;
  pesoActual: number | null;
  /**
   * Peso objetivo. Hoy siempre `null`: el modelo no lo guarda todavía, así que
   * el logro queda bloqueado en vez de inventarse una meta.
   */
  pesoMeta: number | null;
  hoy: FechaIso;
};

/** Fracción acotada a [0, 1] y redondeada, para que la barra no se pase. */
function avance(logrado: number, objetivo: number): number {
  if (objetivo <= 0) return 0;
  return Math.min(1, Math.max(0, Math.round((logrado / objetivo) * 100) / 100));
}

/** Cuántos de los últimos `dias` días naturales tienen registro. */
function diasCubiertos(dias: Iterable<FechaIso>, hoy: FechaIso, ventana: number): number {
  const conRegistro = new Set(dias);
  return rangoDeDias(sumarDias(hoy, -(ventana - 1)), hoy).filter((dia) => conRegistro.has(dia))
    .length;
}

/** Kilos perdidos hacia la meta; 0 si aún no hay dos pesajes o si subió. */
function kilosBajados(inicial: number | null, actual: number | null): number {
  if (inicial === null || actual === null) return 0;
  return Math.max(0, Math.round((inicial - actual) * 10) / 10);
}

/**
 * Avance hacia el peso meta, en la dirección que corresponda.
 *
 * Un objetivo de ganancia de masa es tan válido como uno de pérdida: se mide el
 * camino recorrido sobre el camino total, no los kilos hacia abajo.
 */
function avanceHaciaMeta(entrada: EntradaLogros): number {
  const { pesoInicial, pesoActual, pesoMeta } = entrada;
  if (pesoInicial === null || pesoActual === null || pesoMeta === null) return 0;

  const total = Math.abs(pesoMeta - pesoInicial);
  if (total === 0) return 1;
  return avance(Math.abs(pesoActual - pesoInicial), total);
}

export function calcularLogros(entrada: EntradaLogros): Logro[] {
  const racha = calcularRacha(entrada.diasConRegistro, entrada.hoy);
  const diasAgua = diasCubiertos(entrada.diasConMetaAgua, entrada.hoy, AGUA_OBJETIVO_DIAS);
  const semana = diasCubiertos(entrada.diasConRegistro, entrada.hoy, SEMANA_COMPLETA_DIAS);
  const bajados = kilosBajados(entrada.pesoInicial, entrada.pesoActual);
  const haciaMeta = avanceHaciaMeta(entrada);
  const diasActivo = new Set(entrada.diasConEjercicio).size;

  return [
    {
      id: 'racha_dias',
      titulo: `Racha de ${RACHA_OBJETIVO_DIAS} días`,
      descripcion: `Registra tus comidas ${RACHA_OBJETIVO_DIAS} días seguidos.`,
      conseguido: racha >= RACHA_OBJETIVO_DIAS,
      progreso: avance(racha, RACHA_OBJETIVO_DIAS),
    },
    {
      id: 'agua_meta',
      titulo: 'Hidratación constante',
      descripcion: `Alcanza tu meta de agua ${AGUA_OBJETIVO_DIAS} días.`,
      conseguido: diasAgua >= AGUA_OBJETIVO_DIAS,
      progreso: avance(diasAgua, AGUA_OBJETIVO_DIAS),
    },
    {
      id: 'semana_completa',
      titulo: 'Semana completa',
      descripcion: 'Registra algo cada día de la última semana.',
      conseguido: semana >= SEMANA_COMPLETA_DIAS,
      progreso: avance(semana, SEMANA_COMPLETA_DIAS),
    },
    {
      id: 'primeros_kg',
      titulo: `Primeros ${PRIMEROS_KG_OBJETIVO} kg`,
      descripcion: `Baja tus primeros ${PRIMEROS_KG_OBJETIVO} kg desde tu peso inicial.`,
      conseguido: bajados >= PRIMEROS_KG_OBJETIVO,
      progreso: avance(bajados, PRIMEROS_KG_OBJETIVO),
    },
    {
      id: 'peso_meta',
      titulo: 'Peso meta',
      descripcion: 'Llega al peso que acordaste con tu nutriólogo.',
      conseguido: entrada.pesoMeta !== null && haciaMeta >= 1,
      progreso: haciaMeta,
    },
    {
      id: 'dias_activo',
      titulo: `${DIAS_ACTIVO_OBJETIVO} días activo`,
      descripcion: `Registra ejercicio en ${DIAS_ACTIVO_OBJETIVO} días distintos.`,
      conseguido: diasActivo >= DIAS_ACTIVO_OBJETIVO,
      progreso: avance(diasActivo, DIAS_ACTIVO_OBJETIVO),
    },
  ];
}
