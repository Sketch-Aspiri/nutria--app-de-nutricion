import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { HojaModal } from './HojaModal';

function Ejemplo() {
  const [abierta, setAbierta] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setAbierta(true)}>
        Abrir hoja
      </button>
      {abierta && (
        <HojaModal titulo="Hoja de prueba" onClose={() => setAbierta(false)}>
          <button type="button">Acción final</button>
        </HojaModal>
      )}
    </div>
  );
}

describe('HojaModal', () => {
  it('contiene el foco, vuelve inerte el fondo y restaura el disparador al cerrar', async () => {
    render(<Ejemplo />);
    const disparador = screen.getByRole('button', { name: 'Abrir hoja' });
    disparador.focus();
    fireEvent.click(disparador);

    const dialogo = screen.getByRole('dialog', { name: 'Hoja de prueba' });
    const cerrar = screen.getAllByRole('button', { name: 'Cerrar' })[1]!;
    const ultima = screen.getByRole('button', { name: 'Acción final' });

    expect(cerrar).toHaveFocus();
    expect(disparador.inert).toBe(true);

    ultima.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(cerrar).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(dialogo).not.toBeInTheDocument());
    expect(disparador).toHaveFocus();
    expect(disparador.inert).toBe(false);
  });
});
