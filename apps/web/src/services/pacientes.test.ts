/**
 * @jest-environment node
 */
import { EXTRAS_VACIOS, type PacienteApi, aPacienteDominio } from './pacientes';

function pacienteApi(overrides: Partial<PacienteApi> = {}): PacienteApi {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    nombre: 'Paciente Prueba',
    fecha_nacimiento: '1990-03-10',
    edad: 36,
    genero: 'FEMENINO',
    email: null,
    telefono: null,
    foto_url: null,
    estado: 'ACTIVO',
    expediente_medico: {
      condiciones: ['Hipertensión'],
      antecedentes: null,
      medicamentos: null,
      nivel_actividad: 'MUY_ACTIVO',
      objetivo: 'PERDIDA_DE_GRASA',
    },
    preferencias_alimentarias: {
      tipo_dieta: 'Vegetariano',
      alergias: ['Gluten'],
      disgustos: null,
      comidas_por_dia: 5,
      presupuesto_tiempo: 'Alto',
    },
    mediciones: [],
    ultima_medicion: null,
    ...overrides,
  };
}

describe('aPacienteDominio', () => {
  it('traduce los enums de la base a las etiquetas que ve el nutriólogo', () => {
    const paciente = aPacienteDominio(pacienteApi(), EXTRAS_VACIOS);

    expect(paciente.genero).toBe('Femenino');
    expect(paciente.medico.nivelActividad).toBe('Muy activo');
    expect(paciente.medico.objetivo).toBe('Pérdida de grasa');
  });

  it('conserva el UUID como identificador', () => {
    expect(aPacienteDominio(pacienteApi(), EXTRAS_VACIOS).id).toBe(
      'a1b2c3d4-0000-4000-8000-000000000001',
    );
  });

  it('toma la antropometría de la última medición', () => {
    const paciente = aPacienteDominio(
      pacienteApi({
        ultima_medicion: {
          id: 'm1',
          fecha: '2026-07-20',
          peso_kg: 72.5,
          altura_cm: 168,
          cintura_cm: 80,
          cadera_cm: 95,
          grasa_pct: 28,
          musculo_pct: null,
        },
      }),
      EXTRAS_VACIOS,
    );

    expect(paciente.antropometria.peso).toBe(72.5);
    expect(paciente.antropometria.altura).toBe(168);
    expect(paciente.antropometria.grasaCorporal).toBe(28);
  });

  it('deja las medidas en 0 sin mediciones, para que el cálculo falle en vez de inventar', () => {
    const paciente = aPacienteDominio(pacienteApi(), EXTRAS_VACIOS);

    expect(paciente.antropometria.peso).toBe(0);
    expect(paciente.antropometria.altura).toBe(0);
  });

  it('ordena el historial de peso de la medición más antigua a la más reciente', () => {
    const medicion = (id: string, fecha: string, peso: number) => ({
      id,
      fecha,
      peso_kg: peso,
      altura_cm: null,
      cintura_cm: null,
      cadera_cm: null,
      grasa_pct: null,
      musculo_pct: null,
    });

    const paciente = aPacienteDominio(
      pacienteApi({
        // La API las devuelve de la más reciente a la más antigua.
        mediciones: [
          medicion('m3', '2026-07-20', 70),
          medicion('m2', '2026-06-20', 72),
          medicion('m1', '2026-05-20', 75),
        ],
      }),
      EXTRAS_VACIOS,
    );

    expect(paciente.antropometria.historial.map((r) => r.peso)).toEqual([75, 72, 70]);
  });

  it('omite del historial las mediciones que no registraron peso', () => {
    const paciente = aPacienteDominio(
      pacienteApi({
        mediciones: [
          {
            id: 'm1',
            fecha: '2026-07-20',
            peso_kg: null,
            altura_cm: 170,
            cintura_cm: null,
            cadera_cm: null,
            grasa_pct: null,
            musculo_pct: null,
          },
        ],
      }),
      EXTRAS_VACIOS,
    );

    expect(paciente.antropometria.historial).toEqual([]);
  });

  it('muestra "Ninguna" cuando no hay condiciones ni alergias capturadas', () => {
    const paciente = aPacienteDominio(
      pacienteApi({
        expediente_medico: {
          condiciones: [],
          antecedentes: null,
          medicamentos: null,
          nivel_actividad: 'MODERADO',
          objetivo: 'MANTENIMIENTO',
        },
        preferencias_alimentarias: {
          tipo_dieta: null,
          alergias: [],
          disgustos: null,
          comidas_por_dia: 3,
          presupuesto_tiempo: 'Medio',
        },
      }),
      EXTRAS_VACIOS,
    );

    expect(paciente.medico.condiciones).toEqual(['Ninguna']);
    expect(paciente.preferencias.alergias).toEqual(['Ninguna']);
  });

  it('usa valores por defecto seguros si el expediente aún no existe', () => {
    const paciente = aPacienteDominio(
      pacienteApi({ expediente_medico: null, preferencias_alimentarias: null }),
      EXTRAS_VACIOS,
    );

    expect(paciente.medico.nivelActividad).toBe('Moderado');
    expect(paciente.medico.objetivo).toBe('Mantenimiento');
    expect(paciente.preferencias.tipoDieta).toBe('Omnívoro');
  });

  it('incorpora los extras que todavía no viven en la base', () => {
    const paciente = aPacienteDominio(pacienteApi(), {
      ...EXTRAS_VACIOS,
      seguimiento: { ...EXTRAS_VACIOS.seguimiento, adherencia: 82, racha: 5 },
    });

    expect(paciente.seguimiento.adherencia).toBe(82);
    expect(paciente.seguimiento.racha).toBe(5);
  });

  it('normaliza a cadena vacía los contactos ausentes', () => {
    const paciente = aPacienteDominio(pacienteApi(), EXTRAS_VACIOS);

    expect(paciente.email).toBe('');
    expect(paciente.telefono).toBe('');
  });
});
