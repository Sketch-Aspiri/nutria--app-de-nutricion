import type { Cita, Factura, MensajeChat } from '@nutria/shared';

/**
 * Datos de arranque de las secciones que todavía no viven en la base.
 *
 * Los pacientes ya no están aquí: se leen de PostgreSQL. Agenda, mensajes y
 * facturación arrancan vacíos porque sus registros de demostración apuntaban a
 * pacientes ficticios que ya no existen; se migran en las fases 6 y 7.
 */

export const CITAS_DEMO: Cita[] = [];

export const MENSAJES_DEMO: Record<string, MensajeChat[]> = {};

export const FACTURAS_DEMO: Factura[] = [];
