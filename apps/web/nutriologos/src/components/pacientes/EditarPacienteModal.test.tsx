/**
 * @jest-environment node
 */
import type { Paciente } from '@nutria/shared';

import { EXTRAS_VACIOS, type PacienteApi, aPacienteDominio } from '@/services/pacientes';

import { construirEdicion } from './EditarPacienteModal';
import { formDesdePaciente } from './camposPaciente';

function pacienteApi(overrides: Partial<PacienteApi> = {}): PacienteApi {
  const ultima = {
    id: 'm1',
    fecha: '2026-07-20',
    peso_kg: 70,
    altura_cm: 165,
    cintura_cm: 80,
    cadera_cm: 95,
    grasa_pct: 28,
    musculo_pct: null,
    pliegues: null,
  };

  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    nombre: 'Ana López',
    fecha_nacimiento: '1990-03-10',
    edad: 36,
    genero: 'FEMENINO',
    email: 'ana@ejemplo.mx',
    telefono: '5512345678',
    foto_url: null,
    estado: 'ACTIVO',
    expediente_medico: {
      condiciones: ['Hipertensión'],
      antecedentes: null,
      medicamentos: null,
      nivel_actividad: 'MUY_ACTIVO',
      objetivo: 'PERDIDA_DE_GRASA',
      objetivo_otro: null,
    },
    preferencias_alimentarias: {
      tipo_dieta: 'Vegetariano',
      alergias: ['Gluten'],
      disgustos: null,
      comidas_por_dia: 5,
      presupuesto_tiempo: 'Alto',
    },
    mediciones: [ultima],
    ultima_medicion: ultima,
    calculo: null,
    acceso_app: { cuenta_activa: false, invitacion_pendiente: null },
    ...overrides,
  };
}

const pacienteDe = (overrides: Partial<PacienteApi> = {}): Paciente =>
  aPacienteDominio(pacienteApi(overrides), EXTRAS_VACIOS);

describe('formDesdePaciente', () => {
  it('precarga el expediente vigente para corregirlo', () => {
    // Arrange
    const paciente = pacienteDe();

    // Act
    const form = formDesdePaciente(paciente);

    // Assert
    expect(form).toMatchObject({
      nombre: 'Ana López',
      fechaNacimiento: '1990-03-10',
      genero: 'Femenino',
      email: 'ana@ejemplo.mx',
      peso: '70',
      altura: '165',
      tipoDieta: 'Vegetariano',
      comidasPorDia: '5',
    });
  });

  it('deja en blanco lo que nunca se capturó, en vez de mostrar ceros', () => {
    // Arrange
    const paciente = pacienteDe({ fecha_nacimiento: null, mediciones: [], ultima_medicion: null });

    // Act
    const form = formDesdePaciente(paciente);

    // Assert
    expect(form.fechaNacimiento).toBe('');
    expect(form.peso).toBe('');
    expect(form.altura).toBe('');
  });

  it('no arrastra el centinela "Ninguna" a las listas editables', () => {
    // Arrange
    const paciente = pacienteDe({
      expediente_medico: {
        condiciones: [],
        antecedentes: null,
        medicamentos: null,
        nivel_actividad: 'MODERADO',
        objetivo: 'MANTENIMIENTO',
        objetivo_otro: null,
      },
    });

    // Act
    const form = formDesdePaciente(paciente);

    // Assert
    expect(form.condiciones).toEqual([]);
  });
});

describe('construirEdicion', () => {
  it('manda la fecha de nacimiento capturada, no una edad derivada', () => {
    // Arrange
    const paciente = pacienteDe();
    const form = { ...formDesdePaciente(paciente), fechaNacimiento: '1988-11-02' };

    // Act
    const edicion = construirEdicion(form, paciente);

    // Assert
    expect(edicion.generales.fecha_nacimiento).toBe('1988-11-02');
  });

  it('no registra una toma de medidas si no cambió ninguna', () => {
    // Arrange
    const paciente = pacienteDe();
    const form = { ...formDesdePaciente(paciente), nombre: 'Ana López Ruiz' };

    // Act
    const edicion = construirEdicion(form, paciente);

    // Assert
    expect(edicion.medicion).toBeNull();
    expect(edicion.generales.nombre).toBe('Ana López Ruiz');
  });

  it('registra una toma nueva cuando cambia el peso', () => {
    // Arrange
    const paciente = pacienteDe();
    const form = { ...formDesdePaciente(paciente), peso: '68.5' };

    // Act
    const edicion = construirEdicion(form, paciente);

    // Assert
    expect(edicion.medicion).toMatchObject({ peso_kg: 68.5, altura_cm: 165 });
  });

  it('arrastra los pliegues vigentes para que la toma nueva no los pierda', () => {
    // Arrange
    const pliegues = { tricipital: 12, bicipital: 6, subescapular: 14, suprailiaco: 10 };
    const medicion = {
      id: 'm1',
      fecha: '2026-07-20',
      peso_kg: 70,
      altura_cm: 165,
      cintura_cm: 80,
      cadera_cm: 95,
      grasa_pct: 28,
      musculo_pct: null,
      pliegues,
    };
    const paciente = pacienteDe({ mediciones: [medicion], ultima_medicion: medicion });
    const form = { ...formDesdePaciente(paciente), peso: '69' };

    // Act
    const edicion = construirEdicion(form, paciente);

    // Assert
    expect(edicion.medicion?.pliegues).toEqual(pliegues);
  });

  it('captura el expediente y las preferencias en el formato de la API', () => {
    // Arrange
    const paciente = pacienteDe();
    const form = {
      ...formDesdePaciente(paciente),
      objetivo: 'Otro' as const,
      objetivoOtro: '  Recuperación post cirugía  ',
      condiciones: ['Hipertensión', 'SOP'],
    };

    // Act
    const edicion = construirEdicion(form, paciente);

    // Assert
    expect(edicion.expediente).toMatchObject({
      objetivo: 'OTRO',
      objetivo_otro: 'Recuperación post cirugía',
      condiciones: ['Hipertensión', 'SOP'],
      nivel_actividad: 'MUY_ACTIVO',
    });
    expect(edicion.preferencias).toMatchObject({ tipo_dieta: 'Vegetariano', comidas_por_dia: 5 });
  });
});
