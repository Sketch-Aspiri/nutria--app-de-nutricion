import { resolverIdParaActivar } from './usePlanes';

describe('workspace de planes', () => {
  it('no activa la versión anterior cuando falla el guardado de cambios', () => {
    expect(
      resolverIdParaActivar(true, null, 'plan-persistido-anterior'),
    ).toBeNull();
  });

  it('activa el id devuelto por el guardado exitoso', () => {
    expect(
      resolverIdParaActivar(
        true,
        { id: 'plan-recien-guardado' },
        'plan-persistido-anterior',
      ),
    ).toBe('plan-recien-guardado');
  });

  it('puede activar directamente un plan sin cambios pendientes', () => {
    expect(
      resolverIdParaActivar(false, null, 'plan-sin-cambios'),
    ).toBe('plan-sin-cambios');
  });
});
