import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
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

  return (
    <div className="flex h-screen bg-stone-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 overflow-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}
