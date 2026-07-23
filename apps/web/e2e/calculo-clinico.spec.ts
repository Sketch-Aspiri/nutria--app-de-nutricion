import { type Page, expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  borrarCuentas,
  crearNutriologo,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #3 del plan V2: cálculo clínico.
 *
 * Los valores esperados salen de aplicar las fórmulas de `packages/shared` al
 * expediente sembrado, no de leer la propia UI. Paciente: mujer de 34 años,
 * 78.5 kg, 162 cm, cintura 92, cadera 104, actividad ligera, pérdida de grasa.
 *   Mifflin-St Jeor: 10(78.5) + 6.25(162) − 5(34) − 161 = 1467 kcal
 *   TDEE: 1467 × 1.375 = 2017 · objetivo (−20 %): 1614 kcal
 *   Harris-Benedict revisada: 1528 · TDEE 2101 · objetivo 1681
 *   IMC: 78.5 / 1.62² = 29.9 (sobrepeso) · cintura/cadera 0.88
 */

const PESO = 78.5;
const ALTURA = 162;
const EDAD = 34;

const MIFFLIN = { bmr: 1467, tdee: 2017, objetivo: 1614 };
const HARRIS_BENEDICT = { bmr: 1528, objetivo: 1681 };
const MACROS = { proteina: 121, carbos: 161, grasa: 54 };

const PLIEGUES = { tricipital: '22', bicipital: '12', subescapular: '24', suprailiaco: '26' };

let nutriologa: CuentaPrueba;

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('calculo', 'Nutrióloga de Cálculo');
});

test.afterAll(async () => {
  await borrarCuentas(nutriologa);
  await prisma.$disconnect();
});

/** Un paciente nuevo por test: ninguno depende de lo que hizo el anterior. */
async function sembrarPaciente(conMedidas = true): Promise<string> {
  const nacimiento = new Date();
  nacimiento.setFullYear(nacimiento.getFullYear() - EDAD);
  nacimiento.setMonth(0, 15);

  const paciente = await prisma.patient.create({
    data: {
      nutritionistId: nutriologa.id,
      nombre: `Paciente Cálculo ${Date.now().toString(36)}`,
      fechaNacimiento: nacimiento,
      genero: 'FEMENINO',
      medicalRecord: {
        create: { nivelActividad: 'LIGERO', objetivo: 'PERDIDA_DE_GRASA', condiciones: [] },
      },
      foodPreference: { create: {} },
      ...(conMedidas
        ? {
            measurements: {
              create: {
                fecha: new Date(),
                pesoKg: PESO,
                alturaCm: ALTURA,
                cinturaCm: 92,
                caderaCm: 104,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return paciente.id;
}

async function abrirCalculo(page: Page, pacienteId: string) {
  await iniciarSesion(page, nutriologa);
  await page.goto(`/pacientes/${pacienteId}`);
  await page.getByRole('button', { name: 'Cálculo' }).click();
}

test('muestra BMR, TDEE y macros correctos con la ecuación por defecto', async ({ page }) => {
  await abrirCalculo(page, await sembrarPaciente());

  await expect(page.getByText(String(MIFFLIN.bmr)).first()).toBeVisible();
  await expect(page.getByText(String(MIFFLIN.tdee)).first()).toBeVisible();
  await expect(page.getByText(String(MIFFLIN.objetivo)).first()).toBeVisible();

  await expect(page.getByText(`${MACROS.proteina}g`)).toBeVisible();
  await expect(page.getByText(`${MACROS.carbos}g`)).toBeVisible();
  await expect(page.getByText(`${MACROS.grasa}g`)).toBeVisible();
});

test('valora la antropometría con IMC clasificado e índices de riesgo', async ({ page }) => {
  await abrirCalculo(page, await sembrarPaciente());

  await expect(page.getByText('29.9')).toBeVisible();
  await expect(page.getByText('Sobrepeso', { exact: true })).toBeVisible();
  // Cintura/cadera 92/104 = 0.88, por encima del corte femenino de 0.85.
  await expect(page.getByText('0.88')).toBeVisible();
  // Cintura/talla 92/162 = 0.57: riesgo aumentado.
  await expect(page.getByText('0.57')).toBeVisible();
});

test('cambiar de ecuación recalcula el resultado sin recargar', async ({ page }) => {
  await abrirCalculo(page, await sembrarPaciente());

  await page.getByLabel('Harris-Benedict (revisada)').check();

  await expect(page.getByText(String(HARRIS_BENEDICT.objetivo)).first()).toBeVisible();
  // El objetivo de Mifflin solo aparece en el resultado, no en la comparativa.
  await expect(page.getByText(String(MIFFLIN.objetivo))).toHaveCount(0);
});

test('Katch-McArdle queda deshabilitada hasta capturar los cuatro pliegues', async ({ page }) => {
  await abrirCalculo(page, await sembrarPaciente());

  const katch = page.getByLabel('Katch-McArdle');
  await expect(katch).toBeDisabled();
  await expect(page.getByText('Requiere % de grasa corporal medido.')).toBeVisible();

  await page.getByLabel('Tricipital (mm)').fill(PLIEGUES.tricipital);
  await page.getByLabel('Bicipital (mm)').fill(PLIEGUES.bicipital);
  await page.getByLabel('Subescapular (mm)').fill(PLIEGUES.subescapular);
  await page.getByLabel('Suprailiaco (mm)').fill(PLIEGUES.suprailiaco);
  await page.getByRole('button', { name: 'Guardar pliegues' }).click();

  await expect(page.getByText('Medición registrada')).toBeVisible();
  await expect(katch).toBeEnabled();
  // Σ 22+12+24+26 = 84 mm → 35 % de grasa por Durnin-Womersley.
  await expect(page.getByText('Durnin-Womersley · Σ 84 mm')).toBeVisible();
  await expect(page.getByText('35%', { exact: true })).toBeVisible();
});

test('reparte las calorías en equivalentes SMAE por grupo', async ({ page }) => {
  await abrirCalculo(page, await sembrarPaciente());

  const tabla = page.getByRole('table', { name: 'Equivalentes por grupo de alimentos' });
  await expect(tabla).toBeVisible();
  await expect(tabla.getByRole('rowheader', { name: 'Verduras' })).toBeVisible();
  await expect(tabla.getByRole('rowheader', { name: 'Cereales sin grasa' })).toBeVisible();
  await expect(tabla.getByRole('rowheader', { name: 'Origen animal bajo en grasa' })).toBeVisible();

  // El reparto no puede alejarse de la meta más de lo que tolera el módulo (±5 %).
  await expect(
    page.getByText(/Diferencia con la meta: [+-]?\d+ kcal \([+-]?[0-5](\.\d)?%\)/),
  ).toBeVisible();
});

test('guarda el cálculo en la base y lo recupera al volver', async ({ page }) => {
  const pacienteId = await sembrarPaciente();
  await abrirCalculo(page, pacienteId);

  await page.getByLabel('Harris-Benedict (revisada)').check();
  await page.getByRole('button', { name: 'Guardar cálculo en el plan' }).click();
  await expect(page.getByText('Último guardado:')).toBeVisible();

  // El snapshot quedó en el plan del paciente, con las entradas que lo produjeron.
  const plan = await prisma.mealPlan.findFirst({ where: { patientId: pacienteId } });
  expect(plan).not.toBeNull();

  const snapshot = plan?.calculoSnapshot as {
    version: number;
    resultado: { ecuacion: string; bmr: number; objetivoCalorias: number };
    entradas: { peso: number; altura: number; edad: number };
    equivalentes: { renglones: unknown[] };
  } | null;

  expect(snapshot?.version).toBe(1);
  expect(snapshot?.resultado.ecuacion).toBe('harris_benedict');
  expect(snapshot?.resultado.bmr).toBe(HARRIS_BENEDICT.bmr);
  expect(snapshot?.entradas).toMatchObject({ peso: PESO, altura: ALTURA, edad: EDAD });
  expect(snapshot?.equivalentes.renglones.length).toBeGreaterThan(0);
  // Las metas del plan salen del propio snapshot, no de un número aparte.
  expect(plan?.caloriasDiarias).toBe(snapshot?.resultado.objetivoCalorias);

  // Al reabrir la pestaña se reproduce la ecuación guardada, no la de por defecto.
  await page.reload();
  await page.getByRole('button', { name: 'Cálculo' }).click();
  await expect(page.getByLabel('Harris-Benedict (revisada)')).toBeChecked();
  await expect(page.getByText('Último guardado:')).toBeVisible();
});

test('un expediente sin medidas no calcula: lo dice en vez de inventar', async ({ page }) => {
  await abrirCalculo(page, await sembrarPaciente(false));

  await expect(page.getByText('El expediente está incompleto', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar cálculo en el plan' })).toHaveCount(0);
});
