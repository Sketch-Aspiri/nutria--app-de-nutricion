import { render, screen } from '@testing-library/react';

import type { PlantillaPlanApi } from '@/services/planes';

import { TemplateEditorModal } from './TemplateEditorModal';

function crearPlantilla(descripcionLibre: string): PlantillaPlanApi {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    nombre: 'Plantilla de prueba',
    objetivo: 'MANTENIMIENTO',
    calorias: 1_800,
    descripcion: null,
    estructura: {
      comidas: [
        {
          orden: 0,
          nombre: 'Desayuno',
          horario: null,
          descripcion: null,
          items: [
            {
              food_id: null,
              descripcion_libre: descripcionLibre,
              cantidad_porciones: 1,
              energia_kcal: 1_800,
              proteina_g: 0,
              carbohidratos_g: 0,
              lipidos_g: 0,
            },
          ],
        },
      ],
    },
    created_at: '2026-07-23T12:00:00.000Z',
    updated_at: '2026-07-23T12:00:00.000Z',
  };
}

function renderEditor(plantilla: PlantillaPlanApi) {
  render(
    <TemplateEditorModal
      plantilla={plantilla}
      guardando={false}
      error={null}
      onSave={jest.fn()}
      onClose={jest.fn()}
    />,
  );
}

describe('TemplateEditorModal', () => {
  it('no cuenta un item libre vacío como contenido guardable', () => {
    renderEditor(crearPlantilla('   '));

    expect(
      screen.getByRole('button', { name: 'Guardar plantilla' }),
    ).toBeDisabled();
  });

  it('permite guardar cuando el item libre tiene descripción', () => {
    renderEditor(crearPlantilla('Avena con fruta'));

    expect(
      screen.getByRole('button', { name: 'Guardar plantilla' }),
    ).toBeEnabled();
  });
});
