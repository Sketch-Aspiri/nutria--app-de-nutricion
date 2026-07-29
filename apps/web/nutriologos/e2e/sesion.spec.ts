import { expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  PASSWORD_PRUEBA,
  borrarCuentas,
  crearNutriologo,
  iniciarSesionConFormulario,
} from './utils/cuentas';

/**
 * El formulario de inicio de sesión.
 *
 * El resto de la suite siembra la cookie de sesión (ver `utils/sesion.ts`).
 * Este spec existe para que ese atajo no deje al login sin cobertura: es el
 * único lugar donde se teclea correo y contraseña de verdad. Son pocos intentos
 * a propósito, porque cada uno consume cupo del límite por IP.
 *
 * El servidor de Playwright usa el limitador local incluso cuando sirve el build
 * de `next start`: el runner no es producción y no debe depender de Upstash.
 */

let nutriologa: CuentaPrueba;

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('sesion', 'Nutrióloga de sesión');
});

test.afterAll(async () => {
  if (nutriologa) await borrarCuentas(nutriologa);
});

test('con credenciales correctas entra al panel', async ({ page }) => {
  await iniciarSesionConFormulario(page, nutriologa.email, PASSWORD_PRUEBA);

  await page.waitForURL('**/pacientes');
  await expect(page).toHaveURL(/\/pacientes/);
});

test('con contraseña incorrecta no entra y lo dice sin revelar si la cuenta existe', async ({
  page,
}) => {
  await iniciarSesionConFormulario(page, nutriologa.email, 'contrasena-que-no-es');

  // Sigue en /login: la sesión no se creó.
  await expect(page).toHaveURL(/\/login/);
  // El mensaje es el genérico; nunca "esa cuenta no existe" ni similar.
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
});

test('con correo inexistente devuelve el mismo error genérico', async ({ page }) => {
  await iniciarSesionConFormulario(page, 'cuenta-inexistente-e2e@nutria.test', PASSWORD_PRUEBA);

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
});
