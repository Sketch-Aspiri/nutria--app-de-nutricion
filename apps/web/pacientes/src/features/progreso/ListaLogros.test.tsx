import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ListaLogros } from './ListaLogros';
import type { Logro } from './types';

function logro(parcial: Partial<Logro> = {}): Logro {
  return {
    id: 'racha_dias',
    titulo: 'Racha de 7 días',
    descripcion: 'Registra tus comidas 7 días seguidos.',
    conseguido: false,
    progreso: 0.43,
    ...parcial,
  };
}

describe('ListaLogros', () => {
  it('muestra los logros pendientes con su avance, no solo los ganados', () => {
    render(<ListaLogros logros={[logro()]} />);

    expect(screen.getByText('Racha de 7 días')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Avance de "Racha de 7 días"' })).toHaveAttribute(
      'aria-valuenow',
      '43',
    );
  });

  it('cuenta cuántos lleva el paciente', () => {
    render(
      <ListaLogros
        logros={[
          logro({ id: 'a', titulo: 'A', conseguido: true, progreso: 1 }),
          logro({ id: 'b', titulo: 'B', conseguido: false, progreso: 0.5 }),
          logro({ id: 'c', titulo: 'C', conseguido: true, progreso: 1 }),
        ]}
      />,
    );

    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('anuncia el logro conseguido con palabras, no solo con color', () => {
    render(<ListaLogros logros={[logro({ conseguido: true, progreso: 1 })]} />);

    expect(screen.getByText('— conseguido')).toBeInTheDocument();
    // Un logro ya conseguido no necesita barra de avance.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('explica de dónde saldrán los logros cuando aún no hay ninguno', () => {
    render(<ListaLogros logros={[]} />);

    expect(
      screen.getByText(
        'Tus logros aparecerán conforme registres tus comidas, tu agua y tu peso.',
      ),
    ).toBeInTheDocument();
  });

  it('no desborda la barra si el avance llegara fuera de rango', () => {
    render(<ListaLogros logros={[logro({ progreso: 1.7 })]} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});
