import type { SubscriptionPlan } from '@prisma/client';

import { type CuotaIA, calcularCuota, mesDeUso } from '@nutria/shared';

import { prisma } from '@/server/db';

import type { UsoTokens } from './cliente';

/**
 * Cuota mensual de generaciones de IA.
 *
 * El plan vigente se lee de `subscriptions` — nunca del cliente — y el consumo
 * se acumula en `ai_usage` por (usuario, mes). Solo se guardan contadores:
 * `ai_usage` no toca el contenido de los prompts ni de las respuestas.
 */

/** Sin fila en `subscriptions` (o con la suscripción cancelada) el plan es FREE. */
const PLANES_VIGENTES: ReadonlyArray<string> = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

export async function planDelUsuario(userId: string): Promise<SubscriptionPlan> {
  const suscripcion = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  if (!suscripcion || !PLANES_VIGENTES.includes(suscripcion.status)) return 'FREE';
  return suscripcion.plan;
}

/** Consulta la cuota del mes en curso sin modificarla. */
export async function consultarCuota(userId: string, ahora = new Date()): Promise<CuotaIA> {
  const mes = mesDeUso(ahora);
  const [plan, registro] = await Promise.all([
    planDelUsuario(userId),
    prisma.aiUsage.findUnique({
      where: { userId_mes: { userId, mes } },
      select: { generaciones: true },
    }),
  ]);
  return calcularCuota(plan, registro?.generaciones ?? 0);
}

/**
 * Reserva una generación antes de llamar al proveedor.
 *
 * El contador sube *antes* de la llamada, en una sola sentencia atómica, para
 * que dos pestañas simultáneas no puedan pasarse del límite. Si la generación
 * después falla, `devolverGeneracion` la reembolsa: es preferible cobrar de más
 * durante unos milisegundos que dejar un hueco por el que se cuele la cuota.
 */
export async function reservarGeneracion(
  userId: string,
  ahora = new Date(),
): Promise<{ permitida: boolean; cuota: CuotaIA }> {
  const mes = mesDeUso(ahora);
  const plan = await planDelUsuario(userId);

  const registro = await prisma.aiUsage.upsert({
    where: { userId_mes: { userId, mes } },
    create: { userId, mes, generaciones: 1 },
    update: { generaciones: { increment: 1 } },
    select: { generaciones: true },
  });

  const cuota = calcularCuota(plan, registro.generaciones);
  if (registro.generaciones > cuota.limite) {
    await devolverGeneracion(userId, ahora);
    return { permitida: false, cuota: calcularCuota(plan, cuota.limite) };
  }
  return { permitida: true, cuota };
}

/** Reembolsa una generación reservada que no llegó a producir resultado. */
export async function devolverGeneracion(userId: string, ahora = new Date()): Promise<void> {
  await prisma.aiUsage.updateMany({
    // El filtro evita que un doble reembolso deje el contador en negativo.
    where: { userId, mes: mesDeUso(ahora), generaciones: { gt: 0 } },
    data: { generaciones: { decrement: 1 } },
  });
}

/** Suma los tokens consumidos por una generación ya realizada. */
export async function registrarTokens(
  userId: string,
  uso: UsoTokens,
  ahora = new Date(),
): Promise<void> {
  await prisma.aiUsage.updateMany({
    where: { userId, mes: mesDeUso(ahora) },
    data: {
      tokensEntrada: { increment: uso.entrada },
      tokensSalida: { increment: uso.salida },
    },
  });
}
