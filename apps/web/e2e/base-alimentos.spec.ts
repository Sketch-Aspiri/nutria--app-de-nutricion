import { expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  borrarCuentas,
  crearNutriologo,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Fase 3 del plan V2: la base de alimentos.
 *
 * Cubre lo que tiene que funcionar para que un nutriólogo la use en consulta:
 * que el catálogo sembrado esté ahí, que la búsqueda difusa encuentre lo que
 * se escribe como se escribe en México, que pueda capturar sus propios
 * alimentos, y que esos alimentos no se le aparezcan a nadie más.
 */

let nutriologa: CuentaPrueba;
let otroNutriologo: CuentaPrueba;

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('alim-a', 'Nutrióloga Alimentos');
  otroNutriologo = await crearNutriologo('alim-b', 'Nutriólogo Ajeno');
});

test.afterAll(async () => {
  await borrarCuentas(nutriologa, otroNutriologo);
  await prisma.$disconnect();
});

test('el catálogo sembrado está disponible y clasificado por grupos', async ({ page }) => {
  await iniciarSesion(page, nutriologa);

  const respuesta = await page.request.get('/api/v1/foods/groups');
  expect(respuesta.status()).toBe(200);

  const cuerpo = (await respuesta.json()) as {
    data: { grupo: string; nombre: string; total: number }[];
  };

  const cereales = cuerpo.data.find((grupo) => grupo.grupo === 'cereales');
  expect(cereales?.total).toBeGreaterThan(0);

  const total = cuerpo.data.reduce((suma, grupo) => suma + grupo.total, 0);
  expect(total).toBeGreaterThanOrEqual(150);
});

test('la búsqueda tolera acentos, plurales y sinónimos mexicanos', async ({ page }) => {
  await iniciarSesion(page, nutriologa);

  const buscar = async (consulta: string) => {
    const respuesta = await page.request.get(
      `/api/v1/foods?query=${encodeURIComponent(consulta)}`,
    );
    expect(respuesta.status()).toBe(200);
    const cuerpo = (await respuesta.json()) as { data: { nombre: string }[] };
    return cuerpo.data.map((alimento) => alimento.nombre);
  };

  expect(await buscar('PLÁTANO')).toContain('Plátano tabasco');
  expect(await buscar('platano')).toContain('Plátano tabasco');
  // Sinonimia: quien escribe "tomate rojo" busca el jitomate.
  expect(await buscar('tomate rojo')).toContain('Jitomate');
  // Palabra dentro de un nombre largo.
  expect(await buscar('pollo')).toContain('Pechuga de pollo sin piel, cocida');
});

test('cada alimento trae la ficha completa y sus equivalentes', async ({ page }) => {
  await iniciarSesion(page, nutriologa);

  const respuesta = await page.request.get('/api/v1/foods?query=tortilla%20de%20maiz');
  const cuerpo = (await respuesta.json()) as {
    data: {
      nombre: string;
      porcion_gramos: number;
      energia_kcal: number;
      calcio_mg: number | null;
      equivalentes: Record<string, number>;
    }[];
  };

  const tortilla = cuerpo.data.find((alimento) => alimento.nombre === 'Tortilla de maíz');
  expect(tortilla).toBeDefined();
  expect(tortilla?.porcion_gramos).toBeGreaterThan(0);
  expect(tortilla?.energia_kcal).toBeGreaterThan(0);
  expect(tortilla?.calcio_mg).not.toBeNull();
  expect(tortilla?.equivalentes).toEqual({ cereales: 1 });
});

test('el nutriólogo captura un alimento propio y lo encuentra en el buscador', async ({
  page,
}) => {
  await iniciarSesion(page, nutriologa);
  await page.goto('/alimentos');

  await page.getByRole('button', { name: 'Nuevo alimento' }).click();
  await page.getByLabel('Nombre').fill('Tamal de rajas de la casa');
  await page.getByLabel('Grupo de equivalentes').selectOption('cereales');
  await page.getByLabel('Porción', { exact: true }).fill('1 pieza');
  await page.getByLabel('Gramos de la porción').fill('110');
  await page.getByLabel('Energía (kcal)').fill('230');
  await page.getByLabel('Proteína (g)').fill('5');
  await page.getByLabel('Lípidos (g)').fill('9');
  await page.getByLabel('Hidratos de carbono (g)').fill('32');

  await page.getByRole('button', { name: 'Agregar alimento' }).click();

  await expect(page.getByText('Tamal de rajas de la casa').first()).toBeVisible();
  await expect(page.getByText('Propio').first()).toBeVisible();
});

test('el alimento propio de una nutrióloga no existe para otro nutriólogo', async ({ page }) => {
  await iniciarSesion(page, otroNutriologo);

  const respuesta = await page.request.get('/api/v1/foods?query=tamal%20de%20rajas');
  const cuerpo = (await respuesta.json()) as { data: { nombre: string }[] };

  expect(cuerpo.data.map((alimento) => alimento.nombre)).not.toContain(
    'Tamal de rajas de la casa',
  );
});

test('el buscador de la pestaña de plan trae la base real', async ({ page }) => {
  await iniciarSesion(page, nutriologa);

  // El plan necesita un expediente que permita calcular: sin requerimiento
  // guardado, la pestaña se niega a abrir el editor en vez de inventar metas.
  const paciente = await prisma.patient.create({
    data: {
      nutritionistId: nutriologa.id,
      nombre: 'Paciente Para Plan',
      fechaNacimiento: new Date('1990-01-15'),
      genero: 'FEMENINO',
      medicalRecord: { create: { objetivo: 'MANTENIMIENTO', nivelActividad: 'LIGERO' } },
      foodPreference: { create: {} },
      measurements: {
        create: { fecha: new Date(), pesoKg: 65, alturaCm: 165 },
      },
    },
    select: { id: true },
  });

  await page.goto(`/pacientes/${paciente.id}`);
  await page.getByRole('button', { name: 'Cálculo' }).click();
  await page.getByRole('button', { name: 'Guardar cálculo en el plan' }).click();
  await expect(page.getByText('Último guardado:')).toBeVisible();

  await page.getByRole('button', { name: 'Plan alimenticio' }).click();
  // El buscador cuelga de cada comida del plan; se usa el de la primera.
  await page.getByRole('button', { name: 'Buscar alimento' }).first().click();

  await page.getByLabel('Buscar alimento').fill('frijol');
  await expect(page.getByText('Frijol negro cocido')).toBeVisible();

  await page.getByRole('button', { name: 'Agregar Frijol negro cocido' }).click();

  // El alimento pasa al borrador con la porción y los nutrimentos de la base,
  // no con valores capturados a mano.
  await expect(page.getByText('1/2 taza · 86 g por porción')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Kcal' })).toHaveValue('114');
});

test('un alimento propio se retira sin borrar el histórico', async ({ page }) => {
  await iniciarSesion(page, nutriologa);

  const propio = await prisma.food.create({
    data: {
      nombre: 'Agua de jamaica de la consulta',
      nombreNormalizado: 'agua de jamaica de la consulta',
      grupoSmae: 'azucares',
      porcionDescripcion: '1 vaso',
      porcionGramos: 240,
      energiaKcal: 80,
      proteinaG: 0,
      lipidosG: 0,
      carbohidratosG: 20,
      equivalentes: { azucares: 2 },
      fuente: 'PROPIA',
      esPublico: false,
      nutritionistId: nutriologa.id,
    },
    select: { id: true },
  });

  const respuesta = await page.request.delete(`/api/v1/foods/${propio.id}`);
  expect(respuesta.status()).toBe(204);

  // Baja lógica: la fila sigue ahí para los planes que ya la citan.
  const enBase = await prisma.food.findUnique({ where: { id: propio.id } });
  expect(enBase?.deletedAt).not.toBeNull();

  const busqueda = await page.request.get('/api/v1/foods?query=jamaica');
  const cuerpo = (await busqueda.json()) as { data: { id: string }[] };
  expect(cuerpo.data.map((alimento) => alimento.id)).not.toContain(propio.id);
});

test('no se puede editar ni borrar el alimento de otro nutriólogo', async ({ page }) => {
  const ajeno = await prisma.food.create({
    data: {
      nombre: 'Receta privada de la nutrióloga',
      nombreNormalizado: 'receta privada de la nutriologa',
      grupoSmae: 'cereales',
      porcionDescripcion: '1 porción',
      porcionGramos: 100,
      energiaKcal: 140,
      proteinaG: 4,
      lipidosG: 2,
      carbohidratosG: 26,
      equivalentes: { cereales: 2 },
      fuente: 'PROPIA',
      esPublico: false,
      nutritionistId: nutriologa.id,
    },
    select: { id: true },
  });

  await iniciarSesion(page, otroNutriologo);

  // 404 y no 403: un 403 confirmaría que el identificador existe.
  const lectura = await page.request.get(`/api/v1/foods/${ajeno.id}`);
  expect(lectura.status()).toBe(404);

  const edicion = await page.request.patch(`/api/v1/foods/${ajeno.id}`, {
    data: { nombre: 'Secuestrado' },
  });
  expect(edicion.status()).toBe(404);

  const borrado = await page.request.delete(`/api/v1/foods/${ajeno.id}`);
  expect(borrado.status()).toBe(404);

  const sigueIgual = await prisma.food.findUnique({ where: { id: ajeno.id } });
  expect(sigueIgual?.nombre).toBe('Receta privada de la nutrióloga');
  expect(sigueIgual?.deletedAt).toBeNull();
});

test('el catálogo público no se puede editar desde la API', async ({ page }) => {
  await iniciarSesion(page, nutriologa);

  const publico = await prisma.food.findFirstOrThrow({
    where: { esPublico: true, nutritionistId: null, deletedAt: null },
    select: { id: true, nombre: true },
  });

  const edicion = await page.request.patch(`/api/v1/foods/${publico.id}`, {
    data: { energia_kcal: 1 },
  });
  expect(edicion.status()).toBe(404);

  const sigueIgual = await prisma.food.findUnique({ where: { id: publico.id } });
  expect(sigueIgual?.nombre).toBe(publico.nombre);
});
