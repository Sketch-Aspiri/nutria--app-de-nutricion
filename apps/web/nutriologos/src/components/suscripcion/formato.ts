import type { LimiteUsoApi } from '@/services/suscripcion';

/**
 * Textos compartidos por la página de suscripción y el badge del encabezado.
 *
 * Este módulo no importa de `@nutria/shared` a propósito: lo carga el `TopBar`,
 * que está en el layout de **todo** el panel, y el barril compartido arrastraría
 * nutrición, alimentos y adherencia al bundle de cada pantalla. El formateo de
 * precios, que sí necesita el paquete, vive en `TarjetaPlan` —solo se carga en
 * `/suscripcion`—.
 */

export const ETIQUETA_PLAN: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  CLINICA: 'Clínica',
};

export const ETIQUETA_ESTADO: Record<string, string> = {
  ACTIVE: 'Activa',
  TRIALING: 'En periodo de prueba',
  PAST_DUE: 'Pago pendiente',
  CANCELED: 'Cancelada',
  UNPAID: 'Sin pagar',
};

/** `null` en `limite` significa ilimitado, no cero. */
export function textoDeUso(uso: LimiteUsoApi, sustantivo: string): string {
  if (uso.limite === null) return `${uso.usados} ${sustantivo} · sin límite`;
  return `${uso.usados} de ${uso.limite} ${sustantivo}`;
}

export function fechaLarga(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Porcentaje consumido, acotado a [0, 100], para las barras de uso. */
export function porcentajeUsado(usados: number, limite: number | null): number {
  if (limite === null || limite <= 0) return 0;
  return Math.min(Math.round((usados / limite) * 100), 100);
}
