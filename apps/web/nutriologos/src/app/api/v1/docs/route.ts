import { NextResponse } from 'next/server';

import { openApiDocument } from '@/server/openapi';

export const dynamic = 'force-dynamic';

/** OpenAPI se expone para desarrollo y CI, nunca en producción. */
export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.' } },
      { status: 404 },
    );
  }

  return NextResponse.json(openApiDocument, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
