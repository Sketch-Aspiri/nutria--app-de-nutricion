/**
 * @jest-environment node
 */
import { enriquecerPlanBorrador } from './borrador';
import type { AlimentoCatalogo } from './contexto';
import type { PlanBorrador } from './schemas';

const ALIMENTO: AlimentoCatalogo = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  nombre: 'Tortilla de maíz',
  grupo: 'cereales',
  porcion: '1 pieza (30 g)',
  porcionDescripcion: '1 pieza',
  porcionGramos: 30,
  imagenUrl: 'https://blob.test/tortilla.png',
  energiaKcal: 70,
  proteinaG: 2,
  carbosG: 14,
  lipidosG: 1,
};

const BORRADOR: PlanBorrador = {
  calorias_diarias: 2_000,
  proteina_g: 120,
  carbos_g: 200,
  grasa_g: 70,
  nota: 'Revisar porciones.',
  comidas: [
    {
      nombre: 'Desayuno',
      horario: '08:00',
      descripcion: '  ',
      items: [
        { food_id: ALIMENTO.id, descripcion: 'Dos tortillas', cantidad_porciones: 2 },
        { food_id: null, descripcion: 'Café americano', cantidad_porciones: 1 },
      ],
    },
  ],
};

describe('enriquecerPlanBorrador', () => {
  it('resuelve el alimento del catálogo y escala sus nutrimentos por la cantidad', () => {
    const plan = enriquecerPlanBorrador(BORRADOR, [ALIMENTO]);

    expect(plan.comidas[0]?.items[0]).toEqual({
      food_id: ALIMENTO.id,
      descripcion_libre: null,
      cantidad_porciones: 2,
      energia_kcal: 140,
      proteina_g: 4,
      carbohidratos_g: 28,
      lipidos_g: 2,
      food: {
        id: ALIMENTO.id,
        nombre: 'Tortilla de maíz',
        grupo: 'cereales',
        porcion_descripcion: '1 pieza',
        porcion_gramos: 30,
        imagen_url: 'https://blob.test/tortilla.png',
      },
    });
  });

  it('deja los items libres en ceros para que el nutriólogo los capture', () => {
    const plan = enriquecerPlanBorrador(BORRADOR, [ALIMENTO]);

    expect(plan.comidas[0]?.items[1]).toMatchObject({
      food_id: null,
      descripcion_libre: 'Café americano',
      energia_kcal: 0,
      proteina_g: 0,
      food: null,
    });
  });

  it('degrada a item libre un food_id que ya no está en el catálogo', () => {
    const plan = enriquecerPlanBorrador(BORRADOR, []);

    expect(plan.comidas[0]?.items[0]).toMatchObject({
      food_id: null,
      descripcion_libre: 'Dos tortillas',
      energia_kcal: 0,
    });
  });

  it('numera las comidas y normaliza el texto vacío a null', () => {
    const plan = enriquecerPlanBorrador(BORRADOR, [ALIMENTO]);

    expect(plan.comidas[0]).toMatchObject({ orden: 0, horario: '08:00', descripcion: null });
  });

  it('suma los totales desde los alimentos, no desde lo que dijo la IA', () => {
    const plan = enriquecerPlanBorrador(BORRADOR, [ALIMENTO]);

    // La IA declaró 2000 kcal, pero los items solo suman las dos tortillas.
    expect(plan.calorias_diarias).toBe(2_000);
    expect(plan.totales).toEqual({
      energia_kcal: 140,
      proteina_g: 4,
      carbohidratos_g: 28,
      lipidos_g: 2,
    });
  });

  it('redondea a dos decimales con cantidades fraccionarias', () => {
    const borrador: PlanBorrador = {
      ...BORRADOR,
      comidas: [
        {
          nombre: 'Colación',
          horario: '11:00',
          descripcion: '',
          items: [{ food_id: ALIMENTO.id, descripcion: 'Media pieza', cantidad_porciones: 0.33 }],
        },
      ],
    };

    expect(enriquecerPlanBorrador(borrador, [ALIMENTO]).totales.energia_kcal).toBe(23.1);
  });
});
