import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

const BCRYPT_ROUNDS = 12;

export const PASSWORD_MIN = 10;
/** bcrypt ignora los bytes después del 72: se rechaza antes en vez de truncar en silencio. */
export const PASSWORD_MAX = 72;

/** Se prioriza longitud sobre reglas de composición (recomendación NIST 800-63B). */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `La contraseña no puede exceder ${PASSWORD_MAX} caracteres.`);

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_ROUNDS);
}

/** Devuelve false ante hash ausente o corrupto en vez de lanzar. */
export async function verifyPassword(plain: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) return false;
  try {
    return await compare(plain, passwordHash);
  } catch {
    return false;
  }
}

/** Normaliza el correo para que el índice único no dependa de mayúsculas ni espacios. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
