import { createHash } from 'node:crypto';

import { MAX_BRAND_LOGO_BYTES } from '@/config/brandLogo';

import {
  logoSeguro,
  validarLogoBytes,
  validarLogoDataUrl,
} from './logoSafety';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST_BLOB_PUBLICO = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;
const TIMEOUT_BLOB_MS = 5_000;

type ResultadoLectura = {
  stream: ReadableStream<Uint8Array>;
  size: number;
};

export type AdaptadorLogoBlob = {
  subir: (
    pathname: string,
    bytes: Buffer,
    opciones: {
      abortSignal: AbortSignal;
      addRandomSuffix: boolean;
      allowOverwrite: boolean;
      cacheControlMaxAge: number;
      contentType: 'image/jpeg' | 'image/png';
    },
  ) => Promise<{ url: string }>;
  borrar: (url: string, abortSignal: AbortSignal) => Promise<void>;
  leer: (url: string, abortSignal: AbortSignal) => Promise<ResultadoLectura | null>;
};

export class LogoStorageError extends Error {
  constructor() {
    super('El almacenamiento de logos no está disponible.');
    this.name = 'LogoStorageError';
  }
}

export class LogoStorageInputError extends Error {
  constructor() {
    super('El cambio de logo no es válido para esta cuenta.');
    this.name = 'LogoStorageInputError';
  }
}

const adaptadorVercel: AdaptadorLogoBlob = {
  async subir(pathname, bytes, opciones) {
    const { put } = await import('@vercel/blob');
    return put(pathname, bytes, {
      access: 'public',
      addRandomSuffix: opciones.addRandomSuffix,
      allowOverwrite: opciones.allowOverwrite,
      abortSignal: opciones.abortSignal,
      cacheControlMaxAge: opciones.cacheControlMaxAge,
      contentType: opciones.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  },
  async borrar(url, abortSignal) {
    const { del } = await import('@vercel/blob');
    await del(url, {
      abortSignal,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  },
  async leer(url, abortSignal) {
    const respuesta = await fetch(url, {
      cache: 'force-cache',
      redirect: 'error',
      signal: abortSignal,
    });
    if (respuesta.status === 404) return null;
    if (!respuesta.ok || !respuesta.body) throw new LogoStorageError();
    const rawSize = Number(respuesta.headers.get('content-length'));
    return {
      stream: respuesta.body,
      size: Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 0,
    };
  },
};

function rutaLogo(url: URL): string[] | null {
  try {
    const ruta = decodeURIComponent(url.pathname);
    const segmentos = ruta.split('/').filter(Boolean);
    if (segmentos.some((segmento) => segmento === '.' || segmento === '..')) return null;
    return segmentos;
  } catch {
    return null;
  }
}

/** Solo admite la carpeta que controla esta aplicación dentro de Vercel Blob. */
export function esUrlLogoBlobSegura(raw: string, userId?: string): boolean {
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

    const segmentos = rutaLogo(url);
    if (
      !segmentos ||
      segmentos.length !== 3 ||
      segmentos[0] !== 'brand-logos' ||
      !UUID.test(segmentos[1] ?? '') ||
      !/^logo-[a-f0-9]{24}\.(?:png|jpg)$/i.test(segmentos[2] ?? '')
    ) {
      return false;
    }
    return !userId || segmentos[1]?.toLowerCase() === userId.toLowerCase();
  } catch {
    return false;
  }
}

async function conTimeout<T>(
  accion: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_BLOB_MS);
  try {
    return await accion(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

/** Sube bytes ya validados; la BD debe guardar únicamente la URL devuelta. */
export async function subirLogoMarca(
  userId: string,
  dataUrl: string,
  adaptador: AdaptadorLogoBlob = adaptadorVercel,
): Promise<string> {
  const logo = validarLogoDataUrl(dataUrl);
  if (!UUID.test(userId) || !logo) throw new LogoStorageInputError();
  const hash = createHash('sha256').update(logo.bytes).digest('hex').slice(0, 24);

  try {
    const resultado = await conTimeout((abortSignal) =>
      adaptador.subir(
        `brand-logos/${userId}/logo-${hash}.${logo.extension}`,
        logo.bytes,
        {
          abortSignal,
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 31_536_000,
          contentType: logo.contentType,
        },
      ),
    );
    if (!esUrlLogoBlobSegura(resultado.url, userId)) {
      throw new LogoStorageError();
    }
    return resultado.url;
  } catch (error: unknown) {
    if (error instanceof LogoStorageInputError) throw error;
    throw new LogoStorageError();
  }
}

export type CambioLogoMarca = {
  valorPersistir: string | null | undefined;
  urlNuevaSubida: string | null;
  urlAnteriorParaBorrar: string | null;
};

/**
 * Una URL enviada por el cliente solo se conserva si ya es la URL de la cuenta.
 * Una data URL válida siempre se transforma en Blob antes de persistirse.
 */
export async function prepararCambioLogoMarca(
  userId: string,
  entrada: string | null | undefined,
  valorActual: string | null,
  adaptador: AdaptadorLogoBlob = adaptadorVercel,
): Promise<CambioLogoMarca> {
  if (entrada === undefined) {
    return {
      valorPersistir: undefined,
      urlNuevaSubida: null,
      urlAnteriorParaBorrar: null,
    };
  }

  if (entrada === null) {
    return {
      valorPersistir: null,
      urlNuevaSubida: null,
      urlAnteriorParaBorrar: esUrlLogoBlobSegura(valorActual ?? '', userId)
        ? valorActual
        : null,
    };
  }

  if (validarLogoDataUrl(entrada)) {
    const urlNueva = await subirLogoMarca(userId, entrada, adaptador);
    return {
      valorPersistir: urlNueva,
      urlNuevaSubida: urlNueva === valorActual ? null : urlNueva,
      urlAnteriorParaBorrar:
        valorActual !== urlNueva && esUrlLogoBlobSegura(valorActual ?? '', userId)
          ? valorActual
          : null,
    };
  }

  if (entrada === valorActual && esUrlLogoBlobSegura(entrada, userId)) {
    return {
      valorPersistir: entrada,
      urlNuevaSubida: null,
      urlAnteriorParaBorrar: null,
    };
  }

  throw new LogoStorageInputError();
}

/** Borra únicamente URLs que pertenecen a la carpeta del usuario. */
export async function borrarLogoMarca(
  userId: string,
  url: string | null,
  adaptador: AdaptadorLogoBlob = adaptadorVercel,
): Promise<void> {
  if (!url || !esUrlLogoBlobSegura(url, userId)) return;
  try {
    await conTimeout((abortSignal) => adaptador.borrar(url, abortSignal));
  } catch {
    throw new LogoStorageError();
  }
}

async function leerStreamAcotado(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer | null> {
  const reader = stream.getReader();
  const partes: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BRAND_LOGO_BYTES) {
        await reader.cancel();
        return null;
      }
      partes.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(partes, total);
}

/**
 * El PDF recibe una data URL creada desde bytes releídos y revalidados; React
 * PDF nunca recibe la URL remota ni puede seguir recursos anidados.
 */
export async function cargarLogoMarcaParaPdf(
  valorPersistido: string | null,
  userId: string,
  adaptador: AdaptadorLogoBlob = adaptadorVercel,
): Promise<string | null> {
  const legacy = logoSeguro(valorPersistido);
  if (legacy) return legacy;
  if (!valorPersistido || !esUrlLogoBlobSegura(valorPersistido, userId)) return null;

  try {
    const resultado = await conTimeout((abortSignal) =>
      adaptador.leer(valorPersistido, abortSignal),
    );
    if (!resultado) return null;
    if (resultado.size > MAX_BRAND_LOGO_BYTES) {
      await resultado.stream.cancel();
      return null;
    }

    const bytes = await leerStreamAcotado(resultado.stream);
    return bytes ? validarLogoBytes(bytes)?.dataUrl ?? null : null;
  } catch {
    return null;
  }
}
