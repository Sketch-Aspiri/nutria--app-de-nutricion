import { expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  PASSWORD_PRUEBA,
  borrarCuentas,
  crearSuperadmin,
  iniciarSesionConFormulario,
  prisma,
} from './utils/cuentas';
import { leerBuzon, limpiarBuzon } from './utils/correo';
import { sembrarSesion } from './utils/sesion';

let nutriologa: CuentaPrueba | undefined;
let superadmin: CuentaPrueba | undefined;

test.beforeAll(async () => {
  superadmin = await crearSuperadmin('superadmin', 'Superadmin E2E');
});

test.afterAll(async () => {
  const cuentas = [nutriologa, superadmin].filter(
    (cuenta): cuenta is CuentaPrueba => cuenta !== undefined,
  );
  if (cuentas.length > 0) await borrarCuentas(...cuentas);
  await prisma.$disconnect();
});

test('bloquea la cuenta vencida y restaura el acceso tras la activación manual', async ({
  browser,
  page,
}) => {
  test.skip(!superadmin, 'No se pudo preparar la cuenta superadmin de prueba.');
  const admin = superadmin!;

  await limpiarBuzon();
  const email = `e2e-registro-activacion-${Date.now().toString(36)}@nutria.test`;
  const registro = await page.request.post('/api/v1/auth/register', {
    data: {
      nombre_completo: 'Nutrióloga Registro Activación E2E',
      email,
      password: PASSWORD_PRUEBA,
      acepta_aviso_privacidad: true,
    },
  });
  expect(registro.status()).toBe(201);
  const alta = (await registro.json()) as { id: string; email: string };
  const cuenta: CuentaPrueba = {
    id: alta.id,
    email: alta.email,
    nombre: 'Nutrióloga Registro Activación E2E',
    role: 'NUTRITIONIST',
  };
  nutriologa = cuenta;

  const suscripcionInicial = await prisma.subscription.findUniqueOrThrow({
    where: { userId: cuenta.id },
    select: { plan: true, accessExpiresAt: true },
  });
  expect(suscripcionInicial.plan).toBe('PRO');
  expect(suscripcionInicial.accessExpiresAt.getTime()).toBeGreaterThan(Date.now());

  await expect.poll(async () => (await leerBuzon(cuenta.email)).length).toBe(1);
  const [correo] = await leerBuzon(cuenta.email);
  const token = correo?.html.match(/\/verificar\?token=([^"&<]+)/)?.[1];
  expect(token).toBeTruthy();
  const verificacion = await page.request.post('/api/v1/auth/verify_email', {
    data: { token: decodeURIComponent(token!) },
  });
  expect(verificacion.ok()).toBeTruthy();

  await iniciarSesionConFormulario(page, cuenta.email, PASSWORD_PRUEBA);
  await expect(page).toHaveURL(/\/pacientes$/);

  await prisma.subscription.update({
    where: { userId: cuenta.id },
    data: {
      plan: 'PRO',
      accessExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
      lastActivatedAt: null,
      lastActivatedByUserId: null,
      activationNote: null,
    },
  });

  await page.goto('/pacientes');
  await expect(page).toHaveURL(/\/cuenta-inactiva$/);
  await expect(page.getByRole('heading', { name: 'Tu mes de acceso terminó' })).toBeVisible();

  const apiBloqueada = await page.request.get('/api/v1/billing/subscription');
  expect(apiBloqueada.status()).toBe(403);
  expect(await apiBloqueada.json()).toMatchObject({ error: { code: 'ACCOUNT_INACTIVE' } });

  const contextoAdmin = await browser.newContext();
  try {
    await sembrarSesion(contextoAdmin, admin);
    const paginaAdmin = await contextoAdmin.newPage();
    await paginaAdmin.goto('/superadmin/nutriologas');

    const fila = paginaAdmin.locator('article').filter({ hasText: cuenta.email });
    await expect(fila.getByText('Bloqueada', { exact: true })).toBeVisible();
    await expect(fila.getByText('Primer mes gratis', { exact: true })).toBeVisible();
    await fila.getByRole('button', { name: 'Activar 1 mes' }).click();
    await fila.getByLabel('Nota de pago (opcional)').fill('Pago ficticio E2E');
    await fila.getByRole('button', { name: 'Confirmar 1 mes' }).click();
    await expect(fila.getByText('Activa', { exact: true })).toBeVisible();
  } finally {
    await contextoAdmin.close();
  }

  const suscripcion = await prisma.subscription.findUniqueOrThrow({
    where: { userId: cuenta.id },
    select: { plan: true, accessExpiresAt: true, lastActivatedByUserId: true },
  });
  expect(suscripcion.plan).toBe('PRO');
  expect(suscripcion.lastActivatedByUserId).toBe(admin.id);
  expect(suscripcion.accessExpiresAt.getTime()).toBeGreaterThan(Date.now());

  await page.context().clearCookies();
  await iniciarSesionConFormulario(page, cuenta.email, PASSWORD_PRUEBA);
  await expect(page).toHaveURL(/\/pacientes$/);
});
