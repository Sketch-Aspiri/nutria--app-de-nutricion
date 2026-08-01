import { pedir } from '@/lib/apiCliente';

import type { Progreso } from './types';

/**
 * Lectura de la pantalla Progreso.
 *
 * No acepta `patient_id`: el servidor lo resuelve desde la sesión con
 * `requierePaciente`. Un solo endpoint trae la serie de peso y los logros, así
 * que la pantalla no puede mostrar una gráfica de un día y logros de otro.
 */
export function obtenerProgreso(): Promise<Progreso> {
  return pedir<Progreso>('/api/v1/me/progress');
}
