import { expect, test } from '@playwright/test';

import {
  borrarCuentas,
  crearNutriologo,
  type CuentaPrueba,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #5: seguimiento sobre registros reales.
 *
 * Se siembran las comidas que el paciente capturaría desde la app móvil y se
 * comprueba que el panel muestra la adherencia y la racha que dicta
 * `packages/shared/adherencia` —no un porcentaje guardado en una columna— y
 * que el nutriólogo puede comentar una comida.
 *
 * Todos los datos son ficticios; la cuenta se crea y se borra en el test.
 */

/** Zona del consultorio: define el día natural con el que se mide adherencia. */
const ZONA = 'America/Mexico_City';
const DIA_MX = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const MS_DIA = 24 * 60 * 60 * 1000;

/** Día civil `YYYY-MM-DD` de hace `diasAtras` días, en la zona del consultorio. */
function diaMx(diasAtras: number): string {
  return DIA_MX.format(new Date(Date.now() - diasAtras * MS_DIA));
}

/**
 * Mediodía del consultorio de ese día. Se ancla al centro del día para que el
 * registro no pueda caer del otro lado de la medianoche por el desfase de zona.
 */
function medioDia(diasAtras: number): Date {
  return new Date(`${diaMx(diasAtras)}T18:00:00.000Z`);
}

const COMIDAS_POR_DIA = 3;
const DIAS_CON_REGISTRO = [0, 1, 2, 3];
const DIAS_VENTANA = 7;

// El plan se activó justo al inicio de la ventana, así que los siete días
// cuentan: 21 comidas esperadas contra 12 registradas.
const COMIDAS_ESPERADAS = DIAS_VENTANA * COMIDAS_POR_DIA;
const COMIDAS_REGISTRADAS = DIAS_CON_REGISTRO.length * COMIDAS_POR_DIA;
const ADHERENCIA = Math.round((COMIDAS_REGISTRADAS / COMIDAS_ESPERADAS) * 100);
const RACHA = DIAS_CON_REGISTRO.length;

const COMIDA_A_COMENTAR = 'Desayuno de hoy E2E';

let nutriologa: CuentaPrueba | undefined;
let otroNutriologo: CuentaPrueba | undefined;
let pacienteId = '';
let comidaComentadaId = '';

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('seg-a', 'Nutrióloga Seguimiento E2E');
  otroNutriologo = await crearNutriologo('seg-b', 'Nutriólogo Ajeno E2E');

  await prisma.nutritionistProfile.update({
    where: { userId: nutriologa.id },
    data: { zonaHoraria: ZONA },
  });

  const paciente = await prisma.patient.create({
    data: {
      nutritionistId: nutriologa.id,
      nombre: 'Paciente Seguimiento E2E',
      genero: 'FEMENINO',
      medicalRecord: { create: { objetivo: 'PERDIDA_DE_GRASA' } },
      foodPreference: { create: { comidasPorDia: COMIDAS_POR_DIA } },
    },
    select: { id: true },
  });
  pacienteId = paciente.id;

  // Plan activo desde el primer día de la ventana: es el denominador de la
  // adherencia, y sin él el panel diría "aún no hay plan activo".
  await prisma.mealPlan.create({
    data: {
      patientId: pacienteId,
      estado: 'ACTIVO',
      activadoAt: medioDia(DIAS_VENTANA - 1),
      caloriasDiarias: 1800,
      proteinaG: 120,
      carbosG: 205,
      grasaG: 60,
      meals: {
        create: [
          { orden: 1, nombre: 'Desayuno' },
          { orden: 2, nombre: 'Comida' },
          { orden: 3, nombre: 'Cena' },
        ],
      },
    },
  });

  for (const diasAtras of DIAS_CON_REGISTRO) {
    await prisma.mealLog.createMany({
      data: [
        {
          patientId: pacienteId,
          fecha: medioDia(diasAtras),
          nombre: diasAtras === 0 ? COMIDA_A_COMENTAR : `Desayuno día -${diasAtras}`,
          comentarioPaciente: diasAtras === 0 ? 'Me quedé con hambre.' : null,
        },
        {
          patientId: pacienteId,
          fecha: medioDia(diasAtras),
          nombre: `Comida día -${diasAtras}`,
        },
        {
          patientId: pacienteId,
          fecha: medioDia(diasAtras),
          nombre: `Cena día -${diasAtras}`,
        },
      ],
    });
  }

  comidaComentadaId = (
    await prisma.mealLog.findFirstOrThrow({
      where: { patientId: pacienteId, nombre: COMIDA_A_COMENTAR },
      select: { id: true },
    })
  ).id;

  await prisma.weightLog.createMany({
    data: [
      { patientId: pacienteId, fecha: new Date(`${diaMx(6)}T00:00:00.000Z`), pesoKg: 80 },
      { patientId: pacienteId, fecha: new Date(`${diaMx(0)}T00:00:00.000Z`), pesoKg: 78.5 },
    ],
  });

  await prisma.exerciseLog.create({
    data: {
      patientId: pacienteId,
      fecha: new Date(`${diaMx(1)}T00:00:00.000Z`),
      tipo: 'Caminata',
      duracionMin: 40,
    },
  });
});

test.afterAll(async () => {
  try {
    const cuentas = [nutriologa, otroNutriologo].filter(
      (cuenta): cuenta is CuentaPrueba => Boolean(cuenta),
    );
    if (cuentas.length > 0) await borrarCuentas(...cuentas);
  } finally {
    await prisma.$disconnect();
  }
});

test('calcula adherencia y racha sobre los registros del paciente y permite comentarlos', async ({
  context,
  page,
}) => {
  if (!nutriologa || !otroNutriologo || !pacienteId || !comidaComentadaId) {
    throw new Error('No se pudo preparar el fixture aislado del E2E de seguimiento.');
  }

  await iniciarSesion(page, nutriologa);
  await page.goto(`/pacientes/${pacienteId}`);
  await page.getByRole('button', { name: 'Seguimiento' }).click();

  // --- Adherencia calculada, no almacenada -----------------------------------
  const resumen = page.getByTestId('resumen-adherencia');
  await expect(resumen).toContainText(`${ADHERENCIA}%`);
  await expect(resumen).toContainText(
    `${COMIDAS_REGISTRADAS} de ${COMIDAS_ESPERADAS} comidas registradas en ${DIAS_VENTANA} días`,
  );
  await expect(page.getByTestId('racha')).toContainText(`${RACHA} días seguidos`);
  await expect(page.getByText('Peso: 80 kg →')).toBeVisible();
  await expect(page.getByText('78.5 kg', { exact: true })).toBeVisible();

  // 57 % está por encima del umbral de alerta (50 %), así que no se avisa.
  await expect(page.getByText(/Adherencia baja/)).toHaveCount(0);

  // La API responde lo mismo que pinta la UI: el cálculo vive en el servidor.
  const adherencia = await page.request.get(
    `/api/v1/patients/${pacienteId}/adherence?dias=${DIAS_VENTANA}`,
  );
  expect(adherencia.status()).toBe(200);
  expect(await adherencia.json()).toMatchObject({
    adherencia: ADHERENCIA,
    racha: RACHA,
    dias_evaluados: DIAS_VENTANA,
    comidas_registradas: COMIDAS_REGISTRADAS,
    comidas_esperadas: COMIDAS_ESPERADAS,
    comidas_por_dia: COMIDAS_POR_DIA,
    plan_activo_desde: diaMx(DIAS_VENTANA - 1),
    zona_horaria: ZONA,
  });

  // --- Comidas registradas por el paciente -----------------------------------
  await expect(page.getByTestId('comida-registrada')).toHaveCount(COMIDAS_REGISTRADAS);
  const comidaDeHoy = page
    .getByTestId('comida-registrada')
    .filter({ hasText: COMIDA_A_COMENTAR });
  await expect(comidaDeHoy).toContainText('Me quedé con hambre.');
  await expect(page.getByText('Caminata')).toBeVisible();

  // --- El nutriólogo comenta una comida --------------------------------------
  const COMENTARIO = 'Súmale una fruta a este desayuno y avísame cómo te sientes.';
  const campo = comidaDeHoy.getByLabel(`Comentario sobre ${COMIDA_A_COMENTAR}`);
  await campo.fill(COMENTARIO);
  // El comentario se guarda al salir del campo, no en cada tecla.
  await campo.blur();

  await expect
    .poll(
      async () =>
        (await prisma.mealLog.findUniqueOrThrow({ where: { id: comidaComentadaId } }))
          .comentarioNutriologo,
      { message: 'el comentario del nutriólogo debe persistirse' },
    )
    .toBe(COMENTARIO);

  // Lo que escribió el paciente sobre su propia comida no se reescribe.
  expect(
    (await prisma.mealLog.findUniqueOrThrow({ where: { id: comidaComentadaId } }))
      .comentarioPaciente,
  ).toBe('Me quedé con hambre.');

  // El comentario viene del servidor tras recargar, no del estado del navegador.
  await page.reload();
  await page.getByRole('button', { name: 'Seguimiento' }).click();
  await expect(
    page
      .getByTestId('comida-registrada')
      .filter({ hasText: COMIDA_A_COMENTAR })
      .getByLabel(`Comentario sobre ${COMIDA_A_COMENTAR}`),
  ).toHaveValue(COMENTARIO);

  // --- Aislamiento entre nutriólogos ----------------------------------------
  await context.clearCookies();
  await iniciarSesion(page, otroNutriologo);

  // Mismo UUID, otra cuenta: 404 y no 403, para no revelar que existe.
  const adherenciaAjena = await page.request.get(
    `/api/v1/patients/${pacienteId}/adherence`,
  );
  expect(adherenciaAjena.status()).toBe(404);

  const comentarioAjeno = await page.request.patch(
    `/api/v1/meal_logs/${comidaComentadaId}`,
    { data: { comentario_nutriologo: 'Comentario de quien no lo atiende.' } },
  );
  expect(comentarioAjeno.status()).toBe(404);
  expect(
    (await prisma.mealLog.findUniqueOrThrow({ where: { id: comidaComentadaId } }))
      .comentarioNutriologo,
  ).toBe(COMENTARIO);
});
