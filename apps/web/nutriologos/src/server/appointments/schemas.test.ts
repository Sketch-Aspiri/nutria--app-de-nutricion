import { actualizarCitaSchema, crearCitaSchema } from './schemas';

const PATIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function crear(overrides: Record<string, unknown> = {}) {
  return crearCitaSchema.safeParse({
    patient_id: PATIENT_ID,
    inicio: '2026-08-01T09:00:00-06:00',
    ...overrides,
  });
}

describe('crearCitaSchema', () => {
  it('acepta una cita con zona horaria explícita y aplica la duración por defecto', () => {
    const resultado = crear();

    expect(resultado.success).toBe(true);
    expect(resultado.data?.duracion_min).toBe(45);
    expect(resultado.data?.tipo).toBe('PRESENCIAL');
    // 09:00 en UTC-6 son las 15:00 UTC.
    expect(resultado.data?.inicio.toISOString()).toBe('2026-08-01T15:00:00.000Z');
  });

  it('rechaza una fecha sin zona horaria', () => {
    // Sin desplazamiento, el servidor la leería en UTC y la cita aparecería
    // seis horas corrida en el consultorio.
    expect(crear({ inicio: '2026-08-01T09:00:00' }).success).toBe(false);
  });

  it('rechaza una fecha que no es una fecha', () => {
    expect(crear({ inicio: 'mañana a las nueve' }).success).toBe(false);
  });

  it('rechaza duraciones fuera de rango', () => {
    expect(crear({ duracion_min: 0 }).success).toBe(false);
    expect(crear({ duracion_min: 1_000 }).success).toBe(false);
  });

  it('rechaza un enlace de videollamada con protocolo peligroso', () => {
    // `z.url()` por sí sola aceptaría estos: el enlace acaba en un href del
    // correo del paciente.
    expect(crear({ video_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(crear({ video_url: 'data:text/html,<script>' }).success).toBe(false);
  });

  it('acepta un enlace https normal', () => {
    expect(crear({ video_url: 'https://meet.google.com/abc-defg-hij' }).success).toBe(true);
  });

  it('rechaza un patient_id que no es UUID', () => {
    expect(crear({ patient_id: '42' }).success).toBe(false);
  });
});

describe('actualizarCitaSchema', () => {
  it('exige al menos un cambio', () => {
    expect(actualizarCitaSchema.safeParse({}).success).toBe(false);
  });

  it('acepta un cambio de estado aislado', () => {
    expect(actualizarCitaSchema.safeParse({ estado: 'NO_ASISTIO' }).success).toBe(true);
  });

  it('rechaza un estado que no existe', () => {
    expect(actualizarCitaSchema.safeParse({ estado: 'REAGENDADA' }).success).toBe(false);
  });
});
