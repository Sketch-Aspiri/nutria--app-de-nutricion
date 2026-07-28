/**
 * @jest-environment node
 */
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  hashPassword,
  normalizarEmail,
  passwordSchema,
  verifyPassword,
} from './password';

// bcrypt con 12 rondas es deliberadamente lento.
jest.setTimeout(20000);

describe('hashPassword / verifyPassword', () => {
  it('acepta la contraseña correcta', async () => {
    const hash = await hashPassword('consultorio-2026!');

    await expect(verifyPassword('consultorio-2026!', hash)).resolves.toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('consultorio-2026!');

    await expect(verifyPassword('otra-contrasena', hash)).resolves.toBe(false);
  });

  it('nunca guarda la contraseña en claro', async () => {
    const hash = await hashPassword('consultorio-2026!');

    expect(hash).not.toContain('consultorio-2026!');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produce hashes distintos para la misma contraseña (sal aleatoria)', async () => {
    const [a, b] = await Promise.all([hashPassword('misma-clave-1'), hashPassword('misma-clave-1')]);

    expect(a).not.toBe(b);
  });

  it('devuelve false si el usuario no tiene contraseña (cuenta solo con Google)', async () => {
    await expect(verifyPassword('lo-que-sea', null)).resolves.toBe(false);
  });

  it('devuelve false ante un hash corrupto en vez de lanzar', async () => {
    await expect(verifyPassword('lo-que-sea', 'no-es-un-hash')).resolves.toBe(false);
  });
});

describe('passwordSchema', () => {
  it(`rechaza contraseñas de menos de ${PASSWORD_MIN} caracteres`, () => {
    expect(passwordSchema.safeParse('corta123').success).toBe(false);
  });

  it('acepta una contraseña larga sin exigir símbolos', () => {
    expect(passwordSchema.safeParse('mi consultorio de nutricion').success).toBe(true);
  });

  it(`rechaza más de ${PASSWORD_MAX} caracteres porque bcrypt truncaría el resto`, () => {
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MAX + 1)).success).toBe(false);
  });
});

describe('normalizarEmail', () => {
  it('quita espacios y pasa a minúsculas para que el índice único no se burle', () => {
    expect(normalizarEmail('  Ana.Lopez@Consultorio.MX ')).toBe('ana.lopez@consultorio.mx');
  });
});
