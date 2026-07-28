import { inflateSync } from 'node:zlib';

import { MAX_BRAND_LOGO_BYTES } from '@/config/brandLogo';

const MAX_LOGO_LADO = 2_048;
const MAX_LOGO_PIXELES = 2_000_000;
const MAX_PNG_DESCOMPRIMIDO_BYTES = 20 * 1024 * 1024;

type Dimensiones = { ancho: number; alto: number };
export type LogoValidado = {
  bytes: Buffer;
  contentType: 'image/jpeg' | 'image/png';
  extension: 'jpg' | 'png';
  dataUrl: string;
};

function datosPng(bytes: Buffer): {
  dimensiones: Dimensiones;
  idat: Buffer[];
} | null {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(firma) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.subarray(12, 16).toString('ascii') !== 'IHDR'
  ) {
    return null;
  }

  const idat: Buffer[] = [];
  let posicion = 8;
  let encontroFinal = false;
  while (posicion + 12 <= bytes.length) {
    const longitud = bytes.readUInt32BE(posicion);
    const inicioDatos = posicion + 8;
    const finalDatos = inicioDatos + longitud;
    const finalChunk = finalDatos + 4;
    if (finalChunk > bytes.length) return null;

    const tipo = bytes.subarray(posicion + 4, posicion + 8).toString('ascii');
    if (tipo === 'IDAT') idat.push(bytes.subarray(inicioDatos, finalDatos));
    posicion = finalChunk;
    if (tipo === 'IEND') {
      encontroFinal = true;
      break;
    }
  }
  if (!encontroFinal || posicion !== bytes.length || idat.length === 0) return null;

  try {
    inflateSync(Buffer.concat(idat), {
      maxOutputLength: MAX_PNG_DESCOMPRIMIDO_BYTES,
    });
  } catch {
    return null;
  }

  return {
    dimensiones: {
      ancho: bytes.readUInt32BE(16),
      alto: bytes.readUInt32BE(20),
    },
    idat,
  };
}

function dimensionesJpeg(bytes: Buffer): Dimensiones | null {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    return null;
  }

  const marcadoresSof = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let posicion = 2;

  while (posicion + 3 < bytes.length) {
    while (posicion < bytes.length && bytes[posicion] !== 0xff) posicion += 1;
    while (posicion < bytes.length && bytes[posicion] === 0xff) posicion += 1;
    if (posicion >= bytes.length) return null;

    const marcador = bytes[posicion];
    if (marcador === undefined) return null;
    posicion += 1;
    if (
      marcador === 0xd8 ||
      marcador === 0xd9 ||
      marcador === 0x01 ||
      (marcador >= 0xd0 && marcador <= 0xd7)
    ) {
      continue;
    }
    if (posicion + 1 >= bytes.length) return null;

    const longitud = bytes.readUInt16BE(posicion);
    if (longitud < 2 || posicion + longitud > bytes.length) return null;
    if (marcadoresSof.has(marcador)) {
      if (longitud < 7) return null;
      return {
        ancho: bytes.readUInt16BE(posicion + 5),
        alto: bytes.readUInt16BE(posicion + 3),
      };
    }
    posicion += longitud;
  }

  return null;
}

function dimensionesValidas(dimensiones: Dimensiones | null): boolean {
  if (!dimensiones) return false;
  const { ancho, alto } = dimensiones;
  return (
    ancho > 0 &&
    alto > 0 &&
    ancho <= MAX_LOGO_LADO &&
    alto <= MAX_LOGO_LADO &&
    ancho * alto <= MAX_LOGO_PIXELES
  );
}

/** Valida bytes antes de subirlos o entregarlos al renderer. */
export function validarLogoBytes(bytes: Buffer): LogoValidado | null {
  if (bytes.length === 0 || bytes.length > MAX_BRAND_LOGO_BYTES) return null;

  const png = datosPng(bytes);
  const jpeg = png ? null : dimensionesJpeg(bytes);
  const dimensiones = png?.dimensiones ?? jpeg;
  if (!dimensionesValidas(dimensiones)) return null;

  const contentType = png ? 'image/png' : 'image/jpeg';
  const extension = png ? 'png' : 'jpg';
  return {
    bytes,
    contentType,
    extension,
    dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
  };
}

/** Decodifica una entrada local y exige que el MIME declarado coincida con sus bytes. */
export function validarLogoDataUrl(logoUrl: string | null): LogoValidado | null {
  if (!logoUrl) return null;
  const coincidencia = /^data:image\/(png|jpeg);base64,([a-z0-9+/=\s]+)$/i.exec(
    logoUrl,
  );
  if (!coincidencia) return null;

  const tipoDeclarado = coincidencia[1]?.toLowerCase();
  const base64 = coincidencia[2]?.replace(/\s/g, '') ?? '';
  if (
    !base64 ||
    base64.length % 4 !== 0 ||
    !/^[a-z0-9+/]+={0,2}$/i.test(base64)
  ) {
    return null;
  }

  const logo = validarLogoBytes(Buffer.from(base64, 'base64'));
  if (!logo) return null;
  const esperado = tipoDeclarado === 'png' ? 'image/png' : 'image/jpeg';
  return logo.contentType === esperado ? logo : null;
}

/**
 * Compatibilidad para consumidores que solo necesitan una data URL local
 * saneada. Las URLs remotas se resuelven exclusivamente en `logoStorage`.
 */
export function logoSeguro(logoUrl: string | null): string | null {
  return validarLogoDataUrl(logoUrl)?.dataUrl ?? null;
}
