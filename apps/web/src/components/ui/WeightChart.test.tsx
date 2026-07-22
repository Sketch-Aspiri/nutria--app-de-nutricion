import { render, screen } from '@testing-library/react';

import { WeightChart } from './WeightChart';

describe('WeightChart', () => {
  it('muestra un aviso cuando no hay historial suficiente', () => {
    render(<WeightChart data={[{ fecha: 'Hoy', peso: 70 }]} />);
    expect(screen.getByText('Aún no hay historial suficiente.')).toBeInTheDocument();
  });

  it('dibuja la gráfica con dos o más registros', () => {
    render(
      <WeightChart
        data={[
          { fecha: 'Jun', peso: 72 },
          { fecha: 'Jul', peso: 70 },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Evolución de peso' })).toBeInTheDocument();
  });
});
