import type { Paciente } from '../types';

/**
 * Factory de paciente para tests. Datos ficticios — nunca usar datos reales
 * de usuarios en fixtures (regla del proyecto: datos de salud).
 */
export function crearPacienteDePrueba(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    nombre: 'Paciente Prueba',
    foto: null,
    edad: 30,
    fechaNacimiento: '1996-01-15',
    genero: 'Femenino',
    telefono: '',
    email: '',
    medico: {
      condiciones: ['Ninguna'],
      antecedentes: '',
      medicamentos: '',
      nivelActividad: 'Moderado',
      objetivo: 'Mantenimiento',
      // Solo acompaña al objetivo OTRO; con cualquier otro va nulo.
      objetivoOtro: null,
    },
    antropometria: {
      peso: 65,
      altura: 165,
      cintura: 0,
      cadera: 0,
      grasaCorporal: 0,
      pliegues: null,
      historial: [],
    },
    preferencias: {
      tipoDieta: 'Omnívoro',
      alergias: ['Ninguna'],
      disgustos: '',
      comidasPorDia: 4,
      presupuestoTiempo: 'Medio',
    },
    calculo: null,
    planActivo: null,
    notasConsulta: [],
    seguimiento: {
      adherencia: 0,
      racha: 0,
      comidas: [],
      ejercicio: [],
      recetasEnCurso: [],
      recetasSugeridas: [],
    },
    ...overrides,
  };
}
