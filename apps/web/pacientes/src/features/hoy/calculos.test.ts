/**
 * @jest-environment node
 */
import {
  calcularTotalesHoy,
  descripcionDeComida,
  nutrientesParaRegistroPlan,
  totalesDeComida,
} from './calculos';
import type { ComidaPlanHoy, RegistroComidaHoy, ResumenHoy } from './types';

const COMIDA: ComidaPlanHoy = {
  id: 'comida-1',
  orden: 1,
  nombre: 'Desayuno',
  horario: '08:00',
  descripcion: null,
  items: [
    {
      id: 'item-1',
      descripcion_libre: null,
      energia_kcal: 300,
      proteina_g: 20,
      carbohidratos_g: 35,
      lipidos_g: 8,
      food: { nombre: 'Avena', porcion_descripcion: '1 taza' },
    },
    {
      id: 'item-2',
      descripcion_libre: 'Fruta de temporada',
      energia_kcal: 80,
      proteina_g: 1,
      carbohidratos_g: 20,
      lipidos_g: 0,
      food: null,
    },
  ],
};

function registro(parcial: Partial<RegistroComidaHoy>): RegistroComidaHoy {
  return {
    id: 'registro-1',
    meal_plan_meal_id: null,
    fecha: '2026-07-29T12:00:00.000Z',
    dia: '2026-07-29',
    hora: '2026-07-29T12:00:00.000Z',
    nombre: 'Registro',
    calorias: 0,
    proteina_g: 0,
    carbos_g: 0,
    grasa_g: 0,
    origen: 'MANUAL',
    foto_url: null,
    comentario_paciente: null,
    created_at: '2026-07-29T12:00:00.000Z',
    ...parcial,
  };
}

function resumen(registros: RegistroComidaHoy[]): ResumenHoy {
  return {
    dia: '2026-07-29',
    zona_horaria: 'America/Cancun',
    plan: {
      id: 'plan-1',
      calorias_diarias: 1800,
      proteina_g: 120,
      carbos_g: 180,
      grasa_g: 60,
      comidas: [COMIDA],
    },
    comidas_marcadas: ['comida-1'],
    registros,
    agua: { vasos: 4, meta: 8 },
    adherencia: null,
  };
}

describe('totalesDeComida', () => {
  it('suma los snapshots de todos los alimentos de una comida', () => {
    expect(totalesDeComida(COMIDA)).toEqual({
      calorias: 380,
      proteina: 21,
      carbos: 55,
      grasa: 8,
    });
  });

  it('redondea solo las kcal al contrato entero de meal_logs', () => {
    const fraccionaria = {
      ...COMIDA,
      items: [{ ...COMIDA.items[0]!, energia_kcal: 82.5, proteina_g: 10.25 }],
    };

    expect(nutrientesParaRegistroPlan(fraccionaria)).toMatchObject({
      calorias: 83,
      proteina: 10.25,
    });
  });
});

describe('calcularTotalesHoy', () => {
  it('suma registros libres y comidas marcadas', () => {
    const total = calcularTotalesHoy(
      resumen([
        registro({
          meal_plan_meal_id: 'comida-1',
          calorias: 380,
          proteina_g: 21,
          carbos_g: 55,
          grasa_g: 8,
        }),
        registro({
          id: 'libre-1',
          calorias: 210,
          proteina_g: 12.25,
          carbos_g: 18.25,
          grasa_g: 7.25,
        }),
      ]),
    );

    expect(total).toEqual({ calorias: 590, proteina: 33.3, carbos: 73.3, grasa: 15.3 });
  });

  it('usa el snapshot del plan cuando un marcador antiguo no guarda macros', () => {
    expect(
      calcularTotalesHoy(
        resumen([
          registro({
            meal_plan_meal_id: 'comida-1',
            calorias: null,
            proteina_g: null,
            carbos_g: null,
            grasa_g: null,
          }),
        ]),
      ),
    ).toEqual({ calorias: 380, proteina: 21, carbos: 55, grasa: 8 });
  });

  it('no infla el anillo si hay dos marcadores heredados para la misma comida', () => {
    const marcador = registro({ meal_plan_meal_id: 'comida-1', calorias: 380 });
    expect(calcularTotalesHoy(resumen([marcador, { ...marcador, id: 'duplicado' }])).calorias).toBe(
      380,
    );
  });
});

describe('descripcionDeComida', () => {
  it('arma una descripción legible con alimentos y descripciones libres', () => {
    expect(descripcionDeComida(COMIDA)).toBe('Avena · Fruta de temporada');
  });

  it('prefiere la descripción escrita por la nutrióloga', () => {
    expect(descripcionDeComida({ ...COMIDA, descripcion: 'Avena con fruta' })).toBe(
      'Avena con fruta',
    );
  });
});
