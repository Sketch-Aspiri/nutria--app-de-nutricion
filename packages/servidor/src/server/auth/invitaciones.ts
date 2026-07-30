import { Prisma } from '@prisma/client';

import { PRIVACY_NOTICE_VERSION } from '@/config/privacy';
import { recordAuditEvent } from '@/server/audit';
import { prisma } from '@/server/db';
import { esIdValido } from '@/server/patients/ownership';

import { hashPassword, normalizarEmail } from './password';
import { generarToken, hashToken, INVITACION_VALIDA_DIAS } from './tokens';

/**
 * Alta de la cuenta del paciente en la app `pacientes` (fase 3 del plan).
 *
 * El nutriólogo invita desde su panel; el paciente activa desde la otra app con
 * el token del correo. Las dos mitades viven aquí porque comparten el mismo
 * invariante: el token solo se guarda hasheado, caduca, se usa una sola vez y
 * su consumo enlaza `patients.user_id` dentro de una transacción.
 */

function expiraEnDias(dias: number): Date {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
}

export type MotivoInvitacionRechazada =
  | 'no_encontrado'
  | 'archivado'
  | 'sin_correo'
  | 'sin_consentimiento'
  | 'ya_vinculado';

export type InvitacionEmitida = {
  ok: true;
  token: string;
  email: string;
  expiraEn: Date;
  /** Datos que necesita el correo, leídos en la misma consulta con filtro de pertenencia. */
  pacienteNombre: string;
  consultorio: string;
};

export type ResultadoInvitacion =
  | InvitacionEmitida
  | { ok: false; motivo: MotivoInvitacionRechazada };

/**
 * Emite una invitación para el paciente indicado.
 *
 * La pertenencia se resuelve en la misma consulta que lee el expediente
 * (`nutritionistId` en el `where`), igual que el resto del repositorio: leer
 * primero y comparar después dejaría una ventana para olvidar el filtro.
 *
 * Reinvitar es válido y deseable —el correo se pierde, el enlace vence—, así
 * que cada emisión invalida las anteriores en lugar de rechazarse.
 */
export async function invitarPaciente(
  nutritionistId: string,
  patientId: string,
): Promise<ResultadoInvitacion> {
  if (!esIdValido(patientId)) return { ok: false, motivo: 'no_encontrado' };

  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, nutritionistId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      email: true,
      estado: true,
      userId: true,
      sensitiveDataConsentAt: true,
      nutritionist: { select: { name: true } },
    },
  });

  if (!paciente) return { ok: false, motivo: 'no_encontrado' };
  if (paciente.estado !== 'ACTIVO') return { ok: false, motivo: 'archivado' };
  // Ya tiene cuenta: quien perdió el acceso recupera contraseña, no se reinvita.
  if (paciente.userId) return { ok: false, motivo: 'ya_vinculado' };

  const email = paciente.email ? normalizarEmail(paciente.email) : '';
  if (!email) return { ok: false, motivo: 'sin_correo' };
  // Sin consentimiento de datos sensibles no hay base legal para darle acceso
  // a su propio expediente desde una segunda superficie.
  if (!paciente.sensitiveDataConsentAt) return { ok: false, motivo: 'sin_consentimiento' };

  const { token, tokenHash } = generarToken();
  const expiraEn = expiraEnDias(INVITACION_VALIDA_DIAS);

  await prisma.$transaction([
    prisma.patientInvite.updateMany({
      where: { patientId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.patientInvite.create({
      data: { patientId, tokenHash, email, expiresAt: expiraEn },
    }),
  ]);

  return {
    ok: true,
    token,
    email,
    expiraEn,
    pacienteNombre: paciente.nombre,
    consultorio: paciente.nutritionist.name ?? 'Tu profesional de nutrición',
  };
}

export type MotivoActivacionRechazada =
  | 'invalido'
  | 'expirado'
  | 'ya_vinculado'
  | 'paciente_inactivo'
  | 'correo_ocupado';

export type ResultadoActivacion =
  | {
      ok: true;
      userId: string;
      patientId: string;
      email: string;
      /** Consultorio que invitó, para el aviso interno de alta. Sin dato clínico. */
      consultorio: string;
    }
  | { ok: false; motivo: MotivoActivacionRechazada };

/**
 * Consume la invitación y crea la cuenta del paciente.
 *
 * Todo ocurre en una transacción: crear el usuario, enlazarlo al expediente y
 * quemar el token. Un doble clic en el enlace no puede dejar un usuario sin
 * paciente ni un token gastado sin cuenta.
 *
 * El correo se marca verificado en el acto: llegar aquí exige haber abierto un
 * enlace que solo existió en ese buzón.
 */
export async function activarCuentaPaciente(
  token: string,
  password: string,
): Promise<ResultadoActivacion> {
  const invitacion = await prisma.patientInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      usedAt: true,
      expiresAt: true,
      patient: {
        select: {
          id: true,
          userId: true,
          estado: true,
          deletedAt: true,
          nutritionist: { select: { name: true } },
        },
      },
    },
  });

  if (!invitacion || invitacion.usedAt) return { ok: false, motivo: 'invalido' };
  if (invitacion.expiresAt.getTime() < Date.now()) return { ok: false, motivo: 'expirado' };

  const paciente = invitacion.patient;
  if (paciente.userId) return { ok: false, motivo: 'ya_vinculado' };
  if (paciente.deletedAt || paciente.estado !== 'ACTIVO') {
    return { ok: false, motivo: 'paciente_inactivo' };
  }

  const email = normalizarEmail(invitacion.email);
  const passwordHash = await hashPassword(password);
  const ahora = new Date();

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const usuario = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'END_USER',
          emailVerified: ahora,
          privacyNoticeAcceptedAt: ahora,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        },
        select: { id: true },
      });

      // `where` con `userId: null` además del id: si otra petición ganó la
      // carrera, el update no afecta filas y la transacción se revierte.
      const enlazado = await tx.patient.updateMany({
        where: { id: paciente.id, userId: null, deletedAt: null },
        data: { userId: usuario.id },
      });
      if (enlazado.count === 0) throw new ConflictoDeEnlace();

      const consumido = await tx.patientInvite.updateMany({
        where: { id: invitacion.id, usedAt: null },
        data: { usedAt: ahora },
      });
      if (consumido.count === 0) throw new ConflictoDeEnlace();

      return usuario.id;
    });
  } catch (error: unknown) {
    if (error instanceof ConflictoDeEnlace) return { ok: false, motivo: 'ya_vinculado' };
    // P2002: el correo del expediente ya tiene cuenta en la plataforma.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, motivo: 'correo_ocupado' };
    }
    throw error;
  }

  await recordAuditEvent({
    userId,
    action: 'PATIENT_APP_ACCESS_ACTIVATED',
    resource: 'patient',
    resourceId: paciente.id,
  });

  return {
    ok: true,
    userId,
    patientId: paciente.id,
    email,
    consultorio: paciente.nutritionist.name ?? 'Sin nombre de consultorio',
  };
}

/** Señal interna para revertir la transacción cuando otra petición se adelantó. */
class ConflictoDeEnlace extends Error {
  constructor() {
    super('El paciente ya quedó vinculado a una cuenta.');
    this.name = 'ConflictoDeEnlace';
  }
}
