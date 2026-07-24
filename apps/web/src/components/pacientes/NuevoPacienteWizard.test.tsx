import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { NuevoPacienteWizard, construirPayload } from './NuevoPacienteWizard';
import { FORM_PACIENTE_INICIAL } from './camposPaciente';

jest.mock('@/services/pacientes', () => ({
  ...jest.requireActual('@/services/pacientes'),
  crearPacienteApi: jest.fn(),
}));

/** Renderiza el asistente y avanza `pasos` pantallas desde los datos generales. */
function renderEnPaso(pasos: number) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <NuevoPacienteWizard onClose={jest.fn()} onCreado={jest.fn()} />
    </QueryClientProvider>,
  );

  for (let i = 0; i < pasos; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
  }
}

const renderEnExpediente = () => renderEnPaso(1);
const renderEnPreferencias = () => renderEnPaso(3);

/**
 * El botón "Agregar" del campo indicado. Se busca dentro de su propia fila
 * porque un mismo paso puede tener varios campos de alta.
 */
function botonAgregarDe(placeholder: RegExp): HTMLElement {
  const fila = screen.getByPlaceholderText(placeholder).closest('div');
  if (!fila) throw new Error(`El campo ${placeholder} no está dentro de una fila.`);
  return within(fila).getByRole('button', { name: 'Agregar' });
}

/** Escribe en el campo "Agregar otro" que coincide con `placeholder` y confirma. */
function agregarOtro(placeholder: RegExp, texto: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: texto } });
  fireEvent.click(botonAgregarDe(placeholder));
}

const agregarCondicion = (texto: string) => agregarOtro(/Otra condición/, texto);

describe('fecha de nacimiento', () => {
  it('se captura como fecha, porque de ella depende el cálculo de gasto energético', () => {
    // Arrange / Act
    renderEnPaso(0);

    // Assert
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveAttribute('type', 'date');
  });

  it('muestra la edad que implica la fecha capturada', () => {
    // Arrange
    renderEnPaso(0);

    // Act
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
      target: { value: '1990-01-15' },
    });

    // Assert
    expect(screen.getByText(/^\d+ años$/)).toBeInTheDocument();
  });

  it('viaja tal cual al servidor, sin aproximarla desde la edad', () => {
    // Arrange
    const form = { ...FORM_PACIENTE_INICIAL, nombre: 'Ana', fechaNacimiento: '1990-01-15' };

    // Act
    const payload = construirPayload(form);

    // Assert
    expect(payload.fecha_nacimiento).toBe('1990-01-15');
  });

  it('se envía como null cuando no se capturó', () => {
    // Arrange
    const form = { ...FORM_PACIENTE_INICIAL, nombre: 'Ana' };

    // Act
    const payload = construirPayload(form);

    // Assert
    expect(payload.fecha_nacimiento).toBeNull();
  });
});

describe('condiciones médicas escritas por el nutriólogo', () => {
  it('agrega una condición que no está en el catálogo', () => {
    // Arrange
    renderEnExpediente();

    // Act
    agregarCondicion('Síndrome de ovario poliquístico');

    // Assert
    expect(
      screen.getByRole('button', { name: 'Quitar Síndrome de ovario poliquístico' }),
    ).toBeInTheDocument();
  });

  it('la agrega con Enter sin salir del campo', () => {
    // Arrange
    renderEnExpediente();
    const campo = screen.getByPlaceholderText(/Otra condición/);

    // Act
    fireEvent.change(campo, { target: { value: 'Gastritis' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    // Assert
    expect(screen.getByRole('button', { name: 'Quitar Gastritis' })).toBeInTheDocument();
  });

  it('vacía el campo después de agregar, para encadenar varias', () => {
    // Arrange
    renderEnExpediente();

    // Act
    agregarCondicion('Gastritis');

    // Assert
    expect(screen.getByPlaceholderText(/Otra condición/)).toHaveValue('');
  });

  it('quita la condición al hacer clic en su chip', () => {
    // Arrange
    renderEnExpediente();
    agregarCondicion('Gastritis');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Gastritis' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Quitar Gastritis' })).not.toBeInTheDocument();
  });

  it('no permite duplicar una condición ya capturada', () => {
    // Arrange
    renderEnExpediente();
    agregarCondicion('Gastritis');

    // Act
    fireEvent.change(screen.getByPlaceholderText(/Otra condición/), {
      target: { value: 'Gastritis' },
    });

    // Assert
    expect(botonAgregarDe(/Otra condición/)).toBeDisabled();
  });

  it('trata el duplicado sin importar mayúsculas', () => {
    // Arrange
    renderEnExpediente();
    agregarCondicion('Gastritis');

    // Act
    fireEvent.change(screen.getByPlaceholderText(/Otra condición/), {
      target: { value: 'gastritis' },
    });

    // Assert
    expect(botonAgregarDe(/Otra condición/)).toBeDisabled();
  });

  it('no permite duplicar una condición del catálogo', () => {
    // Arrange
    renderEnExpediente();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Hipertensión' }));
    fireEvent.change(screen.getByPlaceholderText(/Otra condición/), {
      target: { value: 'Hipertensión' },
    });

    // Assert
    expect(botonAgregarDe(/Otra condición/)).toBeDisabled();
  });

  it('no permite agregar texto en blanco', () => {
    // Arrange
    renderEnExpediente();

    // Act
    fireEvent.change(screen.getByPlaceholderText(/Otra condición/), { target: { value: '   ' } });

    // Assert
    expect(botonAgregarDe(/Otra condición/)).toBeDisabled();
  });
});

describe('alergias escritas por el nutriólogo', () => {
  it('agrega una alergia fuera del catálogo', () => {
    // Arrange
    renderEnPreferencias();

    // Act
    agregarOtro(/Otra alergia/, 'Fructosa');

    // Assert
    expect(screen.getByRole('button', { name: 'Quitar Fructosa' })).toBeInTheDocument();
  });

  it('la quita al hacer clic en su chip', () => {
    // Arrange
    renderEnPreferencias();
    agregarOtro(/Otra alergia/, 'Fructosa');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Fructosa' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Quitar Fructosa' })).not.toBeInTheDocument();
  });

  it('no permite duplicar una del catálogo', () => {
    // Arrange
    renderEnPreferencias();

    // Act
    fireEvent.change(screen.getByPlaceholderText(/Otra alergia/), { target: { value: 'Gluten' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gluten' }));

    // Assert
    expect(botonAgregarDe(/Otra alergia/)).toBeDisabled();
  });
});

describe('tipo de dieta escrito por el nutriólogo', () => {
  it('reemplaza la selección porque el tipo de dieta es uno solo', () => {
    // Arrange
    renderEnPreferencias();

    // Act
    agregarOtro(/Otro tipo de dieta/, 'Baja en FODMAP');

    // Assert
    expect(screen.getByRole('button', { name: 'Quitar Baja en FODMAP' })).toBeInTheDocument();
  });

  it('vuelve al valor por defecto al quitarlo', () => {
    // Arrange
    renderEnPreferencias();
    agregarOtro(/Otro tipo de dieta/, 'Baja en FODMAP');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Baja en FODMAP' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Quitar Baja en FODMAP' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Omnívoro' })).toBeInTheDocument();
  });

  it('no permite escribir uno que ya está en el catálogo', () => {
    // Arrange
    renderEnPreferencias();

    // Act
    fireEvent.change(screen.getByPlaceholderText(/Otro tipo de dieta/), {
      target: { value: 'Keto' },
    });

    // Assert
    expect(botonAgregarDe(/Otro tipo de dieta/)).toBeDisabled();
  });
});

describe('objetivo escrito por el nutriólogo', () => {
  it('no pide texto mientras el objetivo salga del catálogo', () => {
    // Arrange / Act
    renderEnExpediente();

    // Assert
    expect(screen.queryByLabelText('¿Cuál es el objetivo?')).not.toBeInTheDocument();
  });

  it('pide el texto en cuanto se elige "Otro"', () => {
    // Arrange
    renderEnExpediente();

    // Act
    fireEvent.change(screen.getByLabelText('Objetivo'), { target: { value: 'Otro' } });

    // Assert
    expect(screen.getByLabelText('¿Cuál es el objetivo?')).toBeInTheDocument();
  });

  it('conserva lo escrito en el campo', () => {
    // Arrange
    renderEnExpediente();
    fireEvent.change(screen.getByLabelText('Objetivo'), { target: { value: 'Otro' } });

    // Act
    fireEvent.change(screen.getByLabelText('¿Cuál es el objetivo?'), {
      target: { value: 'Recuperación post cirugía' },
    });

    // Assert
    expect(screen.getByLabelText('¿Cuál es el objetivo?')).toHaveValue(
      'Recuperación post cirugía',
    );
  });
});
