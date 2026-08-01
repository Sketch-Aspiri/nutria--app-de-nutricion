import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { GraficaPeso } from './GraficaPeso';
import type { RegistroPeso } from './types';

function peso(fecha: string, pesoKg: number): RegistroPeso {
  return { id: `peso-${fecha}`, fecha, peso_kg: pesoKg, created_at: `${fecha}T12:00:00.000Z` };
}

describe('GraficaPeso', () => {
  it('dibuja la tendencia y la describe para un lector de pantalla', () => {
    render(
      <GraficaPeso
        pesos={[peso('2026-07-01', 78), peso('2026-07-08', 76.5), peso('2026-07-15', 75)]}
      />,
    );

    const grafica = screen.getByRole('img');
    expect(grafica).toHaveAccessibleName(
      'Evolución de tu peso: de 78 kilos el 1 jul a 75 kilos el 15 jul.',
    );
  });

  it('pide un segundo pesaje en vez de graficar un solo punto', () => {
    render(<GraficaPeso pesos={[peso('2026-07-01', 78)]} />);

    expect(screen.getByText('Registra tu peso al menos dos veces para ver tu tendencia.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('no grafica nada sin pesajes', () => {
    render(<GraficaPeso pesos={[]} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('rotula el rango con los pesos reales', () => {
    render(<GraficaPeso pesos={[peso('2026-07-01', 78), peso('2026-07-15', 75)]} />);

    expect(screen.getByText('75 – 78 kg')).toBeInTheDocument();
    expect(screen.getByText('1 jul')).toBeInTheDocument();
    expect(screen.getByText('15 jul')).toBeInTheDocument();
  });

  it('escala al ancho del teléfono en vez de fijar píxeles', () => {
    // La del panel es de 220×70 px fijos; en un contenedor de 480 px máximo
    // eso deja la gráfica a media tarjeta.
    const { container } = render(
      <GraficaPeso pesos={[peso('2026-07-01', 78), peso('2026-07-15', 75)]} />,
    );

    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox');
    expect(svg).not.toHaveAttribute('width');
  });
});
