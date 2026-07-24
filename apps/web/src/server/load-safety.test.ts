import { objetivoCargaPermitido } from './load-safety';

describe('objetivoCargaPermitido', () => {
  it('permite localhost sin bandera destructiva', () => {
    expect(objetivoCargaPermitido('http://localhost:3000', false).permitido).toBe(true);
  });

  it('bloquea destinos remotos por defecto', () => {
    expect(objetivoCargaPermitido('https://app.example.test', false)).toEqual({
      permitido: false,
      motivo: 'Un destino remoto requiere LOAD_TEST_ALLOW_REMOTE=true.',
    });
  });

  it('exige HTTPS incluso con autorización remota', () => {
    expect(objetivoCargaPermitido('http://app.example.test', true).permitido).toBe(false);
    expect(objetivoCargaPermitido('https://app.example.test', true).permitido).toBe(true);
  });
});
