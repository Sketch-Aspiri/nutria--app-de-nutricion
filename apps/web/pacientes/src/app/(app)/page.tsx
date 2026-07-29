import { auth } from '@/server/auth';
import { HoyCliente } from '@/features/hoy/HoyCliente';

export const metadata = { title: 'Hoy — nutria' };
export const dynamic = 'force-dynamic';

export default async function HoyPage() {
  const sesion = await auth();
  const nombre = sesion?.user?.name ?? '';

  return <HoyCliente nombre={nombre} />;
}
