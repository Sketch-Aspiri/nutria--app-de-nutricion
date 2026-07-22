import { tieneConflictoAlergia } from './alergias';

describe('tieneConflictoAlergia', () => {
  it('detecta una alergia mencionada en la descripción sin importar mayúsculas', () => {
    expect(tieneConflictoAlergia('Yogurt con LACTOSA y fruta', ['Lactosa'])).toBe(true);
  });

  it('no marca conflicto cuando la descripción no menciona alergias', () => {
    expect(tieneConflictoAlergia('Ensalada de pollo y verduras', ['Lactosa', 'Mariscos'])).toBe(false);
  });

  it('ignora la opción "Ninguna"', () => {
    expect(tieneConflictoAlergia('ninguna cosa especial', ['Ninguna'])).toBe(false);
  });

  it('devuelve false para texto vacío o nulo', () => {
    expect(tieneConflictoAlergia('', ['Gluten'])).toBe(false);
    expect(tieneConflictoAlergia(null, ['Gluten'])).toBe(false);
    expect(tieneConflictoAlergia(undefined, ['Gluten'])).toBe(false);
  });
});
