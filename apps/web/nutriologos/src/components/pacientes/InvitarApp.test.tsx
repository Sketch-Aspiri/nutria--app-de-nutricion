import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { AccesoAppApi, InvitacionApi } from '@/services/pacientes';

import { InvitarApp } from './InvitarApp';

const invitarPacienteApi = jest.fn<Promise<InvitacionApi>, [string]>();

jest.mock('@/services/pacientes', () => {
  class ApiError extends Error {
    readonly code: string;

    constructor(error: { code: string; message: string }) {
      super(error.message);
      this.name = 'ApiError';
      this.code = error.code;
    }
  }
  return {
    ApiError,
    invitarPacienteApi: (id: string) => invitarPacienteApi(id),
  };
});

const PACIENTE_ID = 'a1b2c3d4-0000-4000-8000-000000000001';

const SIN_ACCESO: AccesoAppApi = { cuenta_activa: false, invitacion_pendiente: null };

function renderBoton(acceso: AccesoAppApi | null) {
  // Sin reintentos: un rechazo del servidor debe verse de inmediato.
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <InvitarApp pacienteId={PACIENTE_ID} acceso={acceso} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  invitarPacienteApi.mockResolvedValue({
    invitacion_enviada: true,
    expira_en: '2026-08-04T00:00:00.000Z',
  });
});

describe('InvitarApp', () => {
  it('ofrece invitar al paciente que aún no tiene acceso', () => {
    renderBoton(SIN_ACCESO);

    expect(screen.getByRole('button', { name: /invitar a la app/i })).toBeInTheDocument();
  });

  it('envía la invitación al pulsar el botón', async () => {
    renderBoton(SIN_ACCESO);

    fireEvent.click(screen.getByRole('button', { name: /invitar a la app/i }));

    await waitFor(() => expect(invitarPacienteApi).toHaveBeenCalledWith(PACIENTE_ID));
    expect(await screen.findByText(/invitación enviada/i)).toBeInTheDocument();
  });

  it('ofrece reenviar cuando ya hay una invitación pendiente y muestra su vencimiento', () => {
    renderBoton({
      cuenta_activa: false,
      invitacion_pendiente: {
        enviada_en: '2026-07-28T00:00:00.000Z',
        expira_en: '2026-08-04T00:00:00.000Z',
      },
    });

    expect(screen.getByRole('button', { name: /reenviar invitación/i })).toBeInTheDocument();
    expect(screen.getByText(/invitación pendiente/i)).toBeInTheDocument();
  });

  it('no ofrece invitar al paciente que ya usa la app', () => {
    renderBoton({ cuenta_activa: true, invitacion_pendiente: null });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/usa la app/i)).toBeInTheDocument();
  });

  it('muestra el motivo del servidor cuando falta un requisito del expediente', async () => {
    const { ApiError } = jest.requireMock('@/services/pacientes') as {
      ApiError: new (error: { code: string; message: string }) => Error;
    };
    invitarPacienteApi.mockRejectedValue(
      new ApiError({
        code: 'PATIENT_NOT_INVITABLE',
        message: 'Agrega el correo del paciente en su expediente para poder invitarlo.',
      }),
    );

    renderBoton(SIN_ACCESO);
    fireEvent.click(screen.getByRole('button', { name: /invitar a la app/i }));

    expect(await screen.findByText(/agrega el correo del paciente/i)).toBeInTheDocument();
  });

  it('no renderiza nada mientras el detalle no trae el estado de acceso', () => {
    const { container } = renderBoton(null);

    expect(container).toBeEmptyDOMElement();
  });
});
