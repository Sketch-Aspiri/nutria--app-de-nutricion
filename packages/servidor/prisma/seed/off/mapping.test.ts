import { mapOffProduct } from './mapping';

describe('mapOffProduct', () => {
  it('convierte nutrimentos por 100 g a una porción con equivalente', () => {
    const result = mapOffProduct({
      code: '7501234567890',
      product_name_es: 'Avena integral',
      brands: 'Marca de prueba',
      categories_tags: ['en:breakfast-cereals'],
      nutriments: {
        'energy-kcal_100g': 380,
        proteins_100g: 13,
        fat_100g: 7,
        carbohydrates_100g: 68,
        fiber_100g: 10,
        sodium_100g: 0.01,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.food.ref).toBe('off:7501234567890');
    expect(result.food.grupo).toBe('cereales');
    expect(result.food.g).toBeGreaterThanOrEqual(5);
    expect(result.food.kcal).toBeGreaterThan(0);
    expect(result.food.na).toBeGreaterThanOrEqual(0);
  });

  it('descarta productos sin grupo o macronutrimentos completos', () => {
    expect(
      mapOffProduct({
        code: '7501234567890',
        product_name: 'Producto desconocido',
        categories_tags: ['en:miscellaneous'],
        nutriments: { 'energy-kcal_100g': 200 },
      }).ok,
    ).toBe(false);
  });
});
