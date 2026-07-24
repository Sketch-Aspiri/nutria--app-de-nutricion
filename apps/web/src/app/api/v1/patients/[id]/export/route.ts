import { requiereNutriologo } from '@/server/auth/guards';
import { ErrorCode, internalError, jsonError, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import {
  exportPatientRecord,
  PatientExportTooLargeError,
  recordPatientExport,
} from '@/server/patients/export';
import { rateLimit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/export — expediente portable para derechos ARCO. */
export async function GET(request: Request, { params }: Context) {
  const session = await requiereNutriologo();
  if (!session.ok) return session.respuesta;

  const { id } = await params;
  try {
    const limit = await rateLimit(
      `patient-export:${session.userId}:${id}`,
      3,
      60 * 60 * 1000,
    );
    if (!limit.permitido) {
      return jsonError(
        429,
        ErrorCode.RATE_LIMITED,
        `Intenta de nuevo en ${limit.reintentarEnSegundos} segundos.`,
      );
    }
    const record = await exportPatientRecord(session.userId, id);
    if (!record) return notFound('No se encontró el paciente.');

    await recordPatientExport(session.userId, id, request);
    return new Response(JSON.stringify(record, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="expediente-${id}.json"`,
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error: unknown) {
    if (error instanceof PatientExportTooLargeError) {
      return jsonError(
        413,
        ErrorCode.EXPORT_TOO_LARGE,
        'El expediente requiere una exportación asistida por soporte.',
      );
    }
    logger.error('Falló la exportación del expediente', error);
    return internalError();
  }
}
