import { redirect } from 'next/navigation';

import { PanelShell } from '@/components/layout/PanelShell';
import { auth } from '@/server/auth';

/**
 * Segunda barrera de acceso al panel. El middleware ya bloquea estas rutas,
 * pero la sesión se revalida aquí en el servidor: una regla de matcher mal
 * escrita no debe traducirse en expedientes visibles.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await auth();

  if (!sesion?.user) redirect('/login');
  if (!sesion.user.emailVerificado) redirect('/verificar');

  return <PanelShell>{children}</PanelShell>;
}
