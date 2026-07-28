/**
 * @jest-environment node
 */
import { requiereNutriologo } from '@/server/auth/guards';
import { prisma } from '@/server/db';
import {
  borrarLogoMarca,
  LogoStorageError,
  prepararCambioLogoMarca,
} from '@/server/profile/logoStorage';

import { PATCH } from './route';

jest.mock('@/server/auth/guards', () => ({ requiereNutriologo: jest.fn() }));
jest.mock('@/server/db', () => ({
  prisma: {
    $transaction: jest.fn(),
    nutritionistProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('@/server/profile/logoStorage', () => {
  const real = jest.requireActual('@/server/profile/logoStorage');
  return {
    ...real,
    borrarLogoMarca: jest.fn(),
    prepararCambioLogoMarca: jest.fn(),
  };
});

const USER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const URL_ANTERIOR =
  `https://nutria.public.blob.vercel-storage.com/brand-logos/${USER_ID}/` +
  'logo-aaaaaaaaaaaaaaaaaaaaaaaa.png';
const URL_NUEVA =
  `https://nutria.public.blob.vercel-storage.com/brand-logos/${USER_ID}/` +
  'logo-bbbbbbbbbbbbbbbbbbbbbbbb.png';
const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const perfilRespuesta = {
  id: USER_ID,
  email: 'nutriologa-blob@nutria.test',
  name: 'Nutrióloga Blob',
  role: 'NUTRITIONIST',
  emailVerified: new Date('2026-07-23'),
  nutritionistProfile: {
    nombreCompleto: 'Nutrióloga Blob',
    cedulaProfesional: null,
    telefono: null,
    especialidad: null,
    marcaNombre: 'Consulta Blob',
    marcaColor: '#065f46',
    marcaLogoUrl: URL_NUEVA,
  },
  subscription: null,
};

describe('PATCH /api/v1/me — logo Blob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requiereNutriologo).mockResolvedValue({
      ok: true,
      userId: USER_ID,
      sesion: { user: { name: 'Nutrióloga Blob' } },
    } as never);
    jest.mocked(prisma.nutritionistProfile.findUnique).mockResolvedValue({
      marcaLogoUrl: URL_ANTERIOR,
    } as never);
    jest.mocked(prisma.$transaction).mockResolvedValue([] as never);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(perfilRespuesta as never);
    jest.mocked(prepararCambioLogoMarca).mockResolvedValue({
      valorPersistir: URL_NUEVA,
      urlNuevaSubida: URL_NUEVA,
      urlAnteriorParaBorrar: URL_ANTERIOR,
    });
  });

  it('persiste la URL Blob y nunca la data URL recibida', async () => {
    const respuesta = await PATCH(
      new Request('http://localhost/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({ marca_logo_url: LOGO_PNG }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(respuesta.status).toBe(200);
    expect(prepararCambioLogoMarca).toHaveBeenCalledWith(
      USER_ID,
      LOGO_PNG,
      URL_ANTERIOR,
    );
    const upsert = jest.mocked(prisma.nutritionistProfile.upsert).mock.calls[0]?.[0];
    expect(upsert?.update).toMatchObject({ marcaLogoUrl: URL_NUEVA });
    expect(upsert?.create).toMatchObject({ marcaLogoUrl: URL_NUEVA });
    expect(JSON.stringify(upsert)).not.toContain(LOGO_PNG);
    expect(borrarLogoMarca).toHaveBeenCalledWith(USER_ID, URL_ANTERIOR);
    await expect(respuesta.json()).resolves.toMatchObject({
      perfil: { marca_logo_url: URL_NUEVA },
    });
  });

  it('responde 503 y no toca la BD si Blob no está disponible', async () => {
    jest.mocked(prepararCambioLogoMarca).mockRejectedValue(new LogoStorageError());

    const respuesta = await PATCH(
      new Request('http://localhost/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({ marca_logo_url: LOGO_PNG }),
      }),
    );

    expect(respuesta.status).toBe(503);
    await expect(respuesta.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
