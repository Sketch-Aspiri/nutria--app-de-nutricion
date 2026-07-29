import { PASSWORD_MAX, PASSWORD_MIN } from './password';
import { activarCuentaSchema } from './schemasPaciente';

/**
 * Esquema de `POST /api/v1/auth/activate`.
 *
 * El caso que de verdad importa es el consentimiento: `activarCuentaPaciente`
 * sella `privacy_notice_accepted_at` con lo que llegue aquí, así que si el
 * esquema aceptara la ausencia del campo, el servidor estaría firmando el aviso
 * de privacidad en nombre del paciente.
 */

const VALIDO = {
  token: 'a'.repeat(64),
  password: 'contraseña-larga-y-segura',
  acepta_privacidad: true,
};

describe('activarCuentaSchema', () => {
  it('acepta una activación completa', () => {
    expect(activarCuentaSchema.safeParse(VALIDO).success).toBe(true);
  });

  it('recorta los espacios alrededor del token', () => {
    const parsed = activarCuentaSchema.parse({ ...VALIDO, token: `  ${VALIDO.token}  ` });
    expect(parsed.token).toBe(VALIDO.token);
  });

  describe('consentimiento de privacidad', () => {
    it('rechaza el consentimiento ausente', () => {
      const { acepta_privacidad: _omitido, ...sinConsentimiento } = VALIDO;
      expect(activarCuentaSchema.safeParse(sinConsentimiento).success).toBe(false);
    });

    it.each([
      ['en false', false],
      ['como cadena', 'true'],
      ['nulo', null],
      ['como número', 1],
    ])('rechaza el consentimiento %s', (_caso, valor) => {
      const resultado = activarCuentaSchema.safeParse({ ...VALIDO, acepta_privacidad: valor });
      expect(resultado.success).toBe(false);
    });

    it('explica al paciente qué le falta', () => {
      const resultado = activarCuentaSchema.safeParse({ ...VALIDO, acepta_privacidad: false });
      expect(resultado.success).toBe(false);
      if (resultado.success) return;
      expect(resultado.error.issues[0]?.message).toMatch(/aviso de privacidad/i);
    });
  });

  describe('token', () => {
    it.each([
      ['vacío', ''],
      ['solo espacios', '   '],
      ['desmedido', 'a'.repeat(201)],
    ])('rechaza un token %s', (_caso, token) => {
      expect(activarCuentaSchema.safeParse({ ...VALIDO, token }).success).toBe(false);
    });

    it('rechaza un token que no es texto', () => {
      expect(activarCuentaSchema.safeParse({ ...VALIDO, token: 12345 }).success).toBe(false);
    });
  });

  describe('contraseña', () => {
    it('hereda el mínimo de la política compartida', () => {
      const corta = 'a'.repeat(PASSWORD_MIN - 1);
      expect(activarCuentaSchema.safeParse({ ...VALIDO, password: corta }).success).toBe(false);
      expect(
        activarCuentaSchema.safeParse({ ...VALIDO, password: 'a'.repeat(PASSWORD_MIN) }).success,
      ).toBe(true);
    });

    it('rechaza más de lo que bcrypt puede leer, en vez de truncar en silencio', () => {
      const larga = 'a'.repeat(PASSWORD_MAX + 1);
      expect(activarCuentaSchema.safeParse({ ...VALIDO, password: larga }).success).toBe(false);
    });
  });
});
