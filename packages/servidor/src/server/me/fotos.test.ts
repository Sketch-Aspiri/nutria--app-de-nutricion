/**
 * @jest-environment node
 */
import {
  type AdaptadorFotoBlob,
  esUrlFotoSegura,
  MAX_FOTO_BYTES,
  subirFotoComida,
  tipoDeFoto,
} from './fotos';

const PACIENTE_ID = '11111111-1111-4111-8111-111111111111';
const OTRO_PACIENTE = '22222222-2222-4222-8222-222222222222';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii'),
]);
const SVG = Buffer.from('<svg onload="alert(1)"></svg>', 'utf8');

function urlDe(patientId: string, nombre = `comida-${'a'.repeat(24)}.jpg`): string {
  return `https://abc123.public.blob.vercel-storage.com/meal-photos/${patientId}/${nombre}`;
}

function adaptadorQueDevuelve(url: string): AdaptadorFotoBlob {
  return { subir: jest.fn().mockResolvedValue({ url }) };
}

describe('tipoDeFoto', () => {
  it.each([
    ['JPEG', JPEG, 'jpg'],
    ['PNG', PNG, 'png'],
    ['WebP', WEBP, 'webp'],
  ])('reconoce %s por su firma binaria', (_nombre, bytes, extension) => {
    expect(tipoDeFoto(bytes)?.extension).toBe(extension);
  });

  it('rechaza un SVG aunque el cliente lo declare como imagen', () => {
    expect(tipoDeFoto(SVG)).toBeNull();
  });

  it('rechaza bytes demasiado cortos para tener firma', () => {
    expect(tipoDeFoto(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('esUrlFotoSegura', () => {
  it('acepta la URL que produce esta aplicación', () => {
    expect(esUrlFotoSegura(urlDe(PACIENTE_ID), PACIENTE_ID)).toBe(true);
  });

  it('rechaza la carpeta de otro paciente', () => {
    expect(esUrlFotoSegura(urlDe(OTRO_PACIENTE), PACIENTE_ID)).toBe(false);
  });

  it.each([
    ['otro host', 'https://evil.example.com/meal-photos/x/comida-a.jpg'],
    ['http en claro', urlDe(PACIENTE_ID).replace('https:', 'http:')],
    ['otra carpeta', urlDe(PACIENTE_ID).replace('meal-photos', 'brand-logos')],
    ['nombre arbitrario', urlDe(PACIENTE_ID, 'payload.svg')],
    ['con query', `${urlDe(PACIENTE_ID)}?x=1`],
    ['no es URL', 'no-es-una-url'],
  ])('rechaza %s', (_caso, url) => {
    expect(esUrlFotoSegura(url, PACIENTE_ID)).toBe(false);
  });
});

describe('subirFotoComida', () => {
  it('sube la foto y devuelve su URL', async () => {
    const adaptador = adaptadorQueDevuelve(urlDe(PACIENTE_ID));

    const resultado = await subirFotoComida(PACIENTE_ID, JPEG, adaptador);

    expect(resultado).toEqual({ ok: true, url: urlDe(PACIENTE_ID) });
  });

  it('nombra el archivo con el hash del contenido, dentro de la carpeta del paciente', async () => {
    const adaptador = adaptadorQueDevuelve(urlDe(PACIENTE_ID));

    await subirFotoComida(PACIENTE_ID, JPEG, adaptador);

    const [pathname] = (adaptador.subir as jest.Mock).mock.calls[0] as [string];
    expect(pathname).toMatch(
      new RegExp(`^meal-photos/${PACIENTE_ID}/comida-[a-f0-9]{24}\\.jpg$`),
    );
  });

  it('usa el content-type derivado de los bytes, no el declarado', async () => {
    const adaptador = adaptadorQueDevuelve(
      urlDe(PACIENTE_ID, `comida-${'b'.repeat(24)}.png`),
    );

    await subirFotoComida(PACIENTE_ID, PNG, adaptador);

    const [, , opciones] = (adaptador.subir as jest.Mock).mock.calls[0] as [
      string,
      Buffer,
      { contentType: string },
    ];
    expect(opciones.contentType).toBe('image/png');
  });

  it('rechaza un formato no soportado sin llamar al almacenamiento', async () => {
    const adaptador = adaptadorQueDevuelve(urlDe(PACIENTE_ID));

    const resultado = await subirFotoComida(PACIENTE_ID, SVG, adaptador);

    expect(resultado).toEqual({ ok: false, motivo: 'formato_no_soportado' });
    expect(adaptador.subir).not.toHaveBeenCalled();
  });

  it('rechaza una foto vacía', async () => {
    const resultado = await subirFotoComida(
      PACIENTE_ID,
      Buffer.alloc(0),
      adaptadorQueDevuelve(urlDe(PACIENTE_ID)),
    );

    expect(resultado).toEqual({ ok: false, motivo: 'vacia' });
  });

  it('rechaza una foto que excede el tope', async () => {
    const grande = Buffer.concat([JPEG, Buffer.alloc(MAX_FOTO_BYTES)]);

    const resultado = await subirFotoComida(
      PACIENTE_ID,
      grande,
      adaptadorQueDevuelve(urlDe(PACIENTE_ID)),
    );

    expect(resultado).toEqual({ ok: false, motivo: 'muy_grande' });
  });

  it('descarta una URL que el almacenamiento devuelva fuera de la carpeta del paciente', async () => {
    const adaptador = adaptadorQueDevuelve(urlDe(OTRO_PACIENTE));

    const resultado = await subirFotoComida(PACIENTE_ID, JPEG, adaptador);

    expect(resultado).toEqual({ ok: false, motivo: 'almacenamiento' });
  });

  it('traduce un fallo del almacenamiento en vez de propagar la excepción', async () => {
    const adaptador: AdaptadorFotoBlob = {
      subir: jest.fn().mockRejectedValue(new Error('blob caído')),
    };

    await expect(subirFotoComida(PACIENTE_ID, JPEG, adaptador)).resolves.toEqual({
      ok: false,
      motivo: 'almacenamiento',
    });
  });
});
