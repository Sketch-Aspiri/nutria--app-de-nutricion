/**
 * @jest-environment node
 */
import type { Food } from '@prisma/client';

import { serializarAlimento } from './serializers';

const NUTRIOLOGO = 'a1b2c3d4-0000-4000-8000-000000000001';
const OTRO_NUTRIOLOGO = 'a1b2c3d4-0000-4000-8000-000000000002';

function alimento(overrides: Partial<Food> = {}): Food {
  return {
    id: 'f0000000-0000-4000-8000-000000000001',
    nombre: 'Tortilla de maíz',
    nombreNormalizado: 'tortilla de maiz',
    grupoSmae: 'cereales',
    subgrupo: 'sin grasa',
    porcionDescripcion: '1 pieza',
    porcionGramos: 30,
    energiaKcal: 66,
    proteinaG: 1.7,
    lipidosG: 0.8,
    carbohidratosG: 13.8,
    saturadasG: 0.1,
    colesterolMg: 0,
    fibraG: 1.7,
    azucarG: null,
    sodioMg: 3,
    potasioMg: 55,
    calcioMg: 46,
    hierroMg: 0.4,
    acidoFolicoUg: null,
    vitaminaAUg: null,
    vitaminaCMg: null,
    indiceGlicemico: null,
    equivalentes: { cereales: 1 },
    imagenUrl: null,
    fuente: 'INCMNSZ',
    fuenteRef: 'mx:tortilla-de-maiz',
    esPublico: true,
    nutritionistId: null,
    createdAt: new Date('2026-07-23T00:00:00Z'),
    updatedAt: new Date('2026-07-23T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as Food;
}

describe('serializarAlimento', () => {
  it('traduce la fila a los campos snake_case del contrato', () => {
    const ficha = serializarAlimento(alimento(), NUTRIOLOGO);

    expect(ficha.porcion_descripcion).toBe('1 pieza');
    expect(ficha.energia_kcal).toBe(66);
    expect(ficha.acido_folico_ug).toBeNull();
  });

  it('baja la fuente a minúsculas, como la nombra el dominio', () => {
    expect(serializarAlimento(alimento(), NUTRIOLOGO).fuente).toBe('incmnsz');
  });

  it('marca como propio el alimento del nutriólogo que consulta', () => {
    const propio = alimento({ nutritionistId: NUTRIOLOGO, fuente: 'PROPIA', esPublico: false });

    expect(serializarAlimento(propio, NUTRIOLOGO).es_propio).toBe(true);
  });

  it('no marca como propio el alimento de otro nutriólogo', () => {
    const ajeno = alimento({ nutritionistId: OTRO_NUTRIOLOGO });

    expect(serializarAlimento(ajeno, NUTRIOLOGO).es_propio).toBe(false);
  });

  it('no marca como propio el catálogo público', () => {
    expect(serializarAlimento(alimento(), NUTRIOLOGO).es_propio).toBe(false);
  });

  it('conserva los equivalentes declarados', () => {
    const conGrasa = alimento({ equivalentes: { cereales: 1, aceites: 0.5 } });

    expect(serializarAlimento(conGrasa, NUTRIOLOGO).equivalentes).toEqual({
      cereales: 1,
      aceites: 0.5,
    });
  });

  it('descarta claves de la columna Json que no son grupos válidos', () => {
    const sucio = alimento({ equivalentes: { cereales: 1, lacteos: 2 } });

    expect(serializarAlimento(sucio, NUTRIOLOGO).equivalentes).toEqual({ cereales: 1 });
  });

  it('descarta cantidades que no son números', () => {
    const sucio = alimento({ equivalentes: { cereales: 'uno' } });

    expect(serializarAlimento(sucio, NUTRIOLOGO).equivalentes).toEqual({});
  });

  it.each([[null], [[1, 2]], ['cereales'], [42]])(
    'tolera %p en la columna de equivalentes',
    (valor) => {
      const sucio = alimento({ equivalentes: valor as Food['equivalentes'] });

      expect(serializarAlimento(sucio, NUTRIOLOGO).equivalentes).toEqual({});
    },
  );

  it('cae en un grupo conocido si la fila trae uno que ya no existe', () => {
    const viejo = alimento({ grupoSmae: 'lacteos' });

    expect(serializarAlimento(viejo, NUTRIOLOGO).grupo).toBe('libres');
  });
});
