/**
 * @jest-environment node
 */
import { validarBaseE2E } from './e2eDatabaseSafety';

describe('validarBaseE2E', () => {
  const urlPruebas = 'postgresql://tester:secret@localhost:5432/nutria_test';

  it('exige URL dedicada y opt-in explícito', () => {
    expect(
      validarBaseE2E({ e2eDatabaseUrl: urlPruebas, permiteMutaciones: false }),
    ).toMatchObject({ ok: false });
    expect(validarBaseE2E({ permiteMutaciones: true })).toMatchObject({ ok: false });
  });

  it('rechaza la misma base aunque las credenciales o query sean distintos', () => {
    expect(
      validarBaseE2E({
        e2eDatabaseUrl: urlPruebas,
        databaseUrl:
          'postgresql://app:otra@localhost:5432/nutria_test?schema=public',
        permiteMutaciones: true,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validarBaseE2E({
        e2eDatabaseUrl: urlPruebas,
        directUrl: 'postgresql://admin:otra@localhost:5432/nutria_test',
        permiteMutaciones: true,
      }),
    ).toMatchObject({ ok: false });
  });

  it('acepta un marcador inequívoco en base u host', () => {
    expect(
      validarBaseE2E({
        e2eDatabaseUrl: urlPruebas,
        databaseUrl: 'postgresql://app:secret@db.example.test:5432/nutria',
        permiteMutaciones: true,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validarBaseE2E({
        e2eDatabaseUrl:
          'postgresql://tester:secret@feature-preview.db.example.test/nutria',
        permiteMutaciones: true,
      }),
    ).toMatchObject({ ok: true });
  });

  it('requiere allowlist exacta cuando no hay marcador de pruebas', () => {
    const configuracion = {
      e2eDatabaseUrl: 'postgresql://tester:secret@localhost:5432/nutria_e2e',
      permiteMutaciones: true,
    };
    expect(validarBaseE2E(configuracion)).toMatchObject({ ok: false });
    expect(
      validarBaseE2E({
        ...configuracion,
        databaseIdPermitida: 'localhost:5432/nutria_e2e',
      }),
    ).toMatchObject({ ok: true });
  });
});

