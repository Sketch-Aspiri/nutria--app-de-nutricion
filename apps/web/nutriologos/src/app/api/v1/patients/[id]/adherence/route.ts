import { requiereNutriologo } from '@/server/auth/guards';
import { internalError, jsonOk, notFound, validationError } from '@/server/http';
import { logger } from '@/server/logger';
import { resumenDeSeguimiento } from '@/server/tracking/repository';
import { consultaAdherenciaSchema } from '@/server/tracking/schemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/patients/{id}/adherence
 *
 * Adherencia y racha calculadas sobre `meal_logs` contra el plan activo. No
 * son columnas: se recalculan en cada consulta, así que un registro tardío del
 * paciente se refleja de inmediato.
 *
 * Sin plan activo responde 200 con `adherencia: null`, no un 0 %: es una
 * situación normal (paciente recién dado de alta), no un error, y un cero se
 * leería en el panel como abandono.
 */
export async function GET(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const consulta = consultaAdherenciaSchema.safeParse({
    dias: searchParams.get('dias') ?? undefined,
  });
  if (!consulta.success) return validationError(consulta.error);

  try {
    const resumen = await resumenDeSeguimiento(sesion.userId, id, consulta.data);
    if (!resumen) return notFound('No se encontró el paciente.');

    return jsonOk({
      adherencia: resumen.adherencia?.adherencia ?? null,
      racha: resumen.adherencia?.racha ?? 0,
      dias_evaluados: resumen.adherencia?.diasEvaluados ?? 0,
      dias_con_registro: resumen.adherencia?.diasConRegistro ?? 0,
      comidas_registradas: resumen.adherencia?.comidasRegistradas ?? 0,
      comidas_esperadas: resumen.adherencia?.comidasEsperadas ?? 0,
      comidas_por_dia: resumen.comidasPorDia,
      plan_activo_desde: resumen.planActivoDesde,
      desglose: resumen.dias.map((dia) => ({
        fecha: dia.fecha,
        registradas: dia.registradas,
        esperadas: dia.esperadas,
      })),
      peso: resumen.peso
        ? {
            inicial_kg: resumen.peso.inicial,
            actual_kg: resumen.peso.actual,
            cambio_kg: resumen.peso.cambioKg,
          }
        : null,
      zona_horaria: resumen.zonaHoraria,
    });
  } catch (error: unknown) {
    logger.error('Falló el cálculo de adherencia', error);
    return internalError();
  }
}
