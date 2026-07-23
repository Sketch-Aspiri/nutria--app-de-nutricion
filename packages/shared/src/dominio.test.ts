import { NIVELES_ACTIVIDAD, OBJETIVOS } from './catalogos';
import {
  edadDesdeFechaNacimiento,
  fechaNacimientoDesdeEdad,
  generoADb,
  generoDesdeDb,
  nivelActividadADb,
  nivelActividadDesdeDb,
  objetivoADb,
  objetivoDesdeDb,
} from './dominio';
import type { Genero } from './types';

const GENEROS: Genero[] = ['Femenino', 'Masculino', 'Otro'];

describe('mapeo de género', () => {
  it.each(GENEROS)('conserva "%s" al ir y volver de la base', (genero) => {
    expect(generoDesdeDb(generoADb(genero))).toBe(genero);
  });

  it('guarda el código sin acentos que acepta el enum de PostgreSQL', () => {
    expect(generoADb('Femenino')).toBe('FEMENINO');
  });
});

describe('mapeo de nivel de actividad', () => {
  it.each(NIVELES_ACTIVIDAD)('conserva "%s" al ir y volver de la base', (nivel) => {
    expect(nivelActividadDesdeDb(nivelActividadADb(nivel))).toBe(nivel);
  });

  it('convierte el espacio de "Muy activo" en guion bajo', () => {
    expect(nivelActividadADb('Muy activo')).toBe('MUY_ACTIVO');
  });
});

describe('mapeo de objetivo', () => {
  it.each(OBJETIVOS)('conserva "%s" al ir y volver de la base', (objetivo) => {
    expect(objetivoDesdeDb(objetivoADb(objetivo))).toBe(objetivo);
  });

  it('quita el acento de "Pérdida de grasa" para el enum', () => {
    expect(objetivoADb('Pérdida de grasa')).toBe('PERDIDA_DE_GRASA');
  });

  it('recupera el acento al leer de la base', () => {
    expect(objetivoDesdeDb('PERDIDA_DE_GRASA')).toBe('Pérdida de grasa');
  });
});

describe('edadDesdeFechaNacimiento', () => {
  const HOY = new Date('2026-07-22T12:00:00Z');

  it('calcula los años cumplidos', () => {
    expect(edadDesdeFechaNacimiento('1990-07-22', HOY)).toBe(36);
  });

  it('no cuenta el año en curso si aún no llega el cumpleaños', () => {
    expect(edadDesdeFechaNacimiento('1990-12-31', HOY)).toBe(35);
  });

  it('devuelve 0 sin fecha de nacimiento, para que el cálculo falle en vez de inventar', () => {
    expect(edadDesdeFechaNacimiento(null, HOY)).toBe(0);
    expect(edadDesdeFechaNacimiento(undefined, HOY)).toBe(0);
  });

  it('devuelve 0 ante una fecha inválida', () => {
    expect(edadDesdeFechaNacimiento('no-es-fecha', HOY)).toBe(0);
  });

  it('devuelve 0 ante una fecha futura', () => {
    expect(edadDesdeFechaNacimiento('2030-01-01', HOY)).toBe(0);
  });
});

describe('fechaNacimientoDesdeEdad', () => {
  const HOY = new Date('2026-07-22T12:00:00Z');

  it('produce una fecha que devuelve la misma edad', () => {
    const fecha = fechaNacimientoDesdeEdad(42, HOY);

    expect(fecha).not.toBeNull();
    expect(edadDesdeFechaNacimiento(fecha, HOY)).toBe(42);
  });

  it('devuelve null ante edades imposibles', () => {
    expect(fechaNacimientoDesdeEdad(0, HOY)).toBeNull();
    expect(fechaNacimientoDesdeEdad(-5, HOY)).toBeNull();
    expect(fechaNacimientoDesdeEdad(150, HOY)).toBeNull();
  });

  it('devuelve la fecha en formato ISO de solo día', () => {
    expect(fechaNacimientoDesdeEdad(30, HOY)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
