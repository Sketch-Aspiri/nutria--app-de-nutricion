import type { MealPlanPdfData } from '@/components/pdf/MealPlanDocument';

/**
 * Fixture completamente ficticio para revisar el PDF sin tocar PostgreSQL.
 * Se comparte entre el test automatizado y el generador visual documentado en README.md.
 */
export const PLAN_PDF_FIXTURE: MealPlanPdfData = {
  generadoEn: new Date('2026-07-23T12:00:00.000Z'),
  marca: {
    nombre: 'Consulta Raíz',
    color: '#0f766e',
    logoUrl: null,
    profesional: 'Lic. Nutrición Ejemplo',
    cedulaProfesional: '00000000',
    especialidad: 'Nutrición clínica',
  },
  paciente: { nombre: 'Paciente de Prueba' },
  plan: {
    caloriasDiarias: 1850,
    proteinaG: 120,
    carbosG: 205,
    grasaG: 61,
    nota:
      'Mantener hidratación durante el día y respetar las porciones indicadas. ' +
      'Los ajustes se realizan únicamente durante consulta.',
    comidas: Array.from({ length: 7 }, (_, indice) => ({
      id: `comida-${indice + 1}`,
      nombre: ['Desayuno', 'Colación matutina', 'Comida', 'Colación vespertina'][
        indice % 4
      ]!,
      horario: `${7 + indice}:30`,
      descripcion: indice === 0 ? 'Opción práctica para iniciar el día.' : null,
      items: [
        {
          id: `item-${indice + 1}-1`,
          nombre: indice % 2 === 0 ? 'Tortilla de maíz' : 'Frijol negro cocido',
          porcion: indice % 2 === 0 ? '1 pieza (30 g)' : '1/2 taza (86 g)',
          cantidadPorciones: indice % 2 === 0 ? 2 : 1,
          energiaKcal: indice % 2 === 0 ? 128 : 114,
          proteinaG: indice % 2 === 0 ? 3.4 : 7.6,
          carbohidratosG: indice % 2 === 0 ? 26.8 : 20.4,
          lipidosG: indice % 2 === 0 ? 1.6 : 0.5,
        },
        {
          id: `item-${indice + 1}-2`,
          nombre: 'Pechuga de pollo sin piel, cocida',
          porcion: '1 pieza mediana (100 g)',
          cantidadPorciones: 1,
          energiaKcal: 165,
          proteinaG: 31,
          carbohidratosG: 0,
          lipidosG: 3.6,
        },
      ],
    })),
  },
};

/** Caso borde: textos libres largos y nota cercana al máximo admitido por la API. */
export const PLAN_PDF_LONG_TEXT_FIXTURE: MealPlanPdfData = {
  ...PLAN_PDF_FIXTURE,
  paciente: {
    nombre:
      'Paciente de Prueba con un nombre deliberadamente largo para validar el ajuste tipográfico',
  },
  plan: {
    ...PLAN_PDF_FIXTURE.plan,
    nota: Array.from(
      { length: 12 },
      () =>
        'Mantener hidratación y seguir las sustituciones acordadas en consulta; ' +
        'si aparece alguna molestia, registrar el evento y contactar al profesional.',
    ).join(' '),
    comidas: PLAN_PDF_FIXTURE.plan.comidas.map((comida, comidaIndice) => ({
      ...comida,
      items: comida.items.map((item, itemIndice) => ({
        ...item,
        nombre:
          comidaIndice === 0 && itemIndice === 0
            ? Array.from(
                { length: 5 },
                () => 'Preparación casera de cereal integral con fruta de temporada',
              ).join(', ')
            : item.nombre,
      })),
    })),
  },
};
