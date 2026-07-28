/**
 * @jest-environment node
 */
import { MAX_BRAND_LOGO_BYTES } from '@/config/brandLogo';

import { logoSeguro } from './logoSafety';

const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function pngDeTamano(bytesObjetivo: number): string {
  const base = Buffer.from(LOGO_PNG.split(',')[1]!, 'base64');
  const posicionTipoIend = base.lastIndexOf(Buffer.from('IEND'));
  const inicioIend = posicionTipoIend - 4;
  const longitudDatos = bytesObjetivo - base.byteLength - 12;
  if (inicioIend < 0 || longitudDatos < 0) {
    throw new Error('El tamaño objetivo no alcanza para el fixture PNG.');
  }

  const chunk = Buffer.alloc(longitudDatos + 12);
  chunk.writeUInt32BE(longitudDatos, 0);
  chunk.write('tEXt', 4, 'ascii');
  const png = Buffer.concat([
    base.subarray(0, inicioIend),
    chunk,
    base.subarray(inicioIend),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

describe('logoSeguro', () => {
  it('acepta el borde exacto de 512 KB y rechaza un byte adicional', () => {
    const enElLimite = pngDeTamano(MAX_BRAND_LOGO_BYTES);
    expect(logoSeguro(enElLimite)).toBe(enElLimite);
    expect(logoSeguro(pngDeTamano(MAX_BRAND_LOGO_BYTES + 1))).toBeNull();
  });

  it('rechaza URL remota, SVG camuflado y dimensiones desproporcionadas', () => {
    expect(
      logoSeguro('https://nutria.public.blob.vercel-storage.com/logo.png'),
    ).toBeNull();

    const svg = `data:image/png;base64,${Buffer.from(
      '<svg><image href="http://169.254.169.254/latest/meta-data" /></svg>',
    ).toString('base64')}`;
    expect(logoSeguro(svg)).toBeNull();

    const pngEnorme = Buffer.from(LOGO_PNG.split(',')[1]!, 'base64');
    pngEnorme.writeUInt32BE(100_000, 16);
    pngEnorme.writeUInt32BE(100_000, 20);
    expect(
      logoSeguro(`data:image/png;base64,${pngEnorme.toString('base64')}`),
    ).toBeNull();
  });
});

