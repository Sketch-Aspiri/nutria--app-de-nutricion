import { responderCierreDeCita } from '@/server/appointments/cerrarHandler';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** POST /api/v1/appointments/{id}/cancel */
export async function POST(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return responderCierreDeCita(id, 'CANCELADA');
}
