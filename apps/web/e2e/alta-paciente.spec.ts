import { expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  borrarCuentas,
  crearNutriologo,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #2 del plan V2: alta de paciente completa desde el asistente de
 * 4 pasos, con persistencia real en PostgreSQL.
 */

let nutriologa: CuentaPrueba;

const EDAD_ESPERADA = 34;

/**
 * El expediente guarda **fecha de nacimiento**, no edad: una edad almacenada
 * queda obsoleta al día siguiente del cumpleaños y descuadraría el TDEE. La
 * fecha se calcula hacia atrás desde hoy —restando un día de más para no caer
 * justo sobre el cumpleaños— para que el test dé la misma edad cualquier día
 * que se corra.
 */
function nacimientoParaEdad(edad: number): string {
  const nacimiento = new Date();
  nacimiento.setFullYear(nacimiento.getFullYear() - edad);
  nacimiento.setDate(nacimiento.getDate() - 1);
  return nacimiento.toISOString().slice(0, 10);
}

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('alta', 'Nutrióloga de Prueba');
});

test.afterAll(async () => {
  await borrarCuentas(nutriologa);
  await prisma.$disconnect();
});

test('da de alta un paciente con expediente completo y lo persiste', async ({ page }) => {
  await iniciarSesion(page, nutriologa);

  await expect(page.getByText('Todavía no tienes pacientes')).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo paciente' }).click();

  // Paso 1 — datos generales
  const nacimiento = nacimientoParaEdad(EDAD_ESPERADA);
  await page.getByLabel('Nombre completo').fill('Paciente E2E Uno');
  await page.getByLabel('Fecha de nacimiento').fill(nacimiento);
  // El asistente deriva la edad de la fecha y la muestra al capturarla.
  await expect(page.getByText(`${EDAD_ESPERADA} años`)).toBeVisible();
  await page.getByLabel('Género').selectOption('Femenino');
  await page.getByLabel('Teléfono').fill('5512345678');
  await page.getByLabel('Email').fill('paciente-e2e@nutria.test');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 2 — expediente médico
  await page.getByRole('button', { name: 'Hipertensión' }).click();
  await page.getByLabel('Antecedentes relevantes').fill('Antecedente familiar cardiovascular.');
  await page.getByLabel('Medicamentos actuales').fill('Losartán 50mg');
  await page.getByLabel('Nivel de actividad').selectOption('Ligero');
  await page.getByLabel('Objetivo').selectOption('Pérdida de grasa');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 3 — antropometría
  await page.getByLabel('Peso (kg)').fill('78.5');
  await page.getByLabel('Altura (cm)').fill('162');
  await page.getByLabel('Cintura (cm)').fill('92');
  await page.getByLabel('Cadera (cm)').fill('104');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 4 — preferencias
  await page.getByRole('button', { name: 'Vegetariano', exact: true }).click();
  // Exacto: "Gluten" también coincidiría con el tipo de dieta "Sin gluten".
  await page.getByRole('button', { name: 'Gluten', exact: true }).click();
  await page.getByLabel('Alimentos que no le gustan').fill('cilantro');
  await page.getByRole('button', { name: 'Crear paciente' }).click();

  // Redirige al expediente recién creado.
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Paciente E2E Uno' })).toBeVisible();
  await expect(page.getByText(`${EDAD_ESPERADA} años`)).toBeVisible();

  // Los datos quedaron en la base, no en el navegador: se comprueban directo.
  const guardado = await prisma.patient.findFirst({
    where: { nutritionistId: nutriologa.id, nombre: 'Paciente E2E Uno' },
    include: { medicalRecord: true, foodPreference: true, measurements: true },
  });

  expect(guardado).not.toBeNull();
  // Lo persistido es la fecha capturada; la edad se deriva al leerla.
  expect(guardado?.fechaNacimiento?.toISOString().slice(0, 10)).toBe(nacimiento);
  expect(guardado?.medicalRecord?.objetivo).toBe('PERDIDA_DE_GRASA');
  expect(guardado?.medicalRecord?.nivelActividad).toBe('LIGERO');
  expect(guardado?.medicalRecord?.condiciones).toEqual(['Hipertensión']);
  expect(guardado?.foodPreference?.tipoDieta).toBe('Vegetariano');
  expect(guardado?.foodPreference?.alergias).toEqual(['Gluten']);
  expect(guardado?.measurements).toHaveLength(1);
  expect(guardado?.measurements[0]?.pesoKg).toBe(78.5);
  expect(guardado?.measurements[0]?.alturaCm).toBe(162);
});

test('el paciente sigue ahí tras recargar y en una sesión nueva', async ({ page, browser }) => {
  await iniciarSesion(page, nutriologa);

  await expect(page.getByText('Paciente E2E Uno')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Paciente E2E Uno')).toBeVisible();

  /**
   * Contexto nuevo (sin localStorage ni cookies previas): el dato viene del
   * servidor. Es un contexto propio y no un `clearCookies()` sobre el de arriba
   * porque el panel tiene peticiones en vuelo cuya respuesta trae la cookie de
   * sesión renovada; si llega después del borrado, lo deshace y la "sesión
   * nueva" ya venía autenticada.
   */
  const otroContexto = await browser.newContext();
  try {
    const otraPagina = await otroContexto.newPage();
    await iniciarSesion(otraPagina, nutriologa);
    await expect(otraPagina.getByText('Paciente E2E Uno')).toBeVisible();
  } finally {
    await otroContexto.close();
  }
});
