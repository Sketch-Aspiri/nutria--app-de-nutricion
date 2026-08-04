import { listarNutriologas } from '@/server/admin/nutritionists';
import { requiereSuperAdmin } from '@/server/auth/guards';
import { internalError, jsonList, parsePagination } from '@/server/http';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const sesion = await requiereSuperAdmin();
  if (!sesion.ok) return sesion.respuesta;

  const { searchParams } = new URL(request.url);
  const paginacion = parsePagination(searchParams);

  try {
    const resultado = await listarNutriologas(paginacion.skip, paginacion.take);
    const respuesta = jsonList(resultado.data, {
      page: paginacion.page,
      per_page: paginacion.perPage,
      total: resultado.total,
      activas: resultado.activas,
      bloqueadas: resultado.bloqueadas,
    });
    respuesta.headers.set('Cache-Control', 'private, no-store');
    return respuesta;
  } catch (error: unknown) {
    logger.error('No se pudo listar las cuentas de nutriólogas', error);
    return internalError();
  }
}
