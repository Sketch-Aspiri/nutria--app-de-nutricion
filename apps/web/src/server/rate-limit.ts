type Ventana = { conteo: number; expiraEn: number };

const ventanas = new Map<string, Ventana>();

/**
 * Límite de peticiones por clave, best-effort.
 *
 * Vive en memoria del proceso: en serverless cada instancia lleva su propia
 * cuenta, así que frena bucles de abuso simples pero no un ataque distribuido.
 * La fase 8 lo reemplaza por @upstash/ratelimit (Redis compartido).
 */
export function rateLimit(
  clave: string,
  maxPeticiones: number,
  ventanaMs: number,
): { permitido: boolean; reintentarEnSegundos: number } {
  const ahora = Date.now();
  const actual = ventanas.get(clave);

  if (!actual || actual.expiraEn <= ahora) {
    ventanas.set(clave, { conteo: 1, expiraEn: ahora + ventanaMs });
    return { permitido: true, reintentarEnSegundos: 0 };
  }

  if (actual.conteo >= maxPeticiones) {
    return {
      permitido: false,
      reintentarEnSegundos: Math.ceil((actual.expiraEn - ahora) / 1000),
    };
  }

  actual.conteo += 1;
  return { permitido: true, reintentarEnSegundos: 0 };
}

/** IP del cliente detrás del proxy de Vercel. */
export function ipDe(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'desconocida';
}
