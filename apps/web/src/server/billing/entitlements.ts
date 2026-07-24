import type { Subscription } from '@prisma/client';

import {
  type Entitlements,
  type EstadoSuscripcion,
  calcularEntitlements,
  mesDeUso,
} from '@nutria/shared';

import { prisma } from '@/server/db';

import { modoFacturacion } from './config';

/**
 * Qué puede hacer un usuario ahora mismo (punto 5 de la sección 9 del plan V2).
 *
 * Los handlers preguntan aquí antes de crear un paciente o de generar con IA.
 * El plan se lee siempre de `subscriptions` —la tabla que gobierna el webhook—
 * y nunca de la sesión ni del cliente: un JWT vive 8 horas, y una cancelación
 * no puede tardar 8 horas en surtir efecto.
 */

export type EstadoSuscripcionUsuario = {
  plan: Entitlements['plan'];
  estado: EstadoSuscripcion;
  periodoFin: Date | null;
  cancelaAlFinal: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
};

const SIN_SUSCRIPCION: EstadoSuscripcionUsuario = {
  plan: 'FREE',
  estado: 'ACTIVE',
  periodoFin: null,
  cancelaAlFinal: false,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
};

function desdeFila(fila: Subscription | null): EstadoSuscripcionUsuario {
  // Sin fila el usuario es Free activo: el alta la crea, pero una cuenta vieja
  // o migrada no puede quedarse sin acceso por un `null`.
  if (!fila) return SIN_SUSCRIPCION;
  return {
    plan: fila.plan,
    estado: fila.status,
    periodoFin: fila.currentPeriodEnd,
    cancelaAlFinal: fila.cancelAtPeriodEnd,
    stripeCustomerId: fila.stripeCustomerId,
    stripeSubscriptionId: fila.stripeSubscriptionId,
    stripePriceId: fila.stripePriceId,
  };
}

export async function estadoSuscripcion(userId: string): Promise<EstadoSuscripcionUsuario> {
  return desdeFila(await prisma.subscription.findUnique({ where: { userId } }));
}

export type EntitlementsConEstado = Entitlements & {
  suscripcion: EstadoSuscripcionUsuario;
};

/**
 * Los tres contadores se consultan en paralelo porque ninguno depende del otro
 * y esta función corre en la ruta caliente de crear paciente.
 */
export async function getEntitlements(
  userId: string,
  ahora = new Date(),
): Promise<EntitlementsConEstado> {
  const [fila, pacientesActivos, plantillasGuardadas, uso] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.patient.count({
      where: { nutritionistId: userId, estado: 'ACTIVO', deletedAt: null },
    }),
    prisma.planTemplate.count({ where: { nutritionistId: userId } }),
    prisma.aiUsage.findUnique({
      where: { userId_mes: { userId, mes: mesDeUso(ahora) } },
      select: { generaciones: true },
    }),
  ]);

  const suscripcion = desdeFila(fila);
  const entitlements = calcularEntitlements({
    plan: suscripcion.plan,
    estado: suscripcion.estado,
    modo: modoFacturacion(),
    pacientesActivos,
    plantillasGuardadas,
    generacionesIaDelMes: uso?.generaciones ?? 0,
  });

  return { ...entitlements, suscripcion };
}
