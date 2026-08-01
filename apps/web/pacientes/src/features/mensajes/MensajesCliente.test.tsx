import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as perfilApi from '@/features/perfil/api';

import * as api from './api';
import { MensajesCliente } from './MensajesCliente';
import type { Mensaje, RespuestaMensajes } from './types';

jest.mock('./api', () => ({
  obtenerMensajes: jest.fn(),
  enviarMensaje: jest.fn(),
  marcarLeidos: jest.fn(),
}));

jest.mock('@/features/perfil/api', () => ({
  obtenerPerfil: jest.fn(),
}));

const obtenerMensajes = api.obtenerMensajes as jest.MockedFunction<typeof api.obtenerMensajes>;
const enviarMensaje = api.enviarMensaje as jest.MockedFunction<typeof api.enviarMensaje>;
const marcarLeidos = api.marcarLeidos as jest.MockedFunction<typeof api.marcarLeidos>;
const obtenerPerfil = perfilApi.obtenerPerfil as jest.MockedFunction<typeof perfilApi.obtenerPerfil>;

function mensaje(id: string, parcial: Partial<Mensaje> = {}): Mensaje {
  return {
    id,
    emisor: 'NUTRITIONIST',
    texto: `Mensaje ${id}`,
    leido_at: null,
    created_at: new Date(2026, 6, 31, 10).toISOString(),
    ...parcial,
  };
}

function sobre(data: Mensaje[], sinLeer = 0): RespuestaMensajes {
  return {
    data,
    meta: { page: 1, per_page: data.length, total: data.length, sin_leer: sinLeer },
  };
}

function renderMensajes() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MensajesCliente />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  marcarLeidos.mockResolvedValue({ marcados: 0 });
  obtenerPerfil.mockResolvedValue({
    id: 'paciente-1',
    nombre: 'Camila Ruiz',
    email: 'camila@correo.mx',
    foto_url: null,
    objetivo: 'PERDIDA_DE_GRASA',
    objetivo_otro: null,
    nutriologo: { nombre: 'Ana Salinas', consultorio: 'Nutria Polanco' },
    meta_agua_vasos: 8,
    metas: null,
  });
});

describe('MensajesCliente', () => {
  it('muestra el hilo real, del más viejo al más nuevo', async () => {
    obtenerMensajes.mockResolvedValue(
      sobre([
        mensaje('b', { texto: 'Segunda', created_at: new Date(2026, 6, 31, 15).toISOString() }),
        mensaje('a', { texto: 'Primera', created_at: new Date(2026, 6, 31, 9).toISOString() }),
      ]),
    );
    renderMensajes();

    const burbujas = await screen.findAllByRole('listitem');
    expect(burbujas[0]).toHaveTextContent('Primera');
    expect(burbujas[1]).toHaveTextContent('Segunda');
  });

  it('nombra a la nutrióloga que atiende al paciente', async () => {
    obtenerMensajes.mockResolvedValue(sobre([]));
    renderMensajes();

    expect(await screen.findByRole('heading', { name: 'Ana Salinas' })).toBeInTheDocument();
    expect(screen.getByText('Te responde ella, no un asistente')).toBeInTheDocument();
  });

  it('nunca inventa una respuesta de la nutrióloga al enviar', async () => {
    // El prototipo inyectaba "¡Gracias por avisarme, Camila!" con un setTimeout
    // de 1.2 s, como si lo hubiera escrito la profesional. Aquí lo único que
    // aparece es lo que el paciente escribió.
    obtenerMensajes.mockResolvedValue(sobre([]));
    enviarMensaje.mockResolvedValue(mensaje('nuevo', { emisor: 'PATIENT', texto: 'Tengo una duda' }));
    renderMensajes();

    fireEvent.change(await screen.findByLabelText('Escribe un mensaje para tu nutrióloga'), {
      target: { value: 'Tengo una duda' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(enviarMensaje).toHaveBeenCalledWith('Tengo una duda'));

    await new Promise((resolve) => setTimeout(resolve, 1400));
    expect(screen.queryByText(/Gracias por avisarme/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lo reviso y te comento/)).not.toBeInTheDocument();
  });

  it('pinta la burbuja antes de que el servidor confirme', async () => {
    obtenerMensajes.mockResolvedValue(sobre([]));
    // Nunca resuelve: la burbuja optimista es lo único que puede estar en pantalla.
    enviarMensaje.mockReturnValue(new Promise(() => {}));
    renderMensajes();

    fireEvent.change(await screen.findByLabelText('Escribe un mensaje para tu nutrióloga'), {
      target: { value: 'Hola' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Enviando')).toBeInTheDocument();
  });

  it('quita la burbuja y conserva el texto si el envío falla', async () => {
    obtenerMensajes.mockResolvedValue(sobre([]));
    enviarMensaje.mockRejectedValue(new Error('No pudimos enviar tu mensaje.'));
    renderMensajes();

    const campo = await screen.findByLabelText('Escribe un mensaje para tu nutrióloga');
    fireEvent.change(campo, { target: { value: 'Se cayó la red' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar tu mensaje.');
    // Perder lo que uno acaba de teclear por un bache de red es peor que reintentar.
    expect(campo).toHaveValue('Se cayó la red');
  });

  it('acusa la lectura del hilo cuando hay mensajes sin leer', async () => {
    obtenerMensajes.mockResolvedValue(sobre([mensaje('a')], 2));
    renderMensajes();

    await waitFor(() => expect(marcarLeidos).toHaveBeenCalled());
  });

  it('no acusa nada si no hay mensajes sin leer', async () => {
    obtenerMensajes.mockResolvedValue(sobre([mensaje('a', { leido_at: '2026-07-31T10:00:00Z' })], 0));
    renderMensajes();

    await screen.findAllByRole('listitem');
    expect(marcarLeidos).not.toHaveBeenCalled();
  });

  it('invita a escribir el primero cuando el hilo está vacío', async () => {
    obtenerMensajes.mockResolvedValue(sobre([]));
    renderMensajes();

    expect(await screen.findByText('Aquí vas a hablar con tu nutrióloga')).toBeInTheDocument();
  });

  it('ofrece reintentar si la lectura falla, y el reintento vuelve a pedir', async () => {
    obtenerMensajes.mockRejectedValueOnce(new Error('sin conexión'));
    renderMensajes();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus mensajes');

    obtenerMensajes.mockResolvedValueOnce(sobre([]));
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));

    await waitFor(() => expect(obtenerMensajes).toHaveBeenCalledTimes(2));
  });

  it('avisa antes de mandar un mensaje que el servidor va a rechazar por largo', async () => {
    // `enviarMensajeSchema` topa en 2 000 caracteres: mejor decirlo aquí que
    // gastar un viaje para recibir un 422.
    obtenerMensajes.mockResolvedValue(sobre([]));
    renderMensajes();

    fireEvent.change(await screen.findByLabelText('Escribe un mensaje para tu nutrióloga'), {
      target: { value: 'a'.repeat(2001) },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('2001 de 2000 caracteres');
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
  });

  it('no deja enviar un mensaje en blanco', async () => {
    obtenerMensajes.mockResolvedValue(sobre([]));
    renderMensajes();

    const campo = await screen.findByLabelText('Escribe un mensaje para tu nutrióloga');
    fireEvent.change(campo, { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    expect(enviarMensaje).not.toHaveBeenCalled();
  });
});
