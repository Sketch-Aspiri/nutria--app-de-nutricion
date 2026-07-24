import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pacientes = await prisma.patient.findMany({
    select: {
      id: true,
      nombre: true,
      fechaNacimiento: true,
      genero: true,
      estado: true,
      measurements: {
        orderBy: { fecha: 'desc' },
        take: 1,
      },
    },
  });
  console.dir(pacientes, { depth: null });
}

main().finally(() => prisma.$disconnect());
