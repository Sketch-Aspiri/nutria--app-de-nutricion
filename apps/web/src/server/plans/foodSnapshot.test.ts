import { crearFoodSnapshot, leerFoodSnapshot } from './foodSnapshot';

describe('snapshot descriptivo de food', () => {
  it('conserva la identidad necesaria para UI y PDF', () => {
    const snapshot = crearFoodSnapshot({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      nombre: 'Avena de prueba',
      grupoSmae: 'cereales',
      porcionDescripcion: '1/2 taza',
      porcionGramos: 40,
      imagenUrl: 'data:image/png;base64,AA==',
    } as never);

    expect(leerFoodSnapshot(snapshot)).toEqual({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      nombre: 'Avena de prueba',
      grupo: 'cereales',
      porcion_descripcion: '1/2 taza',
      porcion_gramos: 40,
      imagen_url: 'data:image/png;base64,AA==',
    });
  });

  it('rechaza JSON incompleto en lugar de romper un plan legacy', () => {
    expect(leerFoodSnapshot({ nombre: 'Sin id' })).toBeNull();
  });
});
