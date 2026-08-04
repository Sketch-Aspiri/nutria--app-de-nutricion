import { redirect } from 'next/navigation';

import { SuperAdminShell } from '@/components/superadmin/SuperAdminShell';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user?.id) redirect('/login');

  const usuario = await prisma.user.findFirst({
    where: { id: sesion.user.id, deletedAt: null },
    select: { emailVerified: true, role: true },
  });

  if (!usuario) redirect('/login');
  if (!usuario.emailVerified) redirect('/verificar');
  if (usuario.role !== 'SUPERADMIN') redirect('/inicio');

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
