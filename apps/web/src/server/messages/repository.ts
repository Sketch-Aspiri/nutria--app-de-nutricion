import type { Message } from '@prisma/client';

import { prisma } from '@/server/db';
import { pacientePropio } from '@/server/patients/ownership';

import type { EnviarMensajeInput, FiltroMensajesInput } from './schemas';
import type { ConversacionCruda } from './serializers';

export type ResultadoHilo = {
  mensajes: Message[];
  total: number;
};

export async function listarHilo(
  nutritionistId: string,
  patientId: string,
  paginacion: { skip: number; take: number },
  filtros: FiltroMensajesInput,
): Promise<ResultadoHilo | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  // El sondeo incremental se ancla al `created_at` del mensaje que el cliente
  // ya tiene; si ese id no existe (hilo borrado, cliente viejo) se devuelve el
  // hilo completo en vez de un vacío engañoso.
  let posteriorA: Date | null = null;
  if (filtros.desde_id) {
    const ancla = await prisma.message.findFirst({
      where: { id: filtros.desde_id, nutritionistId, patientId },
      select: { createdAt: true },
    });
    posteriorA = ancla?.createdAt ?? null;
  }

  const where = {
    patientId,
    nutritionistId,
    ...(posteriorA ? { createdAt: { gt: posteriorA } } : {}),
  };

  const [mensajes, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: paginacion.skip,
      take: paginacion.take,
    }),
    prisma.message.count({ where }),
  ]);

  return { mensajes, total };
}

export async function enviarMensaje(
  nutritionistId: string,
  patientId: string,
  datos: EnviarMensajeInput,
): Promise<Message | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  return prisma.message.create({
    data: {
      nutritionistId,
      patientId,
      // El emisor lo fija el servidor a partir de la sesión: aceptarlo del
      // cuerpo dejaría al nutriólogo escribir mensajes en nombre del paciente.
      emisor: 'NUTRITIONIST',
      texto: datos.texto,
      // Lo que uno mismo escribe nace leído.
      leidoAt: new Date(),
    },
  });
}

/** Marca como leídos los mensajes que mandó el paciente. Devuelve cuántos. */
export async function marcarHiloLeido(
  nutritionistId: string,
  patientId: string,
): Promise<number | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  const { count } = await prisma.message.updateMany({
    where: { nutritionistId, patientId, emisor: 'PATIENT', leidoAt: null },
    data: { leidoAt: new Date() },
  });
  return count;
}

/**
 * Bandeja de conversaciones: todos los pacientes activos, con su última línea
 * y sus pendientes.
 *
 * Incluye a los pacientes que aún no tienen mensajes — la bandeja es también
 * el punto desde donde se inicia una conversación.
 */
export async function listarConversaciones(
  nutritionistId: string,
): Promise<ConversacionCruda[]> {
  const pacientes = await prisma.patient.findMany({
    where: { nutritionistId, deletedAt: null, estado: 'ACTIVO' },
    select: {
      id: true,
      nombre: true,
      fotoUrl: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { texto: true, emisor: true, createdAt: true },
      },
    },
    orderBy: { nombre: 'asc' },
  });

  // Un `groupBy` acotado a los no leídos evita traer los hilos completos solo
  // para contar.
  const pendientes = await prisma.message.groupBy({
    by: ['patientId'],
    where: { nutritionistId, emisor: 'PATIENT', leidoAt: null },
    _count: { _all: true },
  });
  const sinLeerPorPaciente = new Map(
    pendientes.map((fila) => [fila.patientId, fila._count._all]),
  );

  const conversaciones = pacientes.map((paciente): ConversacionCruda => {
    const ultimo = paciente.messages[0];
    return {
      patientId: paciente.id,
      nombre: paciente.nombre,
      fotoUrl: paciente.fotoUrl,
      ultimoTexto: ultimo?.texto ?? null,
      ultimoEmisor: ultimo?.emisor ?? null,
      ultimoAt: ultimo?.createdAt ?? null,
      sinLeer: sinLeerPorPaciente.get(paciente.id) ?? 0,
    };
  });

  // Conversación más reciente primero; los pacientes sin mensajes, al final en
  // orden alfabético.
  return conversaciones.sort((a, b) => {
    if (a.ultimoAt && b.ultimoAt) return b.ultimoAt.getTime() - a.ultimoAt.getTime();
    if (a.ultimoAt) return -1;
    if (b.ultimoAt) return 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

/** Último mensaje del paciente en el hilo, para que la IA sepa qué contestar. */
export async function ultimoMensajeDelPaciente(
  nutritionistId: string,
  patientId: string,
): Promise<Message | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  return prisma.message.findFirst({
    where: { nutritionistId, patientId, emisor: 'PATIENT' },
    orderBy: { createdAt: 'desc' },
  });
}
