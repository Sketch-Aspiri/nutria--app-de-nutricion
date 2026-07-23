import { expandirBusqueda, normalizarNombre, SINONIMOS_ALIMENTO } from './normalizar';

describe('normalizarNombre', () => {
  it.each([
    ['Plátano', 'platano'],
    ['JITOMATE', 'jitomate'],
    ['Frijol  negro   cocido', 'frijol negro cocido'],
    ['  Nopal crudo  ', 'nopal crudo'],
    ['Yogurt (natural, sin azúcar)', 'yogurt natural sin azucar'],
    ['Té de manzanilla', 'te de manzanilla'],
    ['Chile piquín', 'chile piquin'],
  ])('normaliza %s a %s', (entrada, esperado) => {
    expect(normalizarNombre(entrada)).toBe(esperado);
  });

  it('conserva los números de una porción o marca', () => {
    expect(normalizarNombre('Leche 2% grasa')).toBe('leche 2 grasa');
  });

  it('devuelve cadena vacía cuando el texto es solo puntuación', () => {
    expect(normalizarNombre('  --- ')).toBe('');
  });

  it('es idempotente: normalizar lo ya normalizado no cambia nada', () => {
    const unaVez = normalizarNombre('Crema de cacahuate');
    expect(normalizarNombre(unaVez)).toBe(unaVez);
  });
});

describe('expandirBusqueda', () => {
  it('devuelve primero lo que el nutriólogo escribió', () => {
    expect(expandirBusqueda('Jitomate')[0]).toBe('jitomate');
  });

  it('agrega el sinónimo mexicano de un término de fuera', () => {
    expect(expandirBusqueda('tomate rojo')).toContain('jitomate');
  });

  it('agrega el sinónimo conservando el resto de la frase', () => {
    expect(expandirBusqueda('platano macho')).toContain('banana macho');
  });

  it('solo sustituye palabras completas: papaya no se vuelve patataya', () => {
    expect(expandirBusqueda('papaya')).toEqual(['papaya']);
  });

  it('no repite la variante cuando el término no tiene sinónimos', () => {
    expect(expandirBusqueda('nopal')).toEqual(['nopal']);
  });

  it('devuelve lista vacía para una búsqueda en blanco', () => {
    expect(expandirBusqueda('   ')).toEqual([]);
  });

  it('no duplica la consulta original entre las variantes', () => {
    const variantes = expandirBusqueda('aguacate');
    expect(new Set(variantes).size).toBe(variantes.length);
  });
});

describe('SINONIMOS_ALIMENTO', () => {
  it('está escrito ya normalizado: si no, nunca casaría con la búsqueda', () => {
    for (const grupo of SINONIMOS_ALIMENTO) {
      for (const termino of grupo) {
        expect(termino).toBe(normalizarNombre(termino));
      }
    }
  });

  it('no repite un término en dos grupos distintos', () => {
    const todos = SINONIMOS_ALIMENTO.flat();
    expect(new Set(todos).size).toBe(todos.length);
  });
});
