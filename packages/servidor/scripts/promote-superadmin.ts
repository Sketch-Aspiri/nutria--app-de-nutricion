import { prisma } from '../src/server/db';

function emailDelArgumento(): string {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Indica el correo de la cuenta que se promoverá a SUPERADMIN.');
  }
  return email;
}

async function main(): Promise<void> {
  const email = emailDelArgumento();
  await prisma.user.update({
    where: { email },
    data: { role: 'SUPERADMIN' },
    select: { id: true },
  });
  console.info('La cuenta fue promovida a SUPERADMIN. Cierra y vuelve a iniciar sesión.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'No se pudo promover la cuenta.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
