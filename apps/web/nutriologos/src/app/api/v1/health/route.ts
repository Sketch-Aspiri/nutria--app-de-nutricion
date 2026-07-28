import { prisma } from '@/server/db';
import { jsonOk, jsonError, ErrorCode } from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

/** GET /api/v1/health — usado por el monitoreo y para validar el despliegue. */
export async function GET() {
  const inicio = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({
      status: 'ok',
      base_de_datos: 'ok',
      latencia_ms: Date.now() - inicio,
      hora: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Health check: la base de datos no responde', error);
    return jsonError(
      503,
      ErrorCode.INTERNAL_ERROR,
      'La base de datos no está disponible en este momento.',
    );
  }
}
