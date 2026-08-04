import { redirect } from 'next/navigation';

import { calcularEstadoCuenta } from '@nutria/shared';

import { PanelShell } from '@/components/layout/PanelShell';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';

/**
 * Segunda barrera de acceso al panel. El middleware ya bloquea estas rutas,
 * pero la sesión se revalida aquí en el servidor: una regla de matcher mal
 * escrita no debe traducirse en expedientes visibles.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await auth();

  if (!sesion?.user) redirect('/login');
  if (!sesion.user.emailVerificado) redirect('/verificar');

  const usuario = await prisma.user.findFirst({
    where: { id: sesion.user.id, deletedAt: null },
    select: {
      role: true,
      subscription: { select: { accessExpiresAt: true } },
    },
  });
  if (!usuario) redirect('/login');
  if (usuario.role === 'END_USER') redirect('/login');
  if (
    usuario.role === 'NUTRITIONIST' &&
    (!usuario.subscription ||
      calcularEstadoCuenta(usuario.subscription.accessExpiresAt) === 'BLOQUEADA')
  ) {
    redirect('/cuenta-inactiva');
  }

  return <PanelShell>{children}</PanelShell>;
}
