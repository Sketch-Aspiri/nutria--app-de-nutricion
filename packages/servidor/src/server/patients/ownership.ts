import { prisma } from '@/server/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esIdValido(id: string): boolean {
  return UUID.test(id);
}

/**
 * Comprobación de pertenencia del paciente, compartida por los módulos que
 * cuelgan de él (mensajes, seguimiento, agenda).
 *
 * Se resuelve dentro de una sola consulta filtrada por `nutritionistId`: leer
 * el paciente y comparar después dejaría una ventana en la que el filtro se
 * olvida. Quien llama traduce el `null` a 404, nunca a 403 — distinguirlos
 * revelaría qué identificadores existen.
 */
export async function pacientePropio(
  nutritionistId: string,
  patientId: string,
): Promise<{ id: string } | null> {
  if (!esIdValido(patientId)) return null;

  return prisma.patient.findFirst({
    where: { id: patientId, nutritionistId, deletedAt: null },
    select: { id: true },
  });
}

/** Zona horaria del consultorio; define el día natural del seguimiento. */
export async function zonaHorariaDe(nutritionistId: string): Promise<string> {
  const perfil = await prisma.nutritionistProfile.findUnique({
    where: { userId: nutritionistId },
    select: { zonaHoraria: true },
  });
  return perfil?.zonaHoraria ?? 'America/Mexico_City';
}
