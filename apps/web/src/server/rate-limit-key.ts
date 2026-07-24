import { createHmac } from 'node:crypto';

/** La clave distribuida nunca contiene correo, IP ni UUID en texto claro. */
export function pseudonymizeRateLimitKey(key: string): string {
  const secret =
    process.env.RATE_LIMIT_HASH_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim();
  return createHmac('sha256', secret || 'nutria-local-only')
    .update(key)
    .digest('base64url');
}
