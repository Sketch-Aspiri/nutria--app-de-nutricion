import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '@/server/db';

const TOKEN_BYTES = 32;
export const VERIFICACION_VALIDA_HORAS = 24;
export const RESET_VALIDO_HORAS = 1;

/**
 * En la base solo se guarda el SHA-256 del token: quien lea la tabla no puede
 * usar los enlaces. SHA-256 basta porque el token es aleatorio de 256 bits
 * (no hay ataque de diccionario posible, a diferencia de una contraseña).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generarToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function comparaHashes(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function expiraEn(horas: number): Date {
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

/** Invalida los tokens anteriores del usuario y emite uno nuevo. */
export async function crearTokenVerificacion(userId: string): Promise<string> {
  const { token, tokenHash } = generarToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt: expiraEn(VERIFICACION_VALIDA_HORAS) },
    }),
  ]);
  return token;
}

export type ResultadoVerificacion =
  | { ok: true; userId: string }
  | { ok: false; motivo: 'invalido' | 'expirado' };

/**
 * Marca el token como usado y el correo como verificado en una sola transacción,
 * de modo que un doble click en el enlace no deje estados a medias.
 */
export async function consumirTokenVerificacion(token: string): Promise<ResultadoVerificacion> {
  const registro = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!registro || registro.usedAt) return { ok: false, motivo: 'invalido' };
  if (registro.expiresAt.getTime() < Date.now()) return { ok: false, motivo: 'expirado' };

  const ahora = new Date();
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: registro.id },
      data: { usedAt: ahora },
    }),
    prisma.user.update({
      where: { id: registro.userId },
      data: { emailVerified: ahora },
    }),
  ]);

  return { ok: true, userId: registro.userId };
}
