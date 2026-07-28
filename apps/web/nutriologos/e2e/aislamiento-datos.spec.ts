import { expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  borrarCuentas,
  crearNutriologo,
  crearPacienteEnBase,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #9 del plan V2: un nutriólogo no puede ver ni tocar los pacientes
 * de otro, ni navegando a la URL ni llamando a la API directamente.
 *
 * Es la prueba de seguridad que respalda la regla del proyecto: la autorización
 * se resuelve en el backend, no ocultando botones.
 */

let nutriologaA: CuentaPrueba;
let nutriologoB: CuentaPrueba;
let pacienteDeA: { id: string };

test.beforeAll(async () => {
  nutriologaA = await crearNutriologo('aisl-a', 'Nutrióloga A');
  nutriologoB = await crearNutriologo('aisl-b', 'Nutriólogo B');
  pacienteDeA = await crearPacienteEnBase(nutriologaA.id, 'Paciente Privado de A');
});

test.afterAll(async () => {
  await borrarCuentas(nutriologaA, nutriologoB);
  await prisma.$disconnect();
});

test('el listado de B no incluye pacientes de A', async ({ page }) => {
  await iniciarSesion(page, nutriologoB);

  await expect(page.getByText('Todavía no tienes pacientes')).toBeVisible();
  await expect(page.getByText('Paciente Privado de A')).toHaveCount(0);
});

test('B no puede abrir el expediente de A por URL directa', async ({ page }) => {
  await iniciarSesion(page, nutriologoB);
  await page.goto(`/pacientes/${pacienteDeA.id}`);

  await expect(page.getByText(/no pertenece a tu consulta/i)).toBeVisible();
  await expect(page.getByText('Paciente Privado de A')).toHaveCount(0);
});

test('la API responde 404 (no 403) a B para no revelar que el paciente existe', async ({
  page,
}) => {
  await iniciarSesion(page, nutriologoB);

  const respuesta = await page.request.get(`/api/v1/patients/${pacienteDeA.id}`);

  expect(respuesta.status()).toBe(404);
  const cuerpo = (await respuesta.json()) as { error: { code: string } };
  expect(cuerpo.error.code).toBe('NOT_FOUND');
});

test('B no puede modificar ni archivar al paciente de A', async ({ page }) => {
  await iniciarSesion(page, nutriologoB);

  const intentoEditar = await page.request.patch(`/api/v1/patients/${pacienteDeA.id}`, {
    data: { nombre: 'Nombre Secuestrado' },
  });
  expect(intentoEditar.status()).toBe(404);

  const intentoArchivar = await page.request.delete(`/api/v1/patients/${pacienteDeA.id}`);
  expect(intentoArchivar.status()).toBe(404);

  const intentoExpediente = await page.request.patch(
    `/api/v1/patients/${pacienteDeA.id}/medical_record`,
    { data: { objetivo: 'GANANCIA_MUSCULAR' } },
  );
  expect(intentoExpediente.status()).toBe(404);

  // El paciente de A quedó intacto.
  const paciente = await prisma.patient.findUnique({
    where: { id: pacienteDeA.id },
    include: { medicalRecord: true },
  });
  expect(paciente?.nombre).toBe('Paciente Privado de A');
  expect(paciente?.deletedAt).toBeNull();
  expect(paciente?.medicalRecord?.objetivo).toBe('PERDIDA_DE_GRASA');
});

test('sin sesión la API no entrega nada', async ({ request }) => {
  const listado = await request.get('/api/v1/patients');
  expect(listado.status()).toBe(401);

  const detalle = await request.get(`/api/v1/patients/${pacienteDeA.id}`);
  expect(detalle.status()).toBe(401);
});
