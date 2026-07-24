import { prisma } from '@/server/db';
import { enviarRecordatorioCita } from '@/server/email';
import { logger } from '@/server/logger';

/**
 * Recordatorios de cita.
 *
 * El cron corre cada 15 minutos y avisa de las citas que empiezan dentro de la
 * ventana. `recordatorio_enviado_at` es la marca de idempotencia: una corrida
 * repetida —o dos regiones ejecutando el mismo cron— no vuelve a escribirle al
 * paciente.
 */

/** Se avisa con un día de anticipación. */
export const HORAS_ANTICIPACION = 24;

/** Tope por corrida: si la cola crece, se drena en las siguientes ejecuciones. */
export const MAX_RECORDATORIOS_POR_CORRIDA = 50;

export type ResultadoRecordatorios = {
  candidatas: number;
  enviados: number;
  sinCorreo: number;
  fallidos: number;
};

function formatearCuando(inicio: Date, zonaHoraria: string): string {
  const formato = new Intl.DateTimeFormat('es-MX', {
    timeZone: zonaHoraria,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `el ${formato.format(inicio)}`;
}

/**
 * Marca la cita como avisada **antes** de enviar.
 *
 * Si el proveedor falla, el paciente se queda sin recordatorio; si se marcara
 * después, un timeout tras un envío exitoso lo haría recibir el mismo correo
 * cada 15 minutos. Ante la duda, se prefiere el silencio al acoso.
 */
async function reservarEnvio(citaId: string): Promise<boolean> {
  const { count } = await prisma.appointment.updateMany({
    where: { id: citaId, recordatorioEnviadoAt: null },
    data: { recordatorioEnviadoAt: new Date() },
  });
  return count > 0;
}

export async function enviarRecordatoriosPendientes(
  ahora: Date = new Date(),
): Promise<ResultadoRecordatorios> {
  const limite = new Date(ahora.getTime() + HORAS_ANTICIPACION * 60 * 60 * 1000);

  const citas = await prisma.appointment.findMany({
    where: {
      estado: 'PROGRAMADA',
      recordatorioEnviadoAt: null,
      // Una cita que ya pasó no se recuerda: el aviso llegaría tarde y sonaría
      // a error del sistema.
      inicio: { gte: ahora, lte: limite },
      patient: { deletedAt: null },
    },
    orderBy: { inicio: 'asc' },
    take: MAX_RECORDATORIOS_POR_CORRIDA,
    include: {
      patient: { select: { nombre: true, email: true } },
      nutritionist: {
        select: {
          nutritionistProfile: {
            select: { nombreCompleto: true, marcaNombre: true, zonaHoraria: true },
          },
        },
      },
    },
  });

  const resultado: ResultadoRecordatorios = {
    candidatas: citas.length,
    enviados: 0,
    sinCorreo: 0,
    fallidos: 0,
  };

  for (const cita of citas) {
    const perfil = cita.nutritionist.nutritionistProfile;
    if (!cita.patient.email) {
      // Sin correo no hay a dónde avisar. Se marca igual para no reevaluarla
      // cada cuarto de hora hasta que la cita ocurra.
      await reservarEnvio(cita.id);
      resultado.sinCorreo += 1;
      continue;
    }

    if (!(await reservarEnvio(cita.id))) continue;

    const envio = await enviarRecordatorioCita({
      para: cita.patient.email,
      pacienteNombre: cita.patient.nombre,
      cuando: formatearCuando(cita.inicio, perfil?.zonaHoraria ?? 'America/Mexico_City'),
      tipo: cita.tipo,
      consultorio: perfil?.marcaNombre ?? perfil?.nombreCompleto ?? 'tu nutriólogo',
      videoUrl: cita.videoUrl,
    });

    if (envio.enviado) {
      resultado.enviados += 1;
      continue;
    }

    resultado.fallidos += 1;
    // Se devuelve a la cola: el fallo puede ser transitorio y la siguiente
    // corrida (15 minutos después) sigue estando a tiempo.
    await prisma.appointment.updateMany({
      where: { id: cita.id },
      data: { recordatorioEnviadoAt: null },
    });
    logger.warn('No se pudo enviar el recordatorio de cita', {
      operation: 'recordatorio_cita',
      code: envio.motivo,
    });
  }

  return resultado;
}
