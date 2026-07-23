import { textoCompacto, type MealPlanPdfMeal } from './mealPlanPdfModel';

export const ITEMS_POR_BLOQUE = 4;
export const CAPACIDAD_PRIMERA_PAGINA = 470;
export const CAPACIDAD_PAGINA_CONTINUACION = 650;

export type BloqueComida = MealPlanPdfMeal & {
  key: string;
  continuacion: boolean;
};

export type PaginaPlan = {
  bloques: BloqueComida[];
  altura: number;
  nota: string | null;
};

function lineasEstimadas(texto: string, caracteresPorLinea: number): number {
  const compacto = textoCompacto(texto);
  return compacto ? Math.max(1, Math.ceil(compacto.length / caracteresPorLinea)) : 0;
}

/**
 * React PDF puede cortar un View que envuelve; las comidas se dividen en
 * bloques acotados para conservar bordes y repetir el encabezado al continuar.
 */
export function bloquesDeComida(comida: MealPlanPdfMeal): BloqueComida[] {
  if (comida.items.length === 0) {
    return [{ ...comida, key: `${comida.id}-0`, continuacion: false }];
  }

  return Array.from(
    { length: Math.ceil(comida.items.length / ITEMS_POR_BLOQUE) },
    (_, indice) => ({
      ...comida,
      key: `${comida.id}-${indice}`,
      continuacion: indice > 0,
      descripcion: indice === 0 ? comida.descripcion : null,
      items: comida.items.slice(
        indice * ITEMS_POR_BLOQUE,
        (indice + 1) * ITEMS_POR_BLOQUE,
      ),
    }),
  );
}

/**
 * Estimación conservadora en puntos. Las páginas se materializan de forma
 * explícita para numerarlas sin depender del render dinámico de React PDF,
 * que no es estable en el renderer Node con React 19.
 */
export function alturaBloque(comida: BloqueComida): number {
  const descripcion = comida.descripcion
    ? lineasEstimadas(comida.descripcion, 90) * 10 + 6
    : 0;
  const items =
    comida.items.length === 0
      ? 30
      : comida.items.reduce((altura, item) => {
          const nombre = lineasEstimadas(item.nombre, 52);
          const porcion = lineasEstimadas(item.porcion, 66);
          return altura + 12 + nombre * 10 + Math.max(porcion, 1) * 8;
        }, 20);

  return 34 + descripcion + items + 11;
}

function alturaNota(nota: string): number {
  return 34 + lineasEstimadas(nota, 92) * 10;
}

/**
 * Pagina el contenido de forma determinista para conservar comidas completas
 * y poder imprimir el total de páginas sin callbacks dinámicos del renderer.
 */
export function paginarPlan(
  comidas: MealPlanPdfMeal[],
  nota: string | null,
): PaginaPlan[] {
  const paginas: PaginaPlan[] = [{ bloques: [], altura: 0, nota: null }];
  const bloques = comidas.flatMap(bloquesDeComida);

  for (const bloque of bloques) {
    const altura = alturaBloque(bloque);
    let pagina = paginas[paginas.length - 1]!;
    const capacidad =
      paginas.length === 1
        ? CAPACIDAD_PRIMERA_PAGINA
        : CAPACIDAD_PAGINA_CONTINUACION;

    if (pagina.bloques.length > 0 && pagina.altura + altura > capacidad) {
      pagina = { bloques: [], altura: 0, nota: null };
      paginas.push(pagina);
    }

    pagina.bloques.push(bloque);
    pagina.altura += altura;
  }

  const notaCompacta = nota ? textoCompacto(nota) : '';
  if (!notaCompacta) return paginas;

  const notaAltura = alturaNota(notaCompacta);
  let ultima = paginas[paginas.length - 1]!;
  const capacidadUltima =
    paginas.length === 1
      ? CAPACIDAD_PRIMERA_PAGINA
      : CAPACIDAD_PAGINA_CONTINUACION;

  if (ultima.altura + notaAltura <= capacidadUltima) {
    ultima.nota = notaCompacta;
    ultima.altura += notaAltura;
    return paginas;
  }

  // Evita una página con solo indicaciones cuando el último bloque puede
  // acompañarlas holgadamente.
  if (ultima.bloques.length > 1) {
    const movido = ultima.bloques.pop()!;
    const alturaMovido = alturaBloque(movido);
    ultima.altura -= alturaMovido;
    if (alturaMovido + notaAltura <= CAPACIDAD_PAGINA_CONTINUACION) {
      paginas.push({
        bloques: [movido],
        altura: alturaMovido + notaAltura,
        nota: notaCompacta,
      });
      return paginas;
    }
    ultima.bloques.push(movido);
    ultima.altura += alturaMovido;
  }

  paginas.push({ bloques: [], altura: notaAltura, nota: notaCompacta });
  return paginas;
}
