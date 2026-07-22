import { filtrarAlimentos } from './alimentos';

describe('filtrarAlimentos', () => {
  it('filtra por texto sin importar mayúsculas', () => {
    const r = filtrarAlimentos('AVENA', 'Todas');
    expect(r).toHaveLength(1);
    expect(r[0]?.nombre).toBe('Avena');
  });

  it('filtra por categoría', () => {
    const r = filtrarAlimentos('', 'Frutas');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((a) => a.cat === 'Frutas')).toBe(true);
  });

  it('"Todas" no restringe por categoría', () => {
    expect(filtrarAlimentos('', 'Todas').length).toBeGreaterThan(10);
  });

  it('devuelve vacío cuando nada coincide', () => {
    expect(filtrarAlimentos('xyz-inexistente', 'Todas')).toEqual([]);
  });
});
