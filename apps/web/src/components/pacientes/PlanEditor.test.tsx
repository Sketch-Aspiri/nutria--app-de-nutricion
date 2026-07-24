import { render, screen } from '@testing-library/react';

import type { Paciente } from '@nutria/shared';

import {
  crearPlanVacio,
  nuevoItemLibre,
  type PlanEditable,
} from '@/components/planes/editor-model';

import { PlanEditor } from './PlanEditor';

function pacienteConAlergias(alergias: string[]): Paciente {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    nombre: 'Paciente de prueba',
    foto: null,
    edad: 30,
    fechaNacimiento: '1996-01-01',
    genero: 'Femenino',
    telefono: '',
    email: '',
    medico: {
      condiciones: ['Ninguna'],
      antecedentes: '',
      medicamentos: '',
      nivelActividad: 'Moderado',
      objetivo: 'Mantenimiento',
      objetivoOtro: null,
    },
    antropometria: {
      peso: 60,
      altura: 165,
      cintura: 0,
      cadera: 0,
      grasaCorporal: 0,
      pliegues: null,
      historial: [],
    },
    preferencias: {
      tipoDieta: 'Omnívoro',
      alergias,
      disgustos: '',
      comidasPorDia: 1,
      presupuestoTiempo: 'Medio',
    },
    calculo: null,
    planActivo: null,
    planEjercicio: null,
    notasConsulta: [],
    seguimiento: {
      adherencia: 0,
      racha: 0,
      comidas: [],
      ejercicio: [],
      recetasEnCurso: [],
      recetasSugeridas: [],
    },
  };
}

function planConAlimento(estado: PlanEditable['estado']): PlanEditable {
  const plan = crearPlanVacio(null, 1);
  const item = nuevoItemLibre();
  item.descripcion_libre = 'Vaso de leche';
  item.energia_kcal = 1_800;
  plan.id = 'b1b2c3d4-0000-4000-8000-000000000001';
  plan.estado = estado;
  plan.calorias_diarias = 1_800;
  plan.comidas[0]?.items.push(item);
  return plan;
}

function renderEditor(plan: PlanEditable, alergias: string[], modificado = false) {
  render(
    <PlanEditor
      paciente={pacienteConAlergias(alergias)}
      plan={plan}
      modificado={modificado}
      guardando={false}
      error={null}
      onChange={jest.fn()}
      onAddFood={jest.fn()}
      onSave={jest.fn()}
      onActivate={jest.fn()}
      onShare={jest.fn()}
      onDuplicate={jest.fn()}
      onExport={jest.fn()}
      onSaveTemplate={jest.fn()}
      onReset={jest.fn()}
    />,
  );
}

describe('PlanEditor', () => {
  it('bloquea la activación cuando el texto coincide con una alergia', () => {
    renderEditor(planConAlimento('BORRADOR'), ['Leche']);

    expect(screen.getByRole('button', { name: 'Activar plan' })).toBeDisabled();
    expect(
      screen.getByText(/no se puede activar ni compartir/i),
    ).toBeInTheDocument();
  });

  it('permite activar un borrador completo sin conflicto', () => {
    renderEditor(planConAlimento('BORRADOR'), ['Ninguna']);

    expect(screen.getByRole('button', { name: 'Activar plan' })).toBeEnabled();
  });

  it('valida alergias en la descripción aunque el item tenga alimento', () => {
    const plan = planConAlimento('BORRADOR');
    const item = plan.comidas[0]?.items[0];
    if (item) {
      item.food_id = 'c1b2c3d4-0000-4000-8000-000000000001';
      item.descripcion_libre = 'Preparar con cacahuate';
      item.food = {
        id: item.food_id,
        nombre: 'Avena',
        grupo: 'cereales',
        porcion_descripcion: '1 taza',
        porcion_gramos: 100,
        imagen_url: null,
      };
    }

    renderEditor(plan, ['Cacahuate']);

    expect(screen.getByRole('button', { name: 'Activar plan' })).toBeDisabled();
  });

  it('no cuenta un item libre vacío como contenido activable', () => {
    const plan = crearPlanVacio(null, 1);
    const item = nuevoItemLibre();
    plan.id = 'b1b2c3d4-0000-4000-8000-000000000001';
    plan.calorias_diarias = 1_800;
    item.energia_kcal = 1_800;
    plan.comidas[0]?.items.push(item);

    renderEditor(plan, ['Ninguna']);

    expect(screen.getByRole('button', { name: 'Activar plan' })).toBeDisabled();
  });

  it('bloquea activar cuando la energía calculada se desvía más de ±5%', () => {
    const plan = planConAlimento('BORRADOR');
    const item = plan.comidas[0]?.items[0];
    if (item) item.energia_kcal = 1_700;

    renderEditor(plan, ['Ninguna']);

    expect(screen.getByRole('button', { name: 'Activar plan' })).toBeDisabled();
    expect(screen.getByText(/ajusta la energía del plan a ±5%/i)).toBeInTheDocument();
  });

  it('bloquea compartir un plan activo si aparece un alérgeno', () => {
    renderEditor(planConAlimento('ACTIVO'), ['Leche']);

    expect(screen.getByRole('button', { name: 'Compartir' })).toBeDisabled();
  });

  it('presenta los planes históricos en solo lectura y permite duplicarlos', () => {
    renderEditor(planConAlimento('ACTIVO'), ['Ninguna']);

    expect(screen.getByLabelText('Meta de Energía')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplicar para editar' })).toBeEnabled();
  });

  it('no exporta una versión persistida distinta cuando hay cambios pendientes', () => {
    renderEditor(planConAlimento('BORRADOR'), ['Ninguna'], true);

    expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled();
  });
});
