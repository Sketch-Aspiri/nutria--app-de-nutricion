import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ConfirmarBajaPaciente } from './ConfirmarBajaPaciente';

const archivarPacienteApi = jest.fn<Promise<void>, [string]>();

jest.mock('@/services/pacientes', () => ({
  archivarPacienteApi: (id: string) => archivarPacienteApi(id),
}));

const PACIENTE = { id: 'a1b2c3d4-0000-4000-8000-000000000001', nombre: 'Paciente Prueba' };

function renderModal(props: Partial<React.ComponentProps<typeof ConfirmarBajaPaciente>> = {}) {
  // Sin reintentos: un fallo debe reflejarse en la UI de inmediato.
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  const onClose = props.onClose ?? jest.fn();
  const onArchivado = props.onArchivado ?? jest.fn();

  render(
    <QueryClientProvider client={client}>
      <ConfirmarBajaPaciente paciente={PACIENTE} onClose={onClose} onArchivado={onArchivado} />
    </QueryClientProvider>,
  );

  return { onClose, onArchivado };
}

beforeEach(() => {
  archivarPacienteApi.mockReset();
});

describe('ConfirmarBajaPaciente', () => {
  it('no llama a la API hasta que se confirma', () => {
    // Arrange
    const { onClose } = renderModal();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert
    expect(archivarPacienteApi).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('archiva al paciente y cierra cuando el servidor confirma', async () => {
    // Arrange
    archivarPacienteApi.mockResolvedValue(undefined);
    const { onClose, onArchivado } = renderModal();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar paciente' }));

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(archivarPacienteApi).toHaveBeenCalledWith(PACIENTE.id);
    expect(onArchivado).toHaveBeenCalledWith(PACIENTE.id);
  });

  it('mantiene el modal abierto y avisa cuando la baja falla', async () => {
    // Arrange
    archivarPacienteApi.mockRejectedValue(new Error('boom'));
    const { onClose, onArchivado } = renderModal();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar paciente' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos eliminar al paciente.');
    expect(onClose).not.toHaveBeenCalled();
    expect(onArchivado).not.toHaveBeenCalled();
  });

  it('advierte que el expediente clínico se conserva', () => {
    // Arrange / Act
    renderModal();

    // Assert
    expect(screen.getByText(/expediente clínico se conserva archivado/i)).toBeInTheDocument();
  });
});
