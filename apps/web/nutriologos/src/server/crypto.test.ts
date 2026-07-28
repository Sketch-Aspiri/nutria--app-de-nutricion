import {
  decryptText,
  encryptedKeyId,
  encryptText,
  EncryptionConfigError,
  EncryptionIntegrityError,
  isEncrypted,
  needsEncryptionRefresh,
} from './crypto';

const KEY_A = Buffer.alloc(32, 1).toString('base64');
const KEY_B = Buffer.alloc(32, 2).toString('base64');
const CONTEXT = 'medical_records.antecedentes';

describe('cifrado de columnas clínicas', () => {
  const previousEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...previousEnv,
      ENCRYPTION_KEY: KEY_A,
      ENCRYPTION_KEY_ID: 'key-a',
      ENCRYPTION_PREVIOUS_KEYS: '',
    };
  });

  afterAll(() => {
    process.env = previousEnv;
  });

  it('cifra y descifra sin guardar el texto en el sobre', () => {
    const encrypted = encryptText('Dato clínico sensible', CONTEXT);

    expect(encrypted).not.toContain('Dato clínico sensible');
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptText(encrypted, CONTEXT)).toBe('Dato clínico sensible');
  });

  it('usa un IV distinto aunque el texto sea igual', () => {
    const first = encryptText('Mismo valor', CONTEXT);
    const second = encryptText('Mismo valor', CONTEXT);

    expect(first).not.toBe(second);
  });

  it('rechaza un sobre alterado o movido a otra columna', () => {
    const encrypted = encryptText('Dato clínico sensible', CONTEXT) as string;
    const changed = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decryptText(changed, CONTEXT)).toThrow(EncryptionIntegrityError);
    expect(() => decryptText(encrypted, 'messages.texto')).toThrow(EncryptionIntegrityError);
  });

  it('lee con una llave anterior durante la rotación', () => {
    const encrypted = encryptText('Antes de rotar', CONTEXT);
    process.env.ENCRYPTION_KEY = KEY_B;
    process.env.ENCRYPTION_KEY_ID = 'key-b';
    process.env.ENCRYPTION_PREVIOUS_KEYS = `key-a:${KEY_A}`;

    expect(decryptText(encrypted, CONTEXT)).toBe('Antes de rotar');
    expect(encryptedKeyId(encrypted)).toBe('key-a');
    expect(needsEncryptionRefresh(encrypted)).toBe(true);
  });

  it('acepta temporalmente texto legado para permitir el backfill', () => {
    expect(decryptText('texto todavía no migrado', CONTEXT)).toBe(
      'texto todavía no migrado',
    );
  });

  it('falla cerrado si la llave activa no está configurada', () => {
    delete process.env.ENCRYPTION_KEY;

    expect(() => encryptText('dato', CONTEXT)).toThrow(EncryptionConfigError);
  });
});
