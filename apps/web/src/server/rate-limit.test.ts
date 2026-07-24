import { pseudonymizeRateLimitKey } from './rate-limit-key';

describe('pseudonymizeKey', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_HASH_KEY = 'clave-de-prueba-con-mas-de-32-caracteres';
  });

  it('no expone correos ni direcciones IP y es determinista', () => {
    const raw = 'login:account:persona@example.test';
    const first = pseudonymizeRateLimitKey(raw);

    expect(first).toBe(pseudonymizeRateLimitKey(raw));
    expect(first).not.toContain('persona');
    expect(first).not.toContain('@');
    expect(first).toHaveLength(43);
  });

  it('separa identificadores distintos', () => {
    expect(pseudonymizeRateLimitKey('login:source:192.0.2.1')).not.toBe(
      pseudonymizeRateLimitKey('login:source:192.0.2.2'),
    );
  });
});
