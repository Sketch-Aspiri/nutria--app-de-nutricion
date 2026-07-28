import { calcularOnboarding } from './onboarding';

describe('calcularOnboarding', () => {
  it('calcula el avance con señales reales del producto', () => {
    const resultado = calcularOnboarding({
      perfilProfesionalCompleto: true,
      pacientes: 1,
      planes: 0,
      citas: 2,
    });

    expect(resultado.completados).toBe(3);
    expect(resultado.porcentaje).toBe(75);
    expect(resultado.pasos.find((paso) => paso.id === 'plan')?.completado).toBe(false);
  });

  it('empieza en cero y termina en cien', () => {
    expect(
      calcularOnboarding({
        perfilProfesionalCompleto: false,
        pacientes: 0,
        planes: 0,
        citas: 0,
      }).porcentaje,
    ).toBe(0);
    expect(
      calcularOnboarding({
        perfilProfesionalCompleto: true,
        pacientes: 1,
        planes: 1,
        citas: 1,
      }).porcentaje,
    ).toBe(100);
  });
});
