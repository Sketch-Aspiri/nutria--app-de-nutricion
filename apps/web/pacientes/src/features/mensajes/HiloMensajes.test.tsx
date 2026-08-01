import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { HiloMensajes } from './HiloMensajes';
import type { MensajeEnPantalla } from './types';

function mensaje(parcial: Partial<MensajeEnPantalla> = {}): MensajeEnPantalla {
  return {
    id: 'm1',
    emisor: 'PATIENT',
    texto: 'Hola',
    leido_at: null,
    created_at: new Date(2026, 6, 31, 10, 15).toISOString(),
    ...parcial,
  };
}

describe('acuse de envío', () => {
  it('dice "Enviando" mientras el servidor no confirma', () => {
    render(<HiloMensajes mensajes={[mensaje({ pendiente: true })]} />);

    expect(screen.getByText('Enviando')).toBeInTheDocument();
  });

  it('dice "Enviado" cuando el servidor lo aceptó pero nadie lo abrió', () => {
    render(<HiloMensajes mensajes={[mensaje()]} />);

    expect(screen.getByText('Enviado')).toBeInTheDocument();
  });

  it('dice "Leído" cuando la nutrióloga lo abrió', () => {
    // La palomita doble no significa nada para quien no la ve: el estado va
    // también en palabras.
    render(<HiloMensajes mensajes={[mensaje({ leido_at: '2026-07-31T18:00:00.000Z' })]} />);

    expect(screen.getByText('Leído')).toBeInTheDocument();
  });

  it('no pone acuse en los mensajes de la nutrióloga', () => {
    // El acuse es sobre lo que el paciente mandó; en un mensaje recibido no
    // tiene sentido.
    render(<HiloMensajes mensajes={[mensaje({ emisor: 'NUTRITIONIST' })]} />);

    expect(screen.queryByText('Enviado')).not.toBeInTheDocument();
    expect(screen.queryByText('Leído')).not.toBeInTheDocument();
  });
});

describe('separadores de día', () => {
  it('agrupa bajo un encabezado con la hora de cada mensaje', () => {
    render(
      <HiloMensajes
        mensajes={[
          mensaje({ id: 'a', created_at: new Date(2026, 6, 20, 9, 5).toISOString() }),
          mensaje({ id: 'b', created_at: new Date(2026, 6, 20, 14, 30).toISOString() }),
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: '20 jul' })).toBeInTheDocument();
    expect(screen.getByText('09:05')).toBeInTheDocument();
    expect(screen.getByText('14:30')).toBeInTheDocument();
  });

  it('respeta los saltos de línea que escribió quien lo mandó', () => {
    render(<HiloMensajes mensajes={[mensaje({ texto: 'Primero\nSegundo' })]} />);

    expect(screen.getByText(/Primero\s+Segundo/)).toBeInTheDocument();
  });
});
