import { GRUPOS_ALIMENTO, NOMBRE_GRUPO_ALIMENTO } from '@nutria/shared';

import { requiereNutriologo } from '@/server/auth/guards';
import { contarPorGrupo } from '@/server/foods/repository';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/foods/groups — grupos de equivalentes con cuántos alimentos
 * tiene cada uno a la vista de este nutriólogo. Alimenta los filtros del
 * buscador sin obligarlo a traer el catálogo entero para contarlo.
 */
export async function GET() {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const conteos = await contarPorGrupo(sesion.userId);

    return jsonOk({
      data: GRUPOS_ALIMENTO.map((grupo) => ({
        grupo,
        nombre: NOMBRE_GRUPO_ALIMENTO[grupo],
        total: conteos[grupo] ?? 0,
      })),
    });
  } catch (error: unknown) {
    logger.error('Falló el conteo de alimentos por grupo', error);
    return internalError();
  }
}
