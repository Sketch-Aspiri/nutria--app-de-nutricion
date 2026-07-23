/**
 * @jest-environment node
 */
import type { AlimentoFicha, PlanAlimenticio } from '@nutria/shared';

import {
  alimentoAItem,
  calcularTotalesPlan,
  cambiarCantidadItem,
  crearPlanVacio,
  planAPayload,
  planIaAEditable,
} from './editor-model';

const ALIMENTO_PRUEBA: AlimentoFicha = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  nombre: 'Alimento de prueba',
  grupo: 'cereales',
  subgrupo: null,
  porcion_descripcion: '1 porción',
  porcion_gramos: 40,
  energia_kcal: 150,
  proteina_g: 5,
  lipidos_g: 3,
  carbohidratos_g: 25,
  saturadas_g: null,
  colesterol_mg: null,
  fibra_g: null,
  azucar_g: null,
  sodio_mg: null,
  potasio_mg: null,
  calcio_mg: null,
  hierro_mg: null,
  acido_folico_ug: null,
  vitamina_a_ug: null,
  vitamina_c_mg: null,
  indice_glicemico: null,
  equivalentes: { cereales: 2 },
  imagen_url: null,
  fuente: 'propia',
  es_propio: true,
};

describe('modelo editable de planes', () => {
  it('liga un alimento y reescala su snapshot al cambiar porciones', () => {
    const item = cambiarCantidadItem(alimentoAItem(ALIMENTO_PRUEBA), 2);

    expect(item).toMatchObject({
      food_id: ALIMENTO_PRUEBA.id,
      cantidad_porciones: 2,
      energia_kcal: 300,
      proteina_g: 10,
      carbohidratos_g: 50,
      lipidos_g: 6,
    });
  });

  it('suma snapshots de todas las comidas sin volver a multiplicar por porciones', () => {
    const plan = crearPlanVacio(null, 2);
    plan.comidas[0]?.items.push(cambiarCantidadItem(alimentoAItem(ALIMENTO_PRUEBA), 2));
    plan.comidas[1]?.items.push(alimentoAItem(ALIMENTO_PRUEBA));

    expect(calcularTotalesPlan(plan)).toEqual({
      energia_kcal: 450,
      proteina_g: 15,
      carbohidratos_g: 75,
      lipidos_g: 9,
    });
  });

  it('convierte la propuesta de IA en items libres editables y distribuye sus macros', () => {
    const sugerencia: PlanAlimenticio = {
      calorias_diarias: 1_000,
      macros: { proteina_g: 100, carbos_g: 120, grasa_g: 30 },
      comidas: [
        {
          nombre: 'Primera comida',
          horario: '08:00',
          descripcion: 'Preparación de prueba',
          porcion: '1 plato',
          calorias: 400,
        },
        {
          nombre: 'Segunda comida',
          horario: '14:00',
          descripcion: 'Otra preparación',
          porcion: '1 plato',
          calorias: 600,
        },
      ],
    };

    const plan = planIaAEditable(sugerencia);

    expect(plan.origen).toBe('IA');
    expect(plan.comidas[0]?.items[0]).toMatchObject({
      food_id: null,
      energia_kcal: 400,
      proteina_g: 40,
      carbohidratos_g: 48,
      lipidos_g: 12,
    });
    expect(calcularTotalesPlan(plan).proteina_g).toBe(100);
  });

  it('el payload elimina claves de UI y redondea las metas enteras del contrato', () => {
    const plan = crearPlanVacio(null, 1);
    plan.calorias_diarias = 1_799.6;
    plan.proteina_g = 119.8;
    plan.comidas[0]?.items.push(alimentoAItem(ALIMENTO_PRUEBA));

    const payload = planAPayload(plan);

    expect(payload.calorias_diarias).toBe(1_800);
    expect(payload.proteina_g).toBe(120);
    expect(payload.comidas?.[0]).not.toHaveProperty('clave');
    expect(payload.comidas?.[0]?.items[0]).not.toHaveProperty('food');
  });
});
