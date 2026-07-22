import { render, screen } from '@testing-library/react';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('muestra las iniciales (máximo dos) cuando no hay foto', () => {
    render(<Avatar foto={null} nombre="Camila Torres Díaz" />);
    expect(screen.getByText('CT')).toBeInTheDocument();
  });

  it('muestra la imagen cuando hay foto', () => {
    render(<Avatar foto="data:image/png;base64,x" nombre="Camila Torres" />);
    expect(screen.getByAltText('Camila Torres')).toBeInTheDocument();
  });
});
