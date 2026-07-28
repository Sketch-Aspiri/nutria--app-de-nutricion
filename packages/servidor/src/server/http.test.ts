/**
 * @jest-environment node
 */
import { z } from 'zod';

import {
  ErrorCode,
  PER_PAGE_MAX,
  jsonError,
  jsonList,
  jsonOk,
  parsePagination,
  zodDetails,
} from './http';

describe('jsonOk', () => {
  it('devuelve el recurso sin envolverlo en `data`', async () => {
    const respuesta = jsonOk({ id: 'abc', nombre: 'Ana' });

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ id: 'abc', nombre: 'Ana' });
  });
});

describe('jsonList', () => {
  it('envuelve los listados en data + meta de paginación', async () => {
    const respuesta = jsonList([{ id: '1' }], { page: 2, per_page: 20, total: 45 });

    await expect(respuesta.json()).resolves.toEqual({
      data: [{ id: '1' }],
      meta: { page: 2, per_page: 20, total: 45 },
    });
  });
});

describe('jsonError', () => {
  it('usa el sobre { error: { code, message } } de las convenciones', async () => {
    const respuesta = jsonError(404, ErrorCode.NOT_FOUND, 'No existe.');

    expect(respuesta.status).toBe(404);
    await expect(respuesta.json()).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'No existe.' },
    });
  });

  it('omite `details` cuando no se proporciona', async () => {
    const respuesta = jsonError(500, ErrorCode.INTERNAL_ERROR, 'Falló.');
    const cuerpo = (await respuesta.json()) as { error: Record<string, unknown> };

    expect(cuerpo.error).not.toHaveProperty('details');
  });
});

describe('zodDetails', () => {
  it('agrupa los mensajes por campo', () => {
    const schema = z.object({ email: z.email('Correo inválido.'), edad: z.number().min(18, 'Muy joven.') });
    const resultado = schema.safeParse({ email: 'no-es-correo', edad: 12 });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(zodDetails(resultado.error)).toEqual({
      email: ['Correo inválido.'],
      edad: ['Muy joven.'],
    });
  });

  it('agrupa campos anidados con notación de punto', () => {
    const schema = z.object({ perfil: z.object({ nombre: z.string().min(3, 'Muy corto.') }) });
    const resultado = schema.safeParse({ perfil: { nombre: 'ab' } });

    if (resultado.success) throw new Error('se esperaba un fallo de validación');
    expect(zodDetails(resultado.error)).toEqual({ 'perfil.nombre': ['Muy corto.'] });
  });
});

describe('parsePagination', () => {
  it('usa la primera página y el tamaño por defecto sin parámetros', () => {
    expect(parsePagination(new URLSearchParams())).toEqual({
      page: 1,
      perPage: 20,
      skip: 0,
      take: 20,
    });
  });

  it('calcula el salto a partir de la página solicitada', () => {
    expect(parsePagination(new URLSearchParams('page=3&per_page=10'))).toEqual({
      page: 3,
      perPage: 10,
      skip: 20,
      take: 10,
    });
  });

  it('recorta per_page al máximo permitido', () => {
    expect(parsePagination(new URLSearchParams('per_page=5000')).perPage).toBe(PER_PAGE_MAX);
  });

  it('ignora valores no numéricos o negativos', () => {
    const resultado = parsePagination(new URLSearchParams('page=-4&per_page=abc'));

    expect(resultado.page).toBe(1);
    expect(resultado.perPage).toBe(20);
  });
});
