import { responderCierreDeCita } from '@/server/appointments/cerrarHandler';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** POST /api/v1/appointments/{id}/no_show — el paciente no se presentó. */
export async function POST(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return responderCierreDeCita(id, 'NO_ASISTIO');
}
