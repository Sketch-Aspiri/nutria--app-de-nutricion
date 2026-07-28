import {
  PLAN_PDF_FIXTURE,
  PLAN_PDF_LONG_TEXT_FIXTURE,
} from '@/server/pdf/fixtures';

import {
  CAPACIDAD_PAGINA_CONTINUACION,
  CAPACIDAD_PRIMERA_PAGINA,
  bloquesDeComida,
  paginarPlan,
} from './mealPlanPagination';

describe('paginarPlan', () => {
  it('distribuye el fixture normal en dos páginas', () => {
    const paginas = paginarPlan(
      PLAN_PDF_FIXTURE.plan.comidas,
      PLAN_PDF_FIXTURE.plan.nota,
    );

    expect(paginas).toHaveLength(2);
    expect(paginas.map((pagina) => pagina.bloques.length)).toEqual([3, 4]);
    expect(paginas[0]!.nota).toBeNull();
    expect(paginas[1]!.nota).toBe(PLAN_PDF_FIXTURE.plan.nota);
    expect(paginas[0]!.altura).toBeLessThanOrEqual(
      CAPACIDAD_PRIMERA_PAGINA,
    );
    expect(paginas[1]!.altura).toBeLessThanOrEqual(
      CAPACIDAD_PAGINA_CONTINUACION,
    );
  });

  it('distribuye el fixture de textos largos en tres páginas', () => {
    const paginas = paginarPlan(
      PLAN_PDF_LONG_TEXT_FIXTURE.plan.comidas,
      PLAN_PDF_LONG_TEXT_FIXTURE.plan.nota,
    );

    expect(paginas).toHaveLength(3);
    expect(paginas.map((pagina) => pagina.bloques.length)).toEqual([3, 3, 1]);
    expect(paginas[2]!.nota).toBe(PLAN_PDF_LONG_TEXT_FIXTURE.plan.nota);
    expect(paginas[0]!.altura).toBeLessThanOrEqual(
      CAPACIDAD_PRIMERA_PAGINA,
    );
    expect(paginas.slice(1).every((pagina) => {
      return pagina.altura <= CAPACIDAD_PAGINA_CONTINUACION;
    })).toBe(true);
  });

  it('divide comidas extensas en bloques de cuatro items', () => {
    const comida = PLAN_PDF_FIXTURE.plan.comidas[0]!;
    const items = Array.from({ length: 9 }, (_, indice) => ({
      ...comida.items[indice % comida.items.length]!,
      id: `item-${indice}`,
    }));

    const bloques = bloquesDeComida({ ...comida, items });

    expect(bloques.map((bloque) => bloque.items.length)).toEqual([4, 4, 1]);
    expect(bloques.map((bloque) => bloque.continuacion)).toEqual([
      false,
      true,
      true,
    ]);
    expect(bloques[0]!.descripcion).toBe(comida.descripcion);
    expect(bloques[1]!.descripcion).toBeNull();
  });
});
