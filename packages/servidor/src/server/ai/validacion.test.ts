/**
 * @jest-environment node
 */
import type { AlimentoCatalogo, ContextoPaciente } from './contexto';
import type { PlanBorrador, RecetaBorrador } from './schemas';
import { validarPlan, validarReceta } from './validacion';

const ALIMENTO: AlimentoCatalogo = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  nombre: 'Tortilla de maíz',
  grupo: 'cereales',
  porcion: '1 pieza (30 g)',
  porcionDescripcion: '1 pieza',
  porcionGramos: 30,
  imagenUrl: null,
  energiaKcal: 70,
  proteinaG: 2,
  carbosG: 14,
  lipidosG: 1,
};

const QUESO: AlimentoCatalogo = {
  ...ALIMENTO,
  id: 'a1b2c3d4-0000-4000-8000-000000000002',
  nombre: 'Queso panela',
  grupo: 'alimentos_de_origen_animal',
};

const CONTEXTO: ContextoPaciente = {
  patientId: 'b1b2c3d4-0000-4000-8000-000000000002',
  edad: 34,
  genero: 'Femenino',
  nivelActividad: 'Moderado',
  objetivo: 'Pérdida de grasa',
  condiciones: [],
  antecedentes: null,
  medicamentos: null,
  tipoDieta: null,
  alergias: [],
  disgustos: null,
  comidasPorDia: 1,
  pesoKg: 68,
  alturaCm: 162,
  meta: {
    calorias: 2_000,
    proteinaG: 120,
    carbosG: 200,
    grasaG: 70,
    ecuacion: 'mifflin',
  },
};

function planCon(overrides: Partial<PlanBorrador> = {}): PlanBorrador {
  return {
    calorias_diarias: 2_000,
    proteina_g: 120,
    carbos_g: 200,
    grasa_g: 70,
    nota: 'Revisar porciones.',
    comidas: [
      {
        nombre: 'Comida',
        horario: '14:00',
        descripcion: 'Preparación de prueba',
        items: [
          { food_id: ALIMENTO.id, descripcion: 'Dos tortillas', cantidad_porciones: 2 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('validarPlan', () => {
  it('acepta un borrador coherente con la meta y el catálogo', () => {
    expect(validarPlan(planCon(), CONTEXTO, [ALIMENTO])).toEqual({ ok: true });
  });

  it('rechaza identificadores de alimento que no existen en el catálogo', () => {
    const plan = planCon({
      comidas: [
        {
          nombre: 'Comida',
          horario: '14:00',
          descripcion: '',
          items: [
            { food_id: 'inventado-999', descripcion: 'Algo', cantidad_porciones: 1 },
          ],
        },
      ],
    });

    const resultado = validarPlan(plan, CONTEXTO, [ALIMENTO]);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivos[0]).toContain('inventado-999');
  });

  it('acepta items libres con food_id nulo', () => {
    const plan = planCon({
      comidas: [
        {
          nombre: 'Comida',
          horario: '14:00',
          descripcion: '',
          items: [{ food_id: null, descripcion: 'Ensalada mixta', cantidad_porciones: 1 }],
        },
      ],
    });

    expect(validarPlan(plan, CONTEXTO, [ALIMENTO])).toEqual({ ok: true });
  });

  it('rechaza el borrador cuando un alérgeno aparece en el texto', () => {
    const contexto = { ...CONTEXTO, alergias: ['Nuez'] };
    const plan = planCon({
      comidas: [
        {
          nombre: 'Comida',
          horario: '14:00',
          descripcion: 'Ensalada con nuez picada',
          items: [{ food_id: null, descripcion: 'Ensalada', cantidad_porciones: 1 }],
        },
      ],
    });

    const resultado = validarPlan(plan, contexto, [ALIMENTO]);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivos.join(' ')).toContain('Nuez');
  });

  it('detecta el alérgeno aunque solo aparezca en el nombre real del alimento', () => {
    const contexto = { ...CONTEXTO, alergias: ['queso'] };
    const plan = planCon({
      comidas: [
        {
          nombre: 'Comida',
          horario: '14:00',
          descripcion: 'Guarnición ligera',
          items: [{ food_id: QUESO.id, descripcion: 'Una porción', cantidad_porciones: 1 }],
        },
      ],
    });

    const resultado = validarPlan(plan, contexto, [ALIMENTO, QUESO]);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivos.join(' ')).toContain('queso');
  });

  it('rechaza una desviación energética mayor a ±5% de la meta', () => {
    const resultado = validarPlan(planCon({ calorias_diarias: 2_400 }), CONTEXTO, [ALIMENTO]);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivos.join(' ')).toContain('2400 kcal');
  });

  it('acepta una desviación dentro del ±5%', () => {
    expect(validarPlan(planCon({ calorias_diarias: 2_090 }), CONTEXTO, [ALIMENTO])).toEqual({
      ok: true,
    });
  });

  it('no evalúa la energía cuando el expediente no tiene cálculo guardado', () => {
    const contexto = { ...CONTEXTO, meta: null };

    expect(validarPlan(planCon({ calorias_diarias: 900 }), contexto, [ALIMENTO])).toEqual({
      ok: true,
    });
  });

  it('rechaza un número de comidas distinto al que hace el paciente', () => {
    const contexto = { ...CONTEXTO, comidasPorDia: 3 };

    const resultado = validarPlan(planCon(), contexto, [ALIMENTO]);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivos.join(' ')).toContain('3 comidas');
  });

  it('acumula todos los motivos en un solo rechazo', () => {
    const contexto = { ...CONTEXTO, comidasPorDia: 4, alergias: ['Nuez'] };
    const plan = planCon({
      calorias_diarias: 3_000,
      comidas: [
        {
          nombre: 'Comida',
          horario: '14:00',
          descripcion: 'Con nuez',
          items: [{ food_id: 'no-existe', descripcion: 'Algo', cantidad_porciones: 1 }],
        },
      ],
    });

    const resultado = validarPlan(plan, contexto, [ALIMENTO]);

    expect(resultado.ok === false && resultado.motivos).toHaveLength(4);
  });
});

describe('validarReceta', () => {
  const receta: RecetaBorrador = {
    nombre: 'Tacos de nopal',
    ingredientes: ['2 nopales', '2 tortillas de maíz'],
    pasos: '1. Asar los nopales. 2. Servir en tortillas.',
    calorias: 320,
    porciones: 2,
  };

  it('acepta una receta sin alérgenos', () => {
    expect(validarReceta(receta, { ...CONTEXTO, alergias: ['Nuez'] })).toEqual({ ok: true });
  });

  it('rechaza una receta cuyo ingrediente es un alérgeno declarado', () => {
    const conQueso = { ...receta, ingredientes: [...receta.ingredientes, '100 g de queso panela'] };

    const resultado = validarReceta(conQueso, { ...CONTEXTO, alergias: ['Queso'] });

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivos.join(' ')).toContain('Queso');
  });

  it('ignora "Ninguna" como alergia', () => {
    expect(validarReceta(receta, { ...CONTEXTO, alergias: ['Ninguna'] })).toEqual({ ok: true });
  });
});
