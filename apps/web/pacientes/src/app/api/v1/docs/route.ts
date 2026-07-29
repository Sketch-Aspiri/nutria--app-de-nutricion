import { NextResponse } from 'next/server';

import { openApiPacientes } from '@/server/me/openapi';

export const dynamic = 'force-dynamic';

/**
 * Contrato de `/api/v1/me/*`, para desarrollo y CI. Nunca en producción: no hay
 * razón para publicarle a nadie el mapa de una API que solo consume esta app.
 */
export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.' } },
      { status: 404 },
    );
  }

  return NextResponse.json(openApiPacientes, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
