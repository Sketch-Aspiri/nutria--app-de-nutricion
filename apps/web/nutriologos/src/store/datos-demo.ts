import type { Factura } from '@nutria/shared';

/**
 * Datos de arranque de lo único que todavía no vive en la base.
 *
 * Pacientes, planes, agenda, mensajes y seguimiento se leen de PostgreSQL. La
 * facturación arranca vacía y migra en la fase 7.
 */

export const FACTURAS_DEMO: Factura[] = [];
