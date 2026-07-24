import { safeBeforeSend, tracesSampleRate } from './privacy';

describe('filtro de privacidad de Sentry', () => {
  it('elimina cuerpos, cookies, auth, query, usuario y breadcrumbs con datos', () => {
    const event = safeBeforeSend(
      {
        user: { id: 'user-1', email: 'persona@example.test' },
        extra: { peso: 72 },
        request: {
          method: 'POST',
          url: 'https://app.example.test/api/v1/patients/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?nombre=Ana',
          data: { antecedentes: 'dato clínico' },
          cookies: { session: 'secret' },
          headers: {
            authorization: 'Bearer secret',
            cookie: 'session=secret',
            'user-agent': 'test-agent',
          },
        },
        breadcrumbs: [
          {
            category: 'console',
            message: 'Paciente Ana pesa 72',
            data: { email: 'persona@example.test' },
          },
        ],
      },
      {},
    );

    expect(event.user).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.request).toEqual({
      method: 'POST',
      url: 'https://app.example.test/api/v1/patients/[id]',
      headers: { 'user-agent': 'test-agent' },
    });
    expect(event.breadcrumbs?.[0]).not.toHaveProperty('message');
    expect(event.breadcrumbs?.[0]).not.toHaveProperty('data');
  });

  it('conserva stack frames pero reemplaza el mensaje de excepción', () => {
    const event = safeBeforeSend(
      {
        exception: {
          values: [
            {
              type: 'PrismaError',
              value: 'Falló para persona@example.test',
              stacktrace: {
                frames: [{ filename: 'repository.ts', lineno: 12 }],
              },
            },
          ],
        },
      },
      {},
    );

    expect(event.exception?.values?.[0]?.value).toBe('PrismaError');
    expect(event.exception?.values?.[0]?.stacktrace?.frames).toHaveLength(1);
  });
  it('elimina contextos y spans, y mantiene tracing desactivado', () => {
    const event = safeBeforeSend(
      {
        contexts: { patient: { peso: 72 } },
        spans: [
          {
            span_id: 'span',
            trace_id: 'trace',
            start_timestamp: 1,
            data: { diagnostico: 'x' },
          },
        ],
      },
      {},
    );

    expect(event.contexts).toBeUndefined();
    expect(event.spans).toBeUndefined();
    expect(tracesSampleRate()).toBe(0);
  });
});
