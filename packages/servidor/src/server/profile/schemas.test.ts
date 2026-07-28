import { actualizarPerfilSchema } from './schemas';

const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('actualizarPerfilSchema', () => {
  it('acepta una marca completa con logo embebido', () => {
    expect(
      actualizarPerfilSchema.safeParse({
        nombre_completo: 'Nutrióloga de Prueba',
        marca_nombre: 'Consulta Norte',
        marca_color: '#166534',
        marca_logo_url: LOGO_PNG,
      }).success,
    ).toBe(true);
  });

  it('rechaza colores e imágenes que no son válidos', () => {
    const resultado = actualizarPerfilSchema.safeParse({
      marca_color: 'verde',
      marca_logo_url: 'https://127.0.0.1/logo.png',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza logos remotos aunque provengan de Vercel Blob', () => {
    expect(
      actualizarPerfilSchema.safeParse({
        marca_logo_url: 'https://tienda.public.blob.vercel-storage.com/logo.png',
      }).success,
    ).toBe(false);
  });

  it('acepta la URL Blob ya persistida bajo la carpeta de marca', () => {
    expect(
      actualizarPerfilSchema.safeParse({
        marca_logo_url:
          'https://nutria.public.blob.vercel-storage.com/brand-logos/' +
          'a1b2c3d4-0000-4000-8000-000000000001/' +
          'logo-a1b2c3d4e5f678901234abcd.png',
      }).success,
    ).toBe(true);
  });

  it('rechaza formatos que React PDF no garantiza', () => {
    expect(
      actualizarPerfilSchema.safeParse({
        marca_logo_url: 'data:image/webp;base64,UklGRg==',
      }).success,
    ).toBe(false);
    expect(
      actualizarPerfilSchema.safeParse({
        marca_logo_url: 'https://tienda.public.blob.vercel-storage.com/logo.webp',
      }).success,
    ).toBe(false);
  });

  it('rechaza un patch vacío', () => {
    expect(actualizarPerfilSchema.safeParse({}).success).toBe(false);
  });
});
