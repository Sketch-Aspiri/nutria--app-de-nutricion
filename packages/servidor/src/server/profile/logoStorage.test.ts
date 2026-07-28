/**
 * @jest-environment node
 */
import { MAX_BRAND_LOGO_BYTES } from '@/config/brandLogo';

import {
  type AdaptadorLogoBlob,
  cargarLogoMarcaParaPdf,
  esUrlLogoBlobSegura,
  LogoStorageInputError,
  prepararCambioLogoMarca,
  subirLogoMarca,
} from './logoStorage';

const USER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const URL_LOGO =
  `https://nutria.public.blob.vercel-storage.com/brand-logos/${USER_ID}/` +
  'logo-a1b2c3d4e5f678901234abcd.png';
const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function stream(bytes: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function adaptador(overrides: Partial<AdaptadorLogoBlob> = {}): AdaptadorLogoBlob {
  return {
    subir: jest.fn(async () => ({ url: URL_LOGO })),
    borrar: jest.fn(async () => undefined),
    leer: jest.fn(async () => null),
    ...overrides,
  };
}

describe('almacenamiento de logo de marca', () => {
  it('sube bytes validados bajo la carpeta del usuario y devuelve URL Blob', async () => {
    const subir = jest.fn(async () => ({ url: URL_LOGO }));
    const cliente = adaptador({ subir });

    await expect(subirLogoMarca(USER_ID, LOGO_PNG, cliente)).resolves.toBe(URL_LOGO);
    expect(subir).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^brand-logos/${USER_ID}/logo-[a-f0-9]{24}\\.png$`),
      ),
      expect.any(Buffer),
      expect.objectContaining({
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31_536_000,
        contentType: 'image/png',
      }),
    );
  });

  it('solo conserva una URL remota si ya pertenece a la cuenta', async () => {
    const cliente = adaptador();
    await expect(
      prepararCambioLogoMarca(USER_ID, URL_LOGO, URL_LOGO, cliente),
    ).resolves.toMatchObject({
      valorPersistir: URL_LOGO,
      urlNuevaSubida: null,
    });
    expect(cliente.subir).not.toHaveBeenCalled();

    await expect(
      prepararCambioLogoMarca(
        USER_ID,
        URL_LOGO.replace(USER_ID, 'b1b2c3d4-0000-4000-8000-000000000002'),
        null,
        cliente,
      ),
    ).rejects.toBeInstanceOf(LogoStorageInputError);
  });

  it('relee el Blob acotado y entrega al PDF únicamente una data URL revalidada', async () => {
    const bytes = Buffer.from(LOGO_PNG.split(',')[1]!, 'base64');
    const leer = jest.fn(async () => ({ stream: stream(bytes), size: bytes.length }));
    const cliente = adaptador({ leer });

    await expect(cargarLogoMarcaParaPdf(URL_LOGO, USER_ID, cliente)).resolves.toBe(
      LOGO_PNG,
    );
    expect(leer).toHaveBeenCalledWith(URL_LOGO, expect.any(AbortSignal));
  });

  it('no lee hosts/rutas ajenos ni buffers mayores al límite', async () => {
    const leer = jest.fn(async () => ({
      stream: stream(Buffer.from('no debe leerse')),
      size: MAX_BRAND_LOGO_BYTES + 1,
    }));
    const cliente = adaptador({ leer });

    await expect(
      cargarLogoMarcaParaPdf('https://127.0.0.1/logo.png', USER_ID, cliente),
    ).resolves.toBeNull();
    expect(leer).not.toHaveBeenCalled();

    await expect(cargarLogoMarcaParaPdf(URL_LOGO, USER_ID, cliente)).resolves.toBeNull();
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it('valida host, dueño y forma exacta del pathname', () => {
    expect(esUrlLogoBlobSegura(URL_LOGO, USER_ID)).toBe(true);
    expect(esUrlLogoBlobSegura(`${URL_LOGO}?download=1`, USER_ID)).toBe(false);
    expect(
      esUrlLogoBlobSegura(
        `https://nutria.public.blob.vercel-storage.com/brand-logos/${USER_ID}/../logo.png`,
        USER_ID,
      ),
    ).toBe(false);
  });
});
