/**
 * Contrato que la app del paciente lee de `/api/v1/me/progress`.
 *
 * Es la forma serializada en snake_case, no los modelos de Prisma. Los logros
 * llegan **calculados** por `packages/shared/src/logros.ts`: la app no vuelve a
 * derivarlos ni los guarda, porque dos implementaciones de la misma regla se
 * desfasan en cuanto una de las dos cambia.
 */

/** Un pesaje. `fecha` es el día natural (`YYYY-MM-DD`), no un instante UTC. */
export type RegistroPeso = {
  id: string;
  fecha: string;
  peso_kg: number;
  created_at: string;
};

/**
 * Tendencia entre el primer y el último pesaje.
 *
 * `cambio_kg` es `actual - inicial`: **negativo** cuando el paciente bajó. Se
 * conserva el signo del servidor en vez de invertirlo aquí para que la UI no
 * tenga que adivinar la dirección del objetivo.
 */
export type TendenciaPeso = {
  inicial: number;
  actual: number;
  cambio_kg: number;
};

export type Logro = {
  id: string;
  titulo: string;
  descripcion: string;
  conseguido: boolean;
  /** Avance de 0 a 1. La UI lo pinta como barra; no es un porcentaje entero. */
  progreso: number;
};

/**
 * Resumen de progreso.
 *
 * `peso` es `null` mientras no haya ningún pesaje, y `falta_kg` es **siempre**
 * `null` en la V1: el esquema no guarda un peso objetivo. La pantalla lo dice
 * en vez de estimarlo, porque una meta clínica inventada es peor que un hueco.
 */
export type Progreso = {
  pesos: RegistroPeso[];
  peso: TendenciaPeso | null;
  falta_kg: number | null;
  logros: Logro[];
};
