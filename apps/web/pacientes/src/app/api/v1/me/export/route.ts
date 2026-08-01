import { requierePaciente } from '@/server/auth/guards';
import { ErrorCode, internalError, jsonError, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import {
  ExportacionDemasiadoGrandeError,
  exportarDatosDelPaciente,
  registrarExportacionPropia,
} from '@/server/me/cuenta';
import { rateLimit } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Mismo tope que la exportación del panel: tres por hora. */
const EXPORTACIONES_POR_HORA = 3;

/**
 * `GET /api/v1/me/export` — derecho de acceso y portabilidad (ARCO).
 *
 * El paciente descarga sus propios datos. No recibe id por parámetro: el suyo
 * sale de la sesión, así que no hay nada que manipular para leer el expediente
 * de alguien más.
 *
 * `no-store` y `Content-Disposition` son deliberados: el archivo trae datos de
 * salud y no debe quedar en cachés intermedias ni renderizarse en una pestaña.
 */
export async function GET(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const limite = await rateLimit(
      `me:export:${sesion.userId}`,
      EXPORTACIONES_POR_HORA,
      60 * 60 * 1000,
    );
    if (!limite.permitido) {
      return jsonError(
        429,
        ErrorCode.RATE_LIMITED,
        `Ya descargaste tus datos hace poco. Intenta de nuevo en ${limite.reintentarEnSegundos} segundos.`,
      );
    }

    const datos = await exportarDatosDelPaciente(sesion.patientId);
    if (!datos) return notFound('No se encontró tu expediente.');

    await registrarExportacionPropia(sesion.userId, sesion.patientId, request);

    return new Response(JSON.stringify(datos, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mis-datos-nutria.json"',
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error: unknown) {
    if (error instanceof ExportacionDemasiadoGrandeError) {
      return jsonError(
        413,
        ErrorCode.EXPORT_TOO_LARGE,
        'Tus datos son demasiados para una descarga inmediata. Pídeselos a tu nutrióloga.',
      );
    }
    logger.error('Falló la exportación de datos del paciente', error);
    return internalError();
  }
}
