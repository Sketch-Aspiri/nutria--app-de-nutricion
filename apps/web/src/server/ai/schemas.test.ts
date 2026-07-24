/**
 * @jest-environment node
 */
import {
  MAX_NOTA_BORRADOR,
  PLAN_JSON_SCHEMA,
  planBorradorSchema,
} from './schemas';

/**
 * Validación de forma del borrador de plan.
 *
 * Un borrador clínicamente correcto no debe rechazarse por la longitud de su
 * propia advertencia, y cuando sí se rechaza, el motivo tiene que decir qué
 * corregir: ese texto es lo único que recibe el modelo en el reintento y lo
 * único que ve el nutriólogo cuando el borrador se degrada a texto.
 */

const COMIDA = {
  nombre: 'Desayuno',
  horario: '08:00',
  descripcion: 'Proteína, cereal integral y fruta.',
  items: [
    {
      food_id: 'a1b2c3d4-0000-4000-8000-000000000001',
      descripcion: 'Huevo entero, 2 piezas',
      cantidad_porciones: 2,
    },
  ],
};

function borradorCon(nota: string) {
  return {
    calorias_diarias: 1857,
    proteina_g: 143,
    carbos_g: 187,
    grasa_g: 63,
    comidas: [COMIDA],
    nota,
  };
}

describe('planBorradorSchema', () => {
  it('acepta la nota larga de un expediente con comorbilidades', () => {
    // Caso real: un plan válido para un paciente con diabetes tipo 1 e
    // intolerancia a la lactosa produjo una nota de revisión de 1 374
    // caracteres, y el tope anterior de 1 000 lo descartaba entero.
    const nota = 'Puntos a revisar antes de aprobar. '.repeat(40);
    expect(nota.length).toBeGreaterThan(1_000);

    const resultado = planBorradorSchema.safeParse(borradorCon(nota));

    expect(resultado.success).toBe(true);
  });

  it('rechaza la nota que excede el tope con un motivo accionable', () => {
    const resultado = planBorradorSchema.safeParse(
      borradorCon('x'.repeat(MAX_NOTA_BORRADOR + 1)),
    );

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    const problema = resultado.error.issues[0];
    expect(problema?.path).toEqual(['nota']);
    // El "Invalid input" genérico de Zod no le sirve ni al modelo ni al
    // nutriólogo: el mensaje debe nombrar el límite.
    expect(problema?.message).toContain(String(MAX_NOTA_BORRADOR));
    expect(problema?.message).not.toBe('Invalid input');
  });

  it('nombra el campo en el motivo cuando falla la descripción de un item', () => {
    const resultado = planBorradorSchema.safeParse(
      borradorCon('Nota breve.'),
    );
    expect(resultado.success).toBe(true);

    const conItemVacio = planBorradorSchema.safeParse({
      ...borradorCon('Nota breve.'),
      comidas: [{ ...COMIDA, items: [{ ...COMIDA.items[0], descripcion: '' }] }],
    });

    expect(conItemVacio.success).toBe(false);
    if (conItemVacio.success) return;
    expect(conItemVacio.error.issues[0]?.message).toBe(
      'Cada alimento necesita una descripción.',
    );
  });

  it('le comunica el tope al modelo en la descripción del JSON Schema', () => {
    // La salida estructurada ignora `maxLength`, así que la descripción es el
    // único canal por el que el modelo se entera del límite.
    const propiedades = PLAN_JSON_SCHEMA.properties as Record<
      string,
      { description?: string }
    >;

    expect(propiedades.nota?.description).toContain(String(MAX_NOTA_BORRADOR));
  });
});
