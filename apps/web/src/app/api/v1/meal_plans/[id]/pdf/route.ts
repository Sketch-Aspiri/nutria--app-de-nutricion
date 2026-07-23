import { requiereNutriologo } from '@/server/auth/guards';
import {
  MAX_COMIDAS_PLAN,
  MAX_ITEMS_PLAN,
} from '@/domain/planLimits';
import {
  crearDatosPlanPdf,
  nombreArchivoPlan,
} from '@/server/pdf/mealPlanData';
import {
  ejecutarRenderPdfProtegido,
  PdfCapacidadAgotadaError,
  PdfDemasiadoGrandeError,
  PdfRenderTimeoutError,
} from '@/server/pdf/pdfRenderLimits';
import { renderMealPlanPdf } from '@/server/pdf/renderMealPlanPdf';
import { ErrorCode, internalError, jsonError, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import { buscarPlanParaPdf } from '@/server/plans/repository';
import { rateLimit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Contexto = { params: Promise<{ id: string }> };
const MAX_PDFS_POR_MINUTO = 6;
const VENTANA_PDF_MS = 60_000;

/**
 * GET /api/v1/meal_plans/{id}/pdf
 *
 * El lookup comprueba la pertenencia dentro de la consulta. Un plan ajeno y
 * uno inexistente responden igual para no filtrar identificadores.
 */
export async function GET(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const limite = rateLimit(
    `meal-plan-pdf:${sesion.userId}`,
    MAX_PDFS_POR_MINUTO,
    VENTANA_PDF_MS,
  );
  if (!limite.permitido) {
    const respuesta = jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Demasiadas solicitudes de PDF. Espera un momento antes de reintentar.',
    );
    respuesta.headers.set('Retry-After', String(limite.reintentarEnSegundos));
    return respuesta;
  }

  const { id } = await params;

  try {
    const plan = await buscarPlanParaPdf(sesion.userId, id);
    if (!plan) return notFound('No se encontró el plan alimenticio.');
    const totalItems = plan.meals.reduce(
      (total, comida) => total + comida.items.length,
      0,
    );
    if (
      plan.meals.length > MAX_COMIDAS_PLAN ||
      totalItems > MAX_ITEMS_PLAN
    ) {
      return jsonError(
        422,
        ErrorCode.PLAN_PDF_TOO_LARGE,
        `El plan excede el máximo de ${MAX_COMIDAS_PLAN} comidas o ${MAX_ITEMS_PLAN} items para exportar.`,
      );
    }

    const pdf = await ejecutarRenderPdfProtegido(async () =>
      renderMealPlanPdf(await crearDatosPlanPdf(plan)),
    );
    const archivo = nombreArchivoPlan(plan.patient.nombre);
    const descargar = new URL(request.url).searchParams.get('download') === '1';

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${archivo}"`,
        'Content-Length': String(pdf.byteLength),
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    if (
      error instanceof PdfCapacidadAgotadaError ||
      error instanceof PdfRenderTimeoutError ||
      error instanceof PdfDemasiadoGrandeError
    ) {
      const respuesta = jsonError(
        503,
        ErrorCode.INTERNAL_ERROR,
        'El servicio de PDF está ocupado. Intenta de nuevo en unos momentos.',
      );
      respuesta.headers.set('Retry-After', '3');
      return respuesta;
    }
    logger.error('Falló la generación del PDF del plan', error);
    return internalError();
  }
}
