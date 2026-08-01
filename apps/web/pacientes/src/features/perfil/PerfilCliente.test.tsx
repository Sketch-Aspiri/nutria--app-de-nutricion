import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as api from './api';
import { PerfilCliente } from './PerfilCliente';

jest.mock('./api', () => ({
  obtenerPerfil: jest.fn(),
  cambiarPassword: jest.fn(),
  darDeBaja: jest.fn(),
  descargarMisDatos: jest.fn(),
}));

const mockSignOut = jest.fn();
jest.mock('next-auth/react', () => ({ signOut: (...a: unknown[]) => mockSignOut(...a) }));

const obtenerPerfil = api.obtenerPerfil as jest.MockedFunction<typeof api.obtenerPerfil>;
const cambiarPassword = api.cambiarPassword as jest.MockedFunction<typeof api.cambiarPassword>;
const darDeBaja = api.darDeBaja as jest.MockedFunction<typeof api.darDeBaja>;
const descargarMisDatos = api.descargarMisDatos as jest.MockedFunction<
  typeof api.descargarMisDatos
>;

function perfil(parcial: Partial<api.PerfilPaciente> = {}): api.PerfilPaciente {
  return {
    id: 'p1',
    nombre: 'Camila Ruiz',
    email: 'camila@correo.mx',
    foto_url: null,
    objetivo: 'PERDIDA_DE_GRASA',
    objetivo_otro: null,
    nutriologo: { nombre: 'Ana Salinas', consultorio: 'Nutria Polanco' },
    meta_agua_vasos: 8,
    metas: null,
    ...parcial,
  };
}

function renderPerfil() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PerfilCliente />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  obtenerPerfil.mockResolvedValue(perfil());
});

describe('datos del paciente', () => {
  it('muestra la nutrióloga asignada y el objetivo', async () => {
    renderPerfil();

    expect(await screen.findByText('Ana Salinas')).toBeInTheDocument();
    expect(screen.getByText('Nutria Polanco')).toBeInTheDocument();
    expect(screen.getByText('Pérdida de grasa')).toBeInTheDocument();
  });

  it('no inventa un objetivo cuando el expediente no lo registra', async () => {
    obtenerPerfil.mockResolvedValue(perfil({ objetivo: null }));
    renderPerfil();

    expect(await screen.findByText('Tu nutrióloga aún no registra un objetivo.')).toBeInTheDocument();
  });

  it('describe los recordatorios sin ofrecer un interruptor que no guarda nada', async () => {
    // El modelo no tiene preferencia de recordatorios (§12 deja push fuera de
    // la V1). Un switch aquí mentiría: el paciente lo apaga, cree que dejó de
    // recibir correos, y los sigue recibiendo.
    renderPerfil();

    expect(await screen.findByText(/Te avisamos por correo antes de cada cita/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('enlaza el aviso de privacidad con su versión', async () => {
    renderPerfil();

    const enlace = await screen.findByRole('link', { name: /Aviso de privacidad/ });
    expect(enlace).toHaveAttribute('href', '/privacidad');
  });
});

describe('cambio de contraseña', () => {
  async function abrirFormulario() {
    renderPerfil();
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar mi contraseña' }));
  }

  it('exige la contraseña actual además de la nueva', async () => {
    await abrirFormulario();

    // Sin este paso, una sesión robada bastaría para dejar al dueño fuera.
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nueva contraseña/)).toBeInTheDocument();
    expect(screen.getByLabelText('Repite la nueva contraseña')).toBeInTheDocument();
  });

  it('avisa si la confirmación no coincide, sin llamar al servidor', async () => {
    await abrirFormulario();

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'vieja1234' } });
    fireEvent.change(screen.getByLabelText(/Nueva contraseña/), {
      target: { value: 'contrasena-nueva' },
    });
    fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), {
      target: { value: 'otra-cosa-distinta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
    expect(cambiarPassword).not.toHaveBeenCalled();
  });

  it('avisa si la nueva es muy corta, sin llamar al servidor', async () => {
    await abrirFormulario();

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'vieja1234' } });
    fireEvent.change(screen.getByLabelText(/Nueva contraseña/), { target: { value: 'corta' } });
    fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), {
      target: { value: 'corta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 10 caracteres');
    expect(cambiarPassword).not.toHaveBeenCalled();
  });

  it('manda las dos contraseñas y confirma al guardar', async () => {
    cambiarPassword.mockResolvedValue({ actualizada: true });
    await abrirFormulario();

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'vieja1234' } });
    fireEvent.change(screen.getByLabelText(/Nueva contraseña/), {
      target: { value: 'contrasena-nueva' },
    });
    fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), {
      target: { value: 'contrasena-nueva' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(cambiarPassword).toHaveBeenCalledWith({
        actual: 'vieja1234',
        nueva: 'contrasena-nueva',
      }),
    );
    expect(await screen.findByText('Tu contraseña quedó actualizada.')).toBeInTheDocument();
  });

  it('muestra el rechazo del servidor cuando la actual es incorrecta', async () => {
    cambiarPassword.mockRejectedValue(new Error('Tu contraseña actual no es correcta.'));
    await abrirFormulario();

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'incorrecta' } });
    fireEvent.change(screen.getByLabelText(/Nueva contraseña/), {
      target: { value: 'contrasena-nueva' },
    });
    fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), {
      target: { value: 'contrasena-nueva' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no es correcta');
  });
});

describe('derechos ARCO', () => {
  it('ofrece descargar los datos y dice qué NO trae el archivo', async () => {
    renderPerfil();

    expect(await screen.findByRole('button', { name: /Descargar mis datos/ })).toBeInTheDocument();
    // Un paciente que cree tener su expediente completo y no lo tiene es peor
    // que uno que sabe a quién pedírselo.
    expect(
      screen.getByText(/Las notas de consulta y tu expediente clínico los resguarda tu nutrióloga/),
    ).toBeInTheDocument();
  });

  it('avisa cuando la descarga falla en vez de bajar un archivo con el error', async () => {
    descargarMisDatos.mockRejectedValue(new Error('Ya descargaste tus datos hace poco.'));
    renderPerfil();

    fireEvent.click(await screen.findByRole('button', { name: /Descargar mis datos/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya descargaste tus datos hace poco');
  });

  it('explica qué se va y qué se queda antes de pedir la contraseña', async () => {
    renderPerfil();
    fireEvent.click(await screen.findByRole('button', { name: 'Dar de baja mi cuenta' }));

    expect(screen.getByText(/Tu expediente clínico permanece con tu nutrióloga/)).toBeInTheDocument();
    expect(screen.getByLabelText('Escribe tu contraseña para confirmar')).toBeInTheDocument();
  });

  it('no da de baja sin contraseña', async () => {
    renderPerfil();
    fireEvent.click(await screen.findByRole('button', { name: 'Dar de baja mi cuenta' }));

    expect(screen.getByRole('button', { name: 'Sí, dar de baja' })).toBeDisabled();
    expect(darDeBaja).not.toHaveBeenCalled();
  });

  it('cierra la sesión después de una baja exitosa', async () => {
    darDeBaja.mockResolvedValue({ baja: true });
    renderPerfil();

    fireEvent.click(await screen.findByRole('button', { name: 'Dar de baja mi cuenta' }));
    fireEvent.change(screen.getByLabelText('Escribe tu contraseña para confirmar'), {
      target: { value: 'mi-contrasena' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, dar de baja' }));

    await waitFor(() =>
      expect(darDeBaja).toHaveBeenCalledWith({ password: 'mi-contrasena', confirmacion: true }),
    );
    // Quedarse en la app con una sesión muerta solo produce 401 y parpadeo.
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('deja reintentar si la contraseña de la baja es incorrecta', async () => {
    darDeBaja.mockRejectedValue(new Error('Tu contraseña no es correcta.'));
    renderPerfil();

    fireEvent.click(await screen.findByRole('button', { name: 'Dar de baja mi cuenta' }));
    fireEvent.change(screen.getByLabelText('Escribe tu contraseña para confirmar'), {
      target: { value: 'mala' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, dar de baja' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no es correcta');
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('estados de carga', () => {
  it('ofrece reintentar si el perfil no carga', async () => {
    obtenerPerfil.mockRejectedValue(new Error('sin conexión'));
    renderPerfil();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu perfil');
  });

  it('no muestra datos a medias mientras carga', async () => {
    obtenerPerfil.mockReturnValue(new Promise(() => {}));
    renderPerfil();

    expect(await screen.findByLabelText('Cargando tu perfil')).toBeInTheDocument();
    expect(screen.queryByText('Dar de baja mi cuenta')).not.toBeInTheDocument();
  });
});
