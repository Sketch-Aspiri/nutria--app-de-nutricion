/**
 * @jest-environment node
 */
import { cambiarAguaOptimista, desmarcarComidaOptimista, marcarComidaOptimista } from './optimismo';
import type { ComidaPlanHoy, ResumenHoy } from './types';

const COMIDA: ComidaPlanHoy = {
  id: 'comida-1',
  orden: 1,
  nombre: 'Desayuno',
  horario: null,
  descripcion: null,
  items: [
    {
      id: 'item-1',
      descripcion_libre: 'Avena',
      energia_kcal: 320,
      proteina_g: 12,
      carbohidratos_g: 50,
      lipidos_g: 8,
      food: null,
    },
  ],
};

const RESUMEN: ResumenHoy = {
  dia: '2026-07-29',
  zona_horaria: 'America/Cancun',
  plan: {
    id: 'plan-1',
    calorias_diarias: 1600,
    proteina_g: 100,
    carbos_g: 160,
    grasa_g: 50,
    comidas: [COMIDA],
  },
  comidas_marcadas: [],
  registros: [],
  agua: { vasos: 2, meta: 8 },
  adherencia: {
    porcentaje: 25,
    racha: 2,
    dias_evaluados: 2,
    comidas_registradas: 1,
    comidas_esperadas: 4,
  },
};

describe('actualizaciones optimistas de Hoy', () => {
  it('marca una comida con los nutrientes del snapshot de inmediato', () => {
    const actualizado = marcarComidaOptimista(RESUMEN, COMIDA);

    expect(actualizado.comidas_marcadas).toEqual(['comida-1']);
    expect(actualizado.registros[0]).toMatchObject({
      meal_plan_meal_id: 'comida-1',
      calorias: 320,
      proteina_g: 12,
    });
    // La adherencia canónica se recalcula en el servidor con @nutria/shared.
    expect(actualizado.adherencia).toBe(RESUMEN.adherencia);
  });

  it('desmarca solo el registro seleccionado', () => {
    const marcado = marcarComidaOptimista(RESUMEN, COMIDA);
    const registroId = marcado.registros[0]!.id;
    const actualizado = desmarcarComidaOptimista(marcado, COMIDA.id, [registroId]);

    expect(actualizado.comidas_marcadas).toEqual([]);
    expect(actualizado.registros).toEqual([]);
    expect(actualizado.adherencia).toBe(RESUMEN.adherencia);
  });

  it('elimina juntos los marcadores duplicados heredados', () => {
    const marcado = marcarComidaOptimista(RESUMEN, COMIDA);
    const primero = marcado.registros[0]!;
    const duplicado = { ...primero, id: 'duplicado' };
    const conDuplicado = {
      ...marcado,
      comidas_marcadas: [COMIDA.id, COMIDA.id],
      registros: [primero, duplicado],
    };

    const actualizado = desmarcarComidaOptimista(conDuplicado, COMIDA.id, [
      primero.id,
      duplicado.id,
    ]);

    expect(actualizado.comidas_marcadas).toEqual([]);
    expect(actualizado.registros).toEqual([]);
  });

  it('actualiza el agua sin mutar el resumen anterior', () => {
    const actualizado = cambiarAguaOptimista(RESUMEN, 3);

    expect(actualizado.agua.vasos).toBe(3);
    expect(RESUMEN.agua.vasos).toBe(2);
  });
});
