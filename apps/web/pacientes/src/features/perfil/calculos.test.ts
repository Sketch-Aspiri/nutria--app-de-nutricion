import type { PerfilPaciente } from './api';
import {
  descripcionDeObjetivo,
  inicialesDe,
  MENSAJE_PASSWORD,
  PASSWORD_MIN,
  validarPassword,
} from './calculos';

function perfil(parcial: Partial<PerfilPaciente> = {}): PerfilPaciente {
  return {
    id: 'p1',
    nombre: 'Camila Ruiz',
    email: 'camila@correo.mx',
    foto_url: null,
    objetivo: 'PERDIDA_DE_GRASA',
    objetivo_otro: null,
    nutriologo: { nombre: 'Ana Salinas', consultorio: 'Nutria Polanco' },
    meta_agua_vasos: 8,
    metas: null,
    ...parcial,
  };
}

describe('descripcionDeObjetivo', () => {
  it('traduce el enum a algo legible', () => {
    expect(descripcionDeObjetivo(perfil())).toBe('Pérdida de grasa');
    expect(descripcionDeObjetivo(perfil({ objetivo: 'CONTROL_DE_DIABETES' }))).toBe(
      'Control de diabetes',
    );
  });

  it('usa el texto libre cuando el objetivo es OTRO', () => {
    expect(
      descripcionDeObjetivo(perfil({ objetivo: 'OTRO', objetivo_otro: 'Preparar un maratón' })),
    ).toBe('Preparar un maratón');
  });

  it('no inventa una meta si OTRO viene sin detalle', () => {
    expect(descripcionDeObjetivo(perfil({ objetivo: 'OTRO', objetivo_otro: '   ' }))).toBe('Otro');
  });

  it('devuelve null cuando el expediente aún no registra objetivo', () => {
    // Lo define la nutrióloga en consulta, no la app.
    expect(descripcionDeObjetivo(perfil({ objetivo: null }))).toBeNull();
  });
});

describe('inicialesDe', () => {
  it('toma las dos primeras iniciales', () => {
    expect(inicialesDe('Camila Ruiz Vega')).toBe('CR');
  });

  it('aguanta un nombre vacío o ausente', () => {
    expect(inicialesDe('')).toBe('');
    expect(inicialesDe(null)).toBe('');
    expect(inicialesDe('   ')).toBe('');
  });
});

describe('validarPassword', () => {
  const larga = 'a'.repeat(PASSWORD_MIN);

  it('acepta una contraseña nueva, distinta y confirmada', () => {
    expect(validarPassword('vieja-larga-1', larga, larga)).toBeNull();
  });

  it('exige la longitud mínima del servidor', () => {
    expect(validarPassword('vieja', 'corta', 'corta')).toBe('corta');
  });

  it('no deja repetir la contraseña actual', () => {
    expect(validarPassword(larga, larga, larga)).toBe('igual');
  });

  it('exige que la confirmación coincida', () => {
    expect(validarPassword('vieja-larga-1', larga, `${larga}x`)).toBe('sin_confirmar');
  });

  it('tiene un mensaje para cada problema', () => {
    // Un problema sin mensaje dejaría el formulario bloqueado sin explicación.
    for (const problema of ['corta', 'igual', 'sin_confirmar'] as const) {
      expect(MENSAJE_PASSWORD[problema]).toBeTruthy();
    }
  });
});
