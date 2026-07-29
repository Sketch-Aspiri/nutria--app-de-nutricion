import { createHash } from 'node:crypto';

/**
 * Fotos de comida del paciente, en Vercel Blob.
 *
 * Mismo criterio que el logo de marca (`profile/logoStorage.ts`): el tipo se
 * decide por los bytes, no por el `Content-Type` que manda el cliente; la ruta
 * la construye el servidor a partir del `patientId` resuelto en la sesión; y la
 * URL devuelta se valida antes de persistirse, para que un adaptador
 * comprometido no pueda inyectar una dirección arbitraria en `meal_logs`.
 */

export const MAX_FOTO_BYTES = 5 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST_BLOB_PUBLICO = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;
const TIMEOUT_BLOB_MS = 10_000;
const CARPETA = 'meal-photos';

export type TipoFoto = { extension: 'jpg' | 'png' | 'webp'; contentType: string };

export type AdaptadorFotoBlob = {
  subir: (
    pathname: string,
    bytes: Buffer,
    opciones: { abortSignal: AbortSignal; contentType: string },
  ) => Promise<{ url: string }>;
};

export class FotoStorageError extends Error {
  constructor() {
    super('El almacenamiento de fotos no está disponible.');
    this.name = 'FotoStorageError';
  }
}

const adaptadorVercel: AdaptadorFotoBlob = {
  async subir(pathname, bytes, opciones) {
    const { put } = await import('@vercel/blob');
    return put(pathname, bytes, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      abortSignal: opciones.abortSignal,
      cacheControlMaxAge: 31_536_000,
      contentType: opciones.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  },
};

/**
 * Identifica el formato por su firma binaria.
 *
 * Un `Content-Type: image/jpeg` sobre un HTML o un SVG con script sería un XSS
 * almacenado servido desde el dominio del blob; los bytes no mienten.
 */
export function tipoDeFoto(bytes: Buffer): TipoFoto | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return null;
}

/** Solo se acepta una URL de la carpeta que controla esta aplicación. */
export function esUrlFotoSegura(raw: string, patientId?: string): boolean {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      !HOST_BLOB_PUBLICO.test(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    const segmentos = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (
      segmentos.length !== 3 ||
      segmentos[0] !== CARPETA ||
      !UUID.test(segmentos[1] ?? '') ||
      !/^comida-[a-f0-9]{24}\.(?:jpg|png|webp)$/i.test(segmentos[2] ?? '')
    ) {
      return false;
    }
    return !patientId || segmentos[1]?.toLowerCase() === patientId.toLowerCase();
  } catch {
    return false;
  }
}

export type ResultadoSubida =
  | { ok: true; url: string }
  | { ok: false; motivo: 'vacia' | 'muy_grande' | 'formato_no_soportado' | 'almacenamiento' };

/**
 * Sube una foto de comida y devuelve su URL pública.
 *
 * El nombre es el hash del contenido: subir dos veces la misma foto no
 * multiplica el almacenamiento, y el nombre no filtra nada del paciente.
 */
export async function subirFotoComida(
  patientId: string,
  bytes: Buffer,
  adaptador: AdaptadorFotoBlob = adaptadorVercel,
): Promise<ResultadoSubida> {
  if (!UUID.test(patientId)) return { ok: false, motivo: 'almacenamiento' };
  if (bytes.length === 0) return { ok: false, motivo: 'vacia' };
  if (bytes.length > MAX_FOTO_BYTES) return { ok: false, motivo: 'muy_grande' };

  const tipo = tipoDeFoto(bytes);
  if (!tipo) return { ok: false, motivo: 'formato_no_soportado' };

  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_BLOB_MS);

  try {
    const resultado = await adaptador.subir(
      `${CARPETA}/${patientId}/comida-${hash}.${tipo.extension}`,
      bytes,
      { abortSignal: controller.signal, contentType: tipo.contentType },
    );
    if (!esUrlFotoSegura(resultado.url, patientId)) {
      return { ok: false, motivo: 'almacenamiento' };
    }
    return { ok: true, url: resultado.url };
  } catch {
    return { ok: false, motivo: 'almacenamiento' };
  } finally {
    clearTimeout(timeout);
  }
}
