import { z } from 'zod';

import { calcularEstadoCuenta, calcularNuevaExpiracionAlActivar } from '@nutria/shared';

import { prisma } from '@/server/db';

export const activarNutriologaSchema = z.object({
  activation_note: z.string().trim().max(300).optional(),
});

export const nutriologaIdSchema = z.object({ id: z.string().uuid() });

export type NutriologaAdminApi = {
  id: string;
  nombre: string;
  email: string;
  fecha_registro: string;
  plan: 'PRO' | 'CLINICA' | 'FREE';
  estado_cuenta: 'ACTIVA' | 'BLOQUEADA';
  acceso_expira: string | null;
  primer_mes_gratis: boolean;
  ultima_activacion: string | null;
  nota_activacion: string | null;
  gestionada_por_stripe: boolean;
};

export class NutriologaGestionadaPorStripeError extends Error {
  constructor() {
    super('Esta cuenta se gestiona desde Stripe y no admite activación manual.');
    this.name = 'NutriologaGestionadaPorStripeError';
  }
}

const selectNutriologa = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  nutritionistProfile: { select: { nombreCompleto: true } },
  subscription: {
    select: {
      plan: true,
      accessExpiresAt: true,
      lastActivatedAt: true,
      lastActivatedByUserId: true,
      activationNote: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  },
} as const;

type FilaNutriologa = Awaited<ReturnType<typeof buscarNutriologa>>;

function serializarNutriologa(
  usuario: NonNullable<FilaNutriologa>,
  ahora: Date,
): NutriologaAdminApi {
  const suscripcion = usuario.subscription;
  return {
    id: usuario.id,
    nombre: usuario.nutritionistProfile?.nombreCompleto ?? usuario.name ?? 'Sin nombre',
    email: usuario.email,
    fecha_registro: usuario.createdAt.toISOString(),
    plan: suscripcion?.plan ?? 'PRO',
    estado_cuenta:
      suscripcion && calcularEstadoCuenta(suscripcion.accessExpiresAt, ahora) === 'ACTIVA'
        ? 'ACTIVA'
        : 'BLOQUEADA',
    acceso_expira: suscripcion?.accessExpiresAt.toISOString() ?? null,
    primer_mes_gratis: suscripcion?.lastActivatedByUserId == null,
    ultima_activacion: suscripcion?.lastActivatedAt?.toISOString() ?? null,
    nota_activacion: suscripcion?.activationNote ?? null,
    gestionada_por_stripe:
      suscripcion?.stripeCustomerId != null || suscripcion?.stripeSubscriptionId != null,
  };
}

async function buscarNutriologa(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: 'NUTRITIONIST', deletedAt: null },
    select: selectNutriologa,
  });
}

export async function listarNutriologas(
  skip: number,
  take: number,
  ahora: Date = new Date(),
): Promise<{
  data: NutriologaAdminApi[];
  total: number;
  activas: number;
  bloqueadas: number;
}> {
  const [usuarios, total, activas] = await prisma.$transaction([
    prisma.user.findMany({
      where: { role: 'NUTRITIONIST', deletedAt: null },
      select: selectNutriologa,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where: { role: 'NUTRITIONIST', deletedAt: null } }),
    prisma.subscription.count({
      where: {
        accessExpiresAt: { gt: ahora },
        user: { role: 'NUTRITIONIST', deletedAt: null },
      },
    }),
  ]);

  return {
    data: usuarios.map((usuario) => serializarNutriologa(usuario, ahora)),
    total,
    activas,
    bloqueadas: total - activas,
  };
}

export async function activarNutriologa(
  userId: string,
  superAdminUserId: string,
  activationNote: string | undefined,
  ahora: Date = new Date(),
): Promise<NutriologaAdminApi | null> {
  const accessExpiresAt = calcularNuevaExpiracionAlActivar(ahora);
  const nota = activationNote?.trim() || null;

  const actualizada = await prisma.$transaction(async (tx) => {
    const usuario = await tx.user.findFirst({
      where: { id: userId, role: 'NUTRITIONIST', deletedAt: null },
      select: { id: true },
    });
    if (!usuario) return null;

    await tx.subscription.upsert({
      where: { userId },
      create: { userId, plan: 'PRO', accessExpiresAt },
      update: {},
      select: { id: true },
    });
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "subscriptions" WHERE "user_id" = ${userId}::uuid FOR UPDATE
    `;
    const anterior = await tx.subscription.findUniqueOrThrow({
      where: { userId },
      select: {
        id: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        accessExpiresAt: true,
      },
    });
    if (anterior.stripeCustomerId || anterior.stripeSubscriptionId) {
      throw new NutriologaGestionadaPorStripeError();
    }

    const suscripcion = await tx.subscription.update({
      where: { userId },
      data: {
        plan: 'PRO',
        status: 'ACTIVE',
        accessExpiresAt,
        lastActivatedAt: ahora,
        lastActivatedByUserId: superAdminUserId,
        activationNote: nota,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        userId: superAdminUserId,
        accion: 'subscription.manual_activation',
        recurso: 'subscription',
        recursoId: suscripcion.id,
        metadata: {
          target_user_id: userId,
          previous_access_expires_at: anterior.accessExpiresAt.toISOString(),
          new_access_expires_at: accessExpiresAt.toISOString(),
          note_present: nota !== null,
        },
      },
    });

    return tx.user.findFirst({
      where: { id: userId, role: 'NUTRITIONIST', deletedAt: null },
      select: selectNutriologa,
    });
  });

  return actualizada ? serializarNutriologa(actualizada, ahora) : null;
}
