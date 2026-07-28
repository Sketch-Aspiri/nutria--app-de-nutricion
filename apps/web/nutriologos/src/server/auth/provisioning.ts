import { prisma } from '@/server/db';

/**
 * Toda cuenta de nutriólogo necesita perfil (para la marca blanca) y una
 * suscripción en plan Free. Se ejecuta tanto en el alta con contraseña como
 * en el primer inicio de sesión con Google, por eso es idempotente.
 */
export async function asegurarCuentaNutriologo(
  userId: string,
  nombreCompleto: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.nutritionistProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, nombreCompleto },
    }),
    prisma.subscription.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
  ]);
}
