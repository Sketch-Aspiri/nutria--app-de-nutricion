import {
  crearPlanSchema,
  crearPlantillaSchema,
  itemPlanSchema,
} from './schemas';

const FOOD_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';

describe('schemas de planes', () => {
  it('acepta un item ligado a food sin confiar en macros del cliente', () => {
    const resultado = itemPlanSchema.safeParse({
      food_id: FOOD_ID,
      cantidad_porciones: 1.5,
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.cantidad_porciones).toBe(1.5);
      expect(resultado.data.energia_kcal).toBeUndefined();
    }
  });

  it('exige descripción y macros en un item libre', () => {
    const resultado = itemPlanSchema.safeParse({ cantidad_porciones: 1 });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining([
          'descripcion_libre',
          'energia_kcal',
          'proteina_g',
          'carbohidratos_g',
          'lipidos_g',
        ]),
      );
    }
  });

  it('exige metas nutricionales para un plan manual', () => {
    const resultado = crearPlanSchema.safeParse({
      estado: 'BORRADOR',
      comidas: [],
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining([
          'calorias_diarias',
          'proteina_g',
          'carbos_g',
          'grasa_g',
        ]),
      );
    }
  });

  it('permite materializar un plan indicando solamente una plantilla', () => {
    expect(
      crearPlanSchema.safeParse({ plantilla_id: TEMPLATE_ID }).success,
    ).toBe(true);
  });

  it('valida la estructura completa de una plantilla', () => {
    const resultado = crearPlantillaSchema.safeParse({
      nombre: 'Plan base',
      objetivo: 'MANTENIMIENTO',
      calorias: 1_800,
      descripcion: null,
      estructura: {
        comidas: [
          {
            nombre: 'Desayuno',
            items: [
              {
                descripcion_libre: 'Preparación propia',
                cantidad_porciones: 1,
                energia_kcal: 350,
                proteina_g: 20,
                carbohidratos_g: 45,
                lipidos_g: 10,
              },
            ],
          },
        ],
      },
    });

    expect(resultado.success).toBe(true);
  });
});
