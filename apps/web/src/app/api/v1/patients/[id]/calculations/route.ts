import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { calcularParaPaciente } from '@/server/patients/calculo';
import { buscarPaciente, guardarCalculo } from '@/server/patients/repository';
import { calculoSchema } from '@/server/patients/schemas';
import { serializarCalculo } from '@/server/patients/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/calculations — último cálculo guardado. */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  try {
    const paciente = await buscarPaciente(sesion.userId, id);
    if (!paciente) return notFound('No se encontró el paciente.');

    const plan = paciente.mealPlans[0];
    return jsonOk(plan ? serializarCalculo(plan) : null);
  } catch (error: unknown) {
    logger.error('Falló la lectura del cálculo', error);
    return internalError();
  }
}

/**
 * POST /api/v1/patients/{id}/calculations — recalcula desde el expediente con
 * las opciones que elige el nutriólogo y guarda el snapshot en el plan vigente.
 *
 * El cuerpo lleva el método (ecuación, modo de proteína, mínimos por grupo),
 * nunca resultados: el servidor es el único que produce los números que se
 * archivan, para que el cálculo sea reconstruible desde la base.
 */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = calculoSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const paciente = await buscarPaciente(sesion.userId, id);
    if (!paciente) return notFound('No se encontró el paciente.');

    const snapshot = calcularParaPaciente(paciente, parsed.data);
    const plan = await guardarCalculo(sesion.userId, id, snapshot);
    if (!plan) return notFound('No se encontró el paciente.');

    return jsonCreated(serializarCalculo(plan));
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'EXPEDIENTE_INCOMPLETO') {
      // 422: la petición es válida, lo que falta es un dato clínico del paciente.
      return jsonError(
        422,
        ErrorCode.EXPEDIENTE_INCOMPLETO,
        'Faltan datos para calcular: registra peso, altura y fecha de nacimiento del paciente.',
      );
    }
    logger.error('Falló el cálculo nutricional', error);
    return internalError();
  }
}
