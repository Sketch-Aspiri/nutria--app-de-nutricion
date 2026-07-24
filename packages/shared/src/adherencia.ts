import {
  diferenciaEnDias,
  fechaMaxima,
  type FechaIso,
  rangoDeDias,
  sumarDias,
} from './fechas';

export const UMBRAL_ADHERENCIA_BAJA = 50;

/** Ventana por defecto del panel: el día en curso más los seis previos. */
export const DIAS_VENTANA_ADHERENCIA = 7;

/** Regla de negocio compartida: por debajo de 50% se considera adherencia baja y se alerta. */
export function esAdherenciaBaja(adherencia: number): boolean {
  return adherencia < UMBRAL_ADHERENCIA_BAJA;
}

/** Suma de calorías de las comidas de un plan (para validar contra la meta calculada). */
export function totalCaloriasPlan(comidas: Array<{ calorias: number }>): number {
  return comidas.reduce((total, c) => total + (Number.isFinite(c.calorias) ? c.calorias : 0), 0);
}

/** Lo mínimo que la adherencia necesita saber de un registro de comida. */
export type RegistroComida = {
  fecha: FechaIso;
};

export type EntradaAdherencia = {
  registros: RegistroComida[];
  /** Comidas al día que pide el plan activo. Es el denominador. */
  comidasPorDia: number;
  /** Primer día que cuenta: el día en que se activó el plan. */
  planActivoDesde: FechaIso;
  /** Último día evaluado, "hoy" en la zona horaria del consultorio. */
  hoy: FechaIso;
  dias?: number;
};

export type ResumenAdherencia = {
  /** 0–100, acotado: registrar de más un día no compensa los días vacíos. */
  adherencia: number;
  /** Días naturales consecutivos con al menos un registro, contados hacia atrás. */
  racha: number;
  diasEvaluados: number;
  diasConRegistro: number;
  comidasRegistradas: number;
  comidasEsperadas: number;
  desde: FechaIso;
  hasta: FechaIso;
};

/**
 * Racha de días consecutivos con al menos un registro.
 *
 * El día en curso todavía no termina: no haber registrado hoy no rompe la
 * racha, solo no la extiende. Cortarla a media mañana castigaría al paciente
 * por no haber desayunado aún.
 */
export function calcularRacha(fechas: Iterable<FechaIso>, hoy: FechaIso): number {
  const dias = new Set(fechas);
  if (dias.size === 0) return 0;

  let cursor = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  let racha = 0;
  while (dias.has(cursor)) {
    racha += 1;
    cursor = sumarDias(cursor, -1);
  }
  return racha;
}

function ventana(entrada: EntradaAdherencia): { desde: FechaIso; hasta: FechaIso } {
  const dias = Math.max(1, Math.trunc(entrada.dias ?? DIAS_VENTANA_ADHERENCIA));
  const desde = fechaMaxima(sumarDias(entrada.hoy, -(dias - 1)), entrada.planActivoDesde);
  return { desde, hasta: fechaMaxima(desde, entrada.hoy) };
}

function registrosPorDia(
  registros: RegistroComida[],
  desde: FechaIso,
  hasta: FechaIso,
): Map<FechaIso, number> {
  const porDia = new Map<FechaIso, number>();
  for (const registro of registros) {
    if (registro.fecha < desde || registro.fecha > hasta) continue;
    porDia.set(registro.fecha, (porDia.get(registro.fecha) ?? 0) + 1);
  }
  return porDia;
}

/**
 * Adherencia sobre registros reales del paciente contra las comidas que pide
 * su plan activo.
 *
 * Solo cuentan los días desde que el plan está activo: exigirle al paciente
 * los días anteriores mediría el tiempo que el nutriólogo tardó en entregarlo.
 * Un paciente sin plan activo no tiene contra qué compararse — ese caso lo
 * resuelve quien llama informando "sin plan activo", no un 0 % que se leería
 * como abandono.
 */
export function calcularAdherencia(entrada: EntradaAdherencia): ResumenAdherencia {
  const comidasPorDia = Math.max(1, Math.trunc(entrada.comidasPorDia));
  const { desde, hasta } = ventana(entrada);

  const diasEvaluados = diferenciaEnDias(desde, hasta) + 1;
  const comidasEsperadas = diasEvaluados * comidasPorDia;

  // Registrar cinco comidas un día no cubre el día anterior: el tope diario
  // evita que una racha de registros disfrace una semana incompleta.
  const porDia = registrosPorDia(entrada.registros, desde, hasta);
  const comidasRegistradas = [...porDia.values()].reduce(
    (total, cuenta) => total + Math.min(cuenta, comidasPorDia),
    0,
  );

  return {
    adherencia: Math.min(100, Math.round((comidasRegistradas / comidasEsperadas) * 100)),
    racha: calcularRacha(
      entrada.registros.map((r) => r.fecha),
      entrada.hoy,
    ),
    diasEvaluados,
    diasConRegistro: porDia.size,
    comidasRegistradas,
    comidasEsperadas,
    desde,
    hasta,
  };
}

export type DiaAdherencia = {
  fecha: FechaIso;
  registradas: number;
  esperadas: number;
};

/** Desglose por día para el panel; incluye los días en blanco. */
export function desgloseDiario(entrada: EntradaAdherencia): DiaAdherencia[] {
  const comidasPorDia = Math.max(1, Math.trunc(entrada.comidasPorDia));
  const { desde, hasta } = ventana(entrada);
  const porDia = registrosPorDia(entrada.registros, desde, hasta);

  return rangoDeDias(desde, hasta).map((fecha) => ({
    fecha,
    registradas: porDia.get(fecha) ?? 0,
    esperadas: comidasPorDia,
  }));
}

/** Tendencia de peso: primer y último registro del periodo, y su diferencia. */
export function tendenciaPeso(
  registros: Array<{ fecha: FechaIso; pesoKg: number }>,
): { inicial: number; actual: number; cambioKg: number } | null {
  if (registros.length === 0) return null;

  const ordenados = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const inicial = ordenados[0]!.pesoKg;
  const actual = ordenados[ordenados.length - 1]!.pesoKg;
  return {
    inicial,
    actual,
    // A una décima: la báscula de consultorio no distingue más, y restar
    // flotantes mostraría "-0.30000000000000004 kg" en pantalla.
    cambioKg: Math.round((actual - inicial) * 10) / 10,
  };
}
