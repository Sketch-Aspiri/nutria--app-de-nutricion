import { randomUUID } from 'node:crypto';

import { pseudonymizeRateLimitKey } from './rate-limit-key';
import { rateLimit } from './rate-limit';

const mockRedisCtor = jest.fn();
const mockLimit = jest.fn();

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation((config: unknown) => {
    mockRedisCtor(config);
    return {};
  }),
}));

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    jest.fn().mockImplementation(() => ({ limit: mockLimit })),
    { slidingWindow: jest.fn(() => 'ventana-deslizante') },
  ),
}));

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

/**
 * Conectar el store de Upstash desde el panel de Vercel inyecta las
 * credenciales como `KV_REST_API_*`. Cuando solo se miraba `UPSTASH_REDIS_REST_*`,
 * la app del paciente quedó con el limitador "sin configurar" y respondía 429 en
 * el primer intento de activación, con un mensaje que además pedía esperar.
 */
describe('credenciales del Redis compartido', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockRedisCtor.mockClear();
    mockLimit.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('acepta los nombres KV_REST_API_* que inyecta la integración de Vercel', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.test';
    process.env.KV_REST_API_TOKEN = 'token-kv';

    await expect(rateLimit(`kv:${randomUUID()}`, 5, 60_000)).resolves.toMatchObject({
      permitido: true,
      distribuido: true,
    });
    expect(mockRedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://kv.example.test', token: 'token-kv' }),
    );
  });

  it('prefiere UPSTASH_REDIS_REST_* cuando conviven los dos juegos', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.test';
    process.env.KV_REST_API_TOKEN = 'token-kv';
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token-upstash';

    await rateLimit(`ambos:${randomUUID()}`, 6, 60_000);

    expect(mockRedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://upstash.example.test', token: 'token-upstash' }),
    );
  });

  it('conserva el cierre seguro si solo llega la mitad de las credenciales', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.test';

    await expect(rateLimit(`incompleto:${randomUUID()}`, 7, 60_000)).resolves.toMatchObject({
      permitido: false,
      distribuido: false,
    });
    expect(mockRedisCtor).not.toHaveBeenCalled();
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
