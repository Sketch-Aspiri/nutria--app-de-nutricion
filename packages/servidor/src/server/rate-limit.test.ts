import { randomUUID } from 'node:crypto';

import { pseudonymizeRateLimitKey } from './rate-limit-key';
import { rateLimit } from './rate-limit';

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

describe('rateLimit en el runner E2E', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      CI: 'true',
      E2E_RATE_LIMIT_MODE: 'local',
      E2E_ALLOW_DB_MUTATION: 'true',
      E2E_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/nutria_e2e_test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/nutria_e2e_test',
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('permite el adaptador local solo para la base local aislada del CI', async () => {
    await expect(rateLimit(`e2e-seguro:${randomUUID()}`, 1, 60_000)).resolves.toMatchObject({
      permitido: true,
      distribuido: false,
    });
  });

  it('acepta el loopback IPv6 de un runner local', async () => {
    const ipv6 = 'postgresql://postgres:postgres@[::1]:5432/nutria_e2e_test';
    process.env.E2E_DATABASE_URL = ipv6;
    process.env.DATABASE_URL = ipv6;

    await expect(rateLimit(`e2e-ipv6:${randomUUID()}`, 1, 60_000)).resolves.toMatchObject({
      permitido: true,
      distribuido: false,
    });
  });

  it('conserva el cierre seguro si la base E2E no coincide con la aplicación', async () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/nutria_ci';

    await expect(rateLimit(`e2e-base-distinta:${randomUUID()}`, 1, 60_000)).resolves.toMatchObject({
      permitido: false,
      distribuido: false,
    });
  });

  it('conserva el cierre seguro para una base remota aunque tenga nombre de test', async () => {
    const remote = 'postgresql://tester:secret@db.example.test:5432/nutria_e2e_test';
    process.env.E2E_DATABASE_URL = remote;
    process.env.DATABASE_URL = remote;

    await expect(rateLimit(`e2e-remoto:${randomUUID()}`, 1, 60_000)).resolves.toMatchObject({
      permitido: false,
      distribuido: false,
    });
  });
});
