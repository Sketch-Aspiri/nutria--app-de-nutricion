/**
 * @jest-environment node
 */
import {
  caloriasPorPorcion,
  descripcionDeItem,
  ingredientesDeReceta,
  pasosDeReceta,
  porcionDeItem,
} from './calculos';
import type { ItemPlan, Receta } from './types';

function item(parcial: Partial<ItemPlan>): ItemPlan {
  return {
    id: 'item-1',
    descripcion_libre: null,
    cantidad_porciones: 1,
    energia_kcal: 120,
    proteina_g: 8,
    carbohidratos_g: 14,
    lipidos_g: 3,
    food: { nombre: 'Avena', porcion_descripcion: '1 taza' },
    ...parcial,
  };
}

function receta(parcial: Partial<Receta>): Receta {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Avena con fruta',
    ingredientes: ['1 taza de avena', '1 plátano'],
    pasos: null,
    calorias: 400,
    porciones: 2,
    origen: 'MANUAL',
    updated_at: '2026-07-30T12:00:00.000Z',
    ...parcial,
  };
}

describe('porcionDeItem', () => {
  it('omite el multiplicador cuando es una porción exacta', () => {
    expect(porcionDeItem(item({ cantidad_porciones: 1 }))).toBe('1 taza');
  });

  it('muestra medias porciones tal como las capturó la nutrióloga', () => {
    expect(porcionDeItem(item({ cantidad_porciones: 1.5 }))).toBe('1.5 × 1 taza');
  });

  it('no arrastra decimales de punto flotante al texto', () => {
    // 0.1 + 0.2 acabaría en "0.30000000000000004 × 1 taza" sin el redondeo.
    expect(porcionDeItem(item({ cantidad_porciones: 0.1 + 0.2 }))).toBe('0.3 × 1 taza');
  });

  it('calla si el alimento no trae descripción de porción', () => {
    expect(
      porcionDeItem(item({ food: { nombre: 'Avena', porcion_descripcion: null } })),
    ).toBeNull();
    expect(porcionDeItem(item({ food: null }))).toBeNull();
  });

  it('ignora una cantidad corrupta en vez de escribir NaN', () => {
    expect(porcionDeItem(item({ cantidad_porciones: Number.NaN }))).toBe('1 taza');
    expect(porcionDeItem(item({ cantidad_porciones: null }))).toBe('1 taza');
  });
});

describe('descripcionDeItem', () => {
  it('junta alimento y porción', () => {
    expect(descripcionDeItem(item({}))).toBe('Avena — 1 taza');
  });

  it('cae en la descripción libre cuando no hay alimento del catálogo', () => {
    expect(descripcionDeItem(item({ food: null, descripcion_libre: 'Fruta de temporada' }))).toBe(
      'Fruta de temporada',
    );
  });

  it('no deja el renglón vacío si no hay nada que nombrar', () => {
    expect(descripcionDeItem(item({ food: null, descripcion_libre: null }))).toBe('Alimento');
  });
});

describe('ingredientesDeReceta', () => {
  it('normaliza espacios y descarta vacíos', () => {
    expect(
      ingredientesDeReceta(receta({ ingredientes: ['  1 taza de avena ', '', '   '] })),
    ).toEqual(['1 taza de avena']);
  });

  it('sobrevive a un JSON con elementos que no son texto', () => {
    // La columna es `Json`: una receta vieja podría traer objetos o nulos.
    expect(
      ingredientesDeReceta(receta({ ingredientes: ['Sal', null, 42, { nombre: 'Aceite' }] })),
    ).toEqual(['Sal']);
  });

  it('devuelve una lista vacía si el JSON no es un arreglo', () => {
    expect(ingredientesDeReceta(receta({ ingredientes: 'Sal' as unknown as unknown[] }))).toEqual(
      [],
    );
  });
});

describe('pasosDeReceta', () => {
  it('parte el texto por líneas', () => {
    expect(pasosDeReceta(receta({ pasos: 'Calienta el agua\nAgrega la avena' }))).toEqual([
      'Calienta el agua',
      'Agrega la avena',
    ]);
  });

  it('quita la numeración manual para no duplicarla al pintar', () => {
    expect(
      pasosDeReceta(receta({ pasos: '1. Calienta el agua\n2) Agrega la avena\n- Sirve' })),
    ).toEqual(['Calienta el agua', 'Agrega la avena', 'Sirve']);
  });

  it('no inventa pasos cuando la receta no los trae', () => {
    expect(pasosDeReceta(receta({ pasos: null }))).toEqual([]);
    expect(pasosDeReceta(receta({ pasos: '   \n  ' }))).toEqual([]);
  });
});

describe('caloriasPorPorcion', () => {
  it('divide el total entre las porciones', () => {
    expect(caloriasPorPorcion(receta({ calorias: 400, porciones: 2 }))).toBe(200);
  });

  it('no divide entre cero si el dato viene corrupto', () => {
    expect(caloriasPorPorcion(receta({ calorias: 400, porciones: 0 }))).toBe(400);
  });

  it('devuelve null cuando la receta no tiene calorías, sin inventar un cero', () => {
    expect(caloriasPorPorcion(receta({ calorias: null }))).toBeNull();
  });
});
