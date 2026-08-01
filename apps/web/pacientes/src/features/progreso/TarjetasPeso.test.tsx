import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { TarjetasPeso } from './TarjetasPeso';
import type { Progreso } from './types';

function progreso(parcial: Partial<Progreso> = {}): Progreso {
  return {
    pesos: [],
    peso: null,
    falta_kg: null,
    logros: [],
    ...parcial,
  };
}

describe('TarjetasPeso', () => {
  it('muestra los kilos bajados y el peso actual', () => {
    render(
      <TarjetasPeso progreso={progreso({ peso: { inicial: 78, actual: 74.5, cambio_kg: -3.5 } })} />,
    );

    expect(screen.getByText('Perdido')).toBeInTheDocument();
    expect(screen.getByText('3.5')).toBeInTheDocument();
    expect(screen.getByText('74.5')).toBeInTheDocument();
    expect(screen.getByText('Inicio: 78 kg')).toBeInTheDocument();
  });

  it('no le dice "Perdido" a quien subió de peso', () => {
    render(
      <TarjetasPeso progreso={progreso({ peso: { inicial: 58, actual: 60, cambio_kg: 2 } })} />,
    );

    expect(screen.getByText('Ganado')).toBeInTheDocument();
    expect(screen.queryByText('Perdido')).not.toBeInTheDocument();
  });

  it('muestra el cero real de quien se pesó dos veces sin moverse', () => {
    render(
      <TarjetasPeso progreso={progreso({ peso: { inicial: 70, actual: 70, cambio_kg: 0 } })} />,
    );

    expect(screen.getByText('Sin cambio')).toBeInTheDocument();
    expect(screen.getByText('Igual que al inicio')).toBeInTheDocument();
  });

  it('no inventa un cero cuando el paciente nunca se ha pesado', () => {
    // Un "0 kg" de relleno en una app de salud se lee como un dato del propio
    // cuerpo. Sin pesajes se explica qué falta, no se rellena con ceros.
    render(<TarjetasPeso progreso={progreso()} />);

    expect(screen.getByText('Aún no registras tu peso')).toBeInTheDocument();
    expect(screen.getByText('Regístralo desde el botón +')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('dice que no hay meta de peso en vez de estimar una', () => {
    // `falta_kg` viaja siempre en `null` (§9): el modelo no guarda peso
    // objetivo, y estimarlo sería inventarle una meta clínica al paciente.
    render(
      <TarjetasPeso progreso={progreso({ peso: { inicial: 78, actual: 74, cambio_kg: -4 } })} />,
    );

    expect(screen.getByText('Tu nutrióloga aún no fija una meta de peso')).toBeInTheDocument();
  });

  it('pinta la meta el día que el contrato la traiga', () => {
    render(<TarjetasPeso progreso={progreso({ falta_kg: 2.5 })} />);

    expect(screen.getByText('2.5')).toBeInTheDocument();
  });
});
