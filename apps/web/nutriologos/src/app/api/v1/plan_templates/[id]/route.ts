import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonNoContent,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import {
  actualizarPlantilla,
  AlimentoDePlanNoEncontradoError,
  borrarPlantilla,
  buscarPlantilla,
} from '@/server/plans/repository';
import { actualizarPlantillaSchema } from '@/server/plans/schemas';
import { serializarPlantilla } from '@/server/plans/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };
const NO_ENCONTRADA = 'No se encontró la plantilla.';

/** GET /api/v1/plan_templates/{id} — una plantilla propia. */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const plantilla = await buscarPlantilla(sesion.userId, id);
    if (!plantilla) return notFound(NO_ENCONTRADA);
    return jsonOk(serializarPlantilla(plantilla));
  } catch (error: unknown) {
    logger.error('Falló la lectura de la plantilla de plan', error);
    return internalError();
  }
}

/** PATCH /api/v1/plan_templates/{id} — edición parcial con pertenencia. */
export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(
      400,
      ErrorCode.INVALID_BODY,
      'El cuerpo de la petición no es JSON válido.',
    );
  }

  const parsed = actualizarPlantillaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const plantilla = await actualizarPlantilla(sesion.userId, id, parsed.data);
    if (!plantilla) return notFound(NO_ENCONTRADA);
    return jsonOk(serializarPlantilla(plantilla));
  } catch (error: unknown) {
    if (error instanceof AlimentoDePlanNoEncontradoError) {
      return notFound('No se encontró uno de los alimentos de la plantilla.');
    }
    logger.error('Falló la edición de la plantilla de plan', error);
    return internalError();
  }
}

/** DELETE /api/v1/plan_templates/{id} — elimina una plantilla propia. */
export async function DELETE(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const eliminada = await borrarPlantilla(sesion.userId, id);
    if (!eliminada) return notFound(NO_ENCONTRADA);
    return jsonNoContent();
  } catch (error: unknown) {
    logger.error('Falló la eliminación de la plantilla de plan', error);
    return internalError();
  }
}
