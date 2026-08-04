export type EstadoCuenta = 'ACTIVA' | 'BLOQUEADA';

function validarFecha(fecha: Date): void {
  if (Number.isNaN(fecha.getTime())) {
    throw new RangeError('La fecha de activación debe ser válida.');
  }
}

/**
 * Suma un mes calendario en UTC y conserva el último día válido del mes.
 * Así, por ejemplo, el acceso iniciado el 31 de enero vence el 28/29 de febrero.
 */
function sumarMesCalendario(fecha: Date): Date {
  validarFecha(fecha);
  const resultado = new Date(fecha.getTime());
  const dia = resultado.getUTCDate();

  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + 1);
  const ultimoDia = new Date(
    Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0),
  ).getUTCDate();
  resultado.setUTCDate(Math.min(dia, ultimoDia));

  return resultado;
}

/** En el instante exacto de expiración la cuenta ya está bloqueada. */
export function calcularEstadoCuenta(
  accessExpiresAt: Date,
  ahora: Date = new Date(),
): EstadoCuenta {
  validarFecha(accessExpiresAt);
  validarFecha(ahora);
  return accessExpiresAt.getTime() > ahora.getTime() ? 'ACTIVA' : 'BLOQUEADA';
}

/** El primer mes gratuito se cuenta desde la fecha original de registro. */
export function calcularExpiracionInicial(fechaRegistro: Date): Date {
  return sumarMesCalendario(fechaRegistro);
}

/** Cada activación manual abre un ciclo nuevo de un mes desde ese momento. */
export function calcularNuevaExpiracionAlActivar(ahora: Date = new Date()): Date {
  return sumarMesCalendario(ahora);
}
