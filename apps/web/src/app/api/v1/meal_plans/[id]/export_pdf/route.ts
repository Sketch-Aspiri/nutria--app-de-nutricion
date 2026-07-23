import { GET as renderizarPdf } from '../pdf/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Contexto = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/meal_plans/{id}/export_pdf
 *
 * Alias estable del contrato V2. La vista previa usa GET `/pdf`; este endpoint
 * fuerza Content-Disposition attachment para clientes móviles y externos.
 */
export function POST(request: Request, contexto: Contexto) {
  const url = new URL(request.url);
  url.searchParams.set('download', '1');
  return renderizarPdf(
    new Request(url, { method: 'GET', headers: request.headers }),
    contexto,
  );
}
