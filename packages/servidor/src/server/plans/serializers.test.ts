import { serializarPlan, serializarPlantilla } from './serializers';

describe('serializadores de planes', () => {
  it('convierte relaciones y fechas al contrato snake_case', () => {
    const fecha = new Date('2026-07-23T12:00:00Z');
    const resultado = serializarPlan({
      id: 'plan',
      patientId: 'patient',
      estado: 'ACTIVO',
      caloriasDiarias: 1_800,
      proteinaG: 100,
      carbosG: 220,
      grasaG: 60,
      nota: null,
      origen: 'MANUAL',
      calculoSnapshot: null,
      activadoAt: fecha,
      compartidoAt: fecha,
      pdfUrl: null,
      createdAt: fecha,
      updatedAt: fecha,
      meals: [
        {
          id: 'meal',
          mealPlanId: 'plan',
          orden: 0,
          nombre: 'Desayuno',
          horario: '08:00',
          descripcion: null,
          items: [
            {
              id: 'item',
              mealId: 'meal',
              foodId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
              foodSnapshot: {
                id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                nombre: 'Avena original',
                grupo: 'cereales',
                porcion_descripcion: '1/2 taza',
                porcion_gramos: 40,
                imagen_url: null,
              },
              descripcionLibre: null,
              cantidadPorciones: 1.5,
              energiaKcal: 150,
              proteinaG: 6,
              carbohidratosG: 30,
              lipidosG: 3,
              food: {
                id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                nombre: 'Food editado después',
                grupoSmae: 'otro',
                porcionDescripcion: 'Porción cambiada',
                porcionGramos: 999,
                imagenUrl: null,
              },
            },
          ],
        },
      ],
    });

    expect(resultado).toMatchObject({
      patient_id: 'patient',
      calorias_diarias: 1_800,
      compartido_at: '2026-07-23T12:00:00.000Z',
      comidas: [
        {
          items: [
            {
              food_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
              cantidad_porciones: 1.5,
              carbohidratos_g: 30,
              food: {
                nombre: 'Avena original',
                grupo: 'cereales',
                porcion_descripcion: '1/2 taza',
              },
            },
          ],
        },
      ],
    });
  });

  it('degrada una estructura histórica inválida a una plantilla vacía', () => {
    const fecha = new Date('2026-07-23T12:00:00Z');
    const resultado = serializarPlantilla({
      id: 'template',
      nutritionistId: 'nutritionist',
      nombre: 'Base',
      objetivo: 'MANTENIMIENTO',
      calorias: 1_800,
      descripcion: null,
      estructura: { comidas: 'corrupto' },
      createdAt: fecha,
      updatedAt: fecha,
    });

    expect(resultado.estructura).toEqual({ comidas: [] });
  });
});
