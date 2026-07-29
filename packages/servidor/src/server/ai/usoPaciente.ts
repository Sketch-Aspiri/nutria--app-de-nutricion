import {
  type CuotaIA,
  type CuotaPaciente,
  LIMITE_INTERACCIONES_IA_PACIENTE,
  calcularCuotaPaciente,
  mesDeUso,
} from '@nutria/shared';

import { prisma } from '@/server/db';

import { devolverGeneracion, reservarGeneracion } from './uso';

/**
 * Contabilidad de la IA del paciente: dos topes, no uno (§8.5 del plan).
 *
 * 1. **La clínica paga.** El consumo se descuenta de la cuota mensual del
 *    nutriólogo dueño del expediente, que es quien tiene la suscripción. El
 *    paciente no tiene plan que consultar.
 * 2. **El paciente no puede agotarla.** Encima va un tope propio de
 *    `LIMITE_INTERACCIONES_IA_PACIENTE` al mes, para que un solo paciente no se
 *    lleve la cuota de todo el consultorio.
 *
 * Los dos contadores viven en `ai_usage`, cada uno bajo su `user_id`: el
 * paciente tiene fila en `users` desde que activa su cuenta (fase 3), así que no
 * hizo falta una tabla nueva. Lo que se guarda en cada fila sí difiere:
 *
 * | Fila | `generaciones` | `tokens_*` |
 * |---|---|---|
 * | Nutriólogo | sí (es su cuota) | sí (es su gasto) |
 * | Paciente | sí (es su tope) | no |
 *
 * Los tokens se anotan una sola vez, en la fila de quien paga: sumarlos también
 * en la del paciente haría que el gasto del mes se contara doble.
 */

export type CuotasIaPaciente = {
  /** Tope propio del paciente. Es el único que se le muestra en la app. */
  paciente: CuotaPaciente;
  /** Cuota del consultorio. No viaja al cliente: no es asunto del paciente. */
  clinica: CuotaIA;
};

/**
 * Resultado de la reserva, como valor y no como excepción: quién rechazó
 * determina qué se le dice al paciente ("ya usaste tus 30 consultas del mes" no
 * es lo mismo que "tu nutrióloga agotó la cuota de su plan").
 */
export type ReservaIa =
  | { ok: true; cuotas: CuotasIaPaciente }
  | { ok: false; motivo: 'paciente'; cuota: CuotaPaciente }
  | { ok: false; motivo: 'clinica'; cuota: CuotaIA };

/** Usuario del nutriólogo dueño del expediente: contra él se cobra el consumo. */
export async function nutriologoDelPaciente(patientId: string): Promise<string | null> {
  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: { nutritionistId: true },
  });
  return paciente?.nutritionistId ?? null;
}

/** Consulta el tope del paciente sin modificarlo. */
export async function consultarCuotaPaciente(
  userId: string,
  ahora = new Date(),
): Promise<CuotaPaciente> {
  const registro = await prisma.aiUsage.findUnique({
    where: { userId_mes: { userId, mes: mesDeUso(ahora) } },
    select: { generaciones: true },
  });
  return calcularCuotaPaciente(registro?.generaciones ?? 0);
}

/**
 * Reserva una interacción contra los dos topes antes de llamar al proveedor.
 *
 * El del paciente se cobra primero: es el más barato de comprobar y el que más
 * veces va a rechazar. El contador sube *antes* de la llamada, en una sola
 * sentencia atómica, para que dos pestañas simultáneas no puedan pasarse del
 * tope; si algo falla después, `devolverInteraccion` lo reembolsa.
 */
export async function reservarInteraccion(
  userId: string,
  nutritionistId: string,
  ahora = new Date(),
): Promise<ReservaIa> {
  const mes = mesDeUso(ahora);
  const registro = await prisma.aiUsage.upsert({
    where: { userId_mes: { userId, mes } },
    create: { userId, mes, generaciones: 1 },
    update: { generaciones: { increment: 1 } },
    select: { generaciones: true },
  });

  if (registro.generaciones > LIMITE_INTERACCIONES_IA_PACIENTE) {
    await devolverInteraccion(userId, ahora);
    return {
      ok: false,
      motivo: 'paciente',
      cuota: calcularCuotaPaciente(LIMITE_INTERACCIONES_IA_PACIENTE),
    };
  }

  const { permitida, cuota } = await reservarGeneracion(nutritionistId, ahora);
  if (!permitida) {
    // La reserva del paciente se deshace: no llegó a consumirse nada.
    await devolverInteraccion(userId, ahora);
    return { ok: false, motivo: 'clinica', cuota };
  }

  return {
    ok: true,
    cuotas: { paciente: calcularCuotaPaciente(registro.generaciones), clinica: cuota },
  };
}

/** Reembolsa una interacción reservada que no llegó a producir respuesta. */
export async function devolverInteraccion(userId: string, ahora = new Date()): Promise<void> {
  await prisma.aiUsage.updateMany({
    // El filtro evita que un doble reembolso deje el contador en negativo.
    where: { userId, mes: mesDeUso(ahora), generaciones: { gt: 0 } },
    data: { generaciones: { decrement: 1 } },
  });
}

/** Deshace la reserva completa: la del paciente y la de la clínica. */
export async function devolverInteraccionCompleta(
  userId: string,
  nutritionistId: string,
  ahora = new Date(),
): Promise<void> {
  await Promise.all([
    devolverInteraccion(userId, ahora),
    devolverGeneracion(nutritionistId, ahora),
  ]);
}
