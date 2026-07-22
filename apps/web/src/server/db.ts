import { PrismaClient } from '@prisma/client';

// El log de queries incluiría parámetros con datos de salud, por eso solo se
// registran errores y advertencias (regla del proyecto: nunca loggear datos
// clínicos en texto plano).
const PRISMA_LOG = ['error', 'warn'] as const;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Cliente único: en desarrollo el hot reload crearía una conexión por recarga. */
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: [...PRISMA_LOG] });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
