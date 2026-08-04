import type { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

import { calcularEstadoCuenta } from '@nutria/shared';

import { prisma } from '@/server/db';
import { ErrorCode, internalError, jsonError, unauthenticated } from '@/server/http';
import { logger } from '@/server/logger';

import { auth } from './index';

export type SesionValida = { ok: true; sesion: Session; userId: string };
export type SesionInvalida = { ok: false; respuesta: NextResponse };
export type ResultadoSesion = SesionValida | SesionInvalida;

export type SesionPaciente = {
  ok: true;
  sesion: Session;
  userId: string;
  patientId: string;
};
export type ResultadoSesionPaciente = SesionPaciente | SesionInvalida;

/**
 * Guarda de autorización para los handlers de `/api/v1`.
 *
 * Cada endpoint la invoca aunque el middleware ya proteja la ruta: el middleware
 * cubre la navegación del panel, no las llamadas directas a la API.
 */
export async function requiereNutriologo(): Promise<ResultadoSesion> {
  const sesion = await auth();

  if (!sesion?.user?.id) {
    return { ok: false, respuesta: unauthenticated() };
  }

  let usuario;
  try {
    usuario = await prisma.user.findFirst({
      where: { id: sesion.user.id, deletedAt: null },
      select: {
        emailVerified: true,
        role: true,
        subscription: { select: { accessExpiresAt: true } },
      },
    });
  } catch (error: unknown) {
    logger.error('Falló la validación de la sesión contra la base de datos', error);
    return { ok: false, respuesta: internalError() };
  }
  if (!usuario) {
    return { ok: false, respuesta: unauthenticated() };
  }

  if (!usuario.emailVerified) {
    return {
      ok: false,
      respuesta: jsonError(
        403,
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Confirma tu correo para poder usar la plataforma.',
      ),
    };
  }

  if (
    usuario.role !== 'NUTRITIONIST' &&
    usuario.role !== 'ADMIN' &&
    usuario.role !== 'SUPERADMIN'
  ) {
    return {
      ok: false,
      respuesta: jsonError(
        403,
        ErrorCode.FORBIDDEN,
        'Tu cuenta no tiene acceso al panel de nutriólogo.',
      ),
    };
  }

  if (
    usuario.role === 'NUTRITIONIST' &&
    (!usuario.subscription ||
      calcularEstadoCuenta(usuario.subscription.accessExpiresAt) === 'BLOQUEADA')
  ) {
    return {
      ok: false,
      respuesta: jsonError(
        403,
        ErrorCode.ACCOUNT_INACTIVE,
        'Tu cuenta no está activa. Contacta al equipo de nutria para renovarla.',
      ),
    };
  }

  return { ok: true, sesion, userId: sesion.user.id };
}

/** Guarda para operaciones internas que solo puede ejecutar el superadmin. */
export async function requiereSuperAdmin(): Promise<ResultadoSesion> {
  const sesion = await auth();

  if (!sesion?.user?.id) {
    return { ok: false, respuesta: unauthenticated() };
  }

  let usuario;
  try {
    usuario = await prisma.user.findFirst({
      where: { id: sesion.user.id, deletedAt: null },
      select: { emailVerified: true, role: true },
    });
  } catch (error: unknown) {
    logger.error('Falló la validación de la sesión del superadmin', error);
    return { ok: false, respuesta: internalError() };
  }

  if (!usuario) return { ok: false, respuesta: unauthenticated() };

  if (!usuario.emailVerified || usuario.role !== 'SUPERADMIN') {
    return {
      ok: false,
      respuesta: jsonError(
        403,
        ErrorCode.FORBIDDEN,
        'Tu cuenta no tiene acceso al panel de superadmin.',
      ),
    };
  }

  return { ok: true, sesion, userId: sesion.user.id };
}

/** Un solo mensaje para todos los rechazos: distinguirlos revelaría el estado del expediente. */
const SIN_ACCESO_PACIENTE = 'Tu cuenta no tiene acceso a la app del paciente.';

/**
 * Guarda de autorización para los handlers de `/api/v1/me/*` (app del paciente).
 *
 * Devuelve el `patientId` **resuelto en el servidor** a partir de la sesión.
 * Regla innegociable del plan (§6.2): ningún endpoint de la app del paciente
 * acepta un `patient_id` del cliente; si una ruta lo recibiera, se compara
 * contra este y se responde 403 ante discrepancia.
 *
 * Un expediente archivado o borrado pierde el acceso, no los datos: el
 * nutriólogo sigue viéndolo en su panel.
 */
export async function requierePaciente(): Promise<ResultadoSesionPaciente> {
  const sesion = await auth();

  if (!sesion?.user?.id) {
    return { ok: false, respuesta: unauthenticated() };
  }

  let usuario;
  try {
    usuario = await prisma.user.findFirst({
      where: { id: sesion.user.id, deletedAt: null },
      select: {
        role: true,
        patientAccount: { select: { id: true, estado: true, deletedAt: true } },
      },
    });
  } catch (error: unknown) {
    logger.error('Falló la validación de la sesión del paciente', error);
    return { ok: false, respuesta: internalError() };
  }
  if (!usuario) {
    return { ok: false, respuesta: unauthenticated() };
  }

  if (usuario.role !== 'END_USER') {
    return {
      ok: false,
      respuesta: jsonError(403, ErrorCode.FORBIDDEN, SIN_ACCESO_PACIENTE),
    };
  }

  const paciente = usuario.patientAccount;
  if (!paciente || paciente.deletedAt || paciente.estado !== 'ACTIVO') {
    return {
      ok: false,
      respuesta: jsonError(403, ErrorCode.FORBIDDEN, SIN_ACCESO_PACIENTE),
    };
  }

  return { ok: true, sesion, userId: sesion.user.id, patientId: paciente.id };
}
