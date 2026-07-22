import type { Cita, Factura, Marca, MensajeChat, Paciente, PlantillaPlan } from '@nutria/shared';

/** Datos ficticios de demostración del MVP — no son datos reales de pacientes. */
export const PACIENTES_DEMO: Paciente[] = [
  {
    id: 1,
    nombre: 'Camila Torres',
    foto: null,
    edad: 29,
    genero: 'Femenino',
    telefono: '55 1234 5678',
    email: 'camila@mail.com',
    medico: {
      condiciones: ['Ninguna'],
      antecedentes: 'Sin antecedentes relevantes.',
      medicamentos: 'Ninguno',
      nivelActividad: 'Moderado',
      objetivo: 'Pérdida de grasa',
    },
    antropometria: {
      peso: 68,
      altura: 165,
      cintura: 78,
      cadera: 98,
      grasaCorporal: 26,
      historial: [
        { fecha: 'May', peso: 72 },
        { fecha: 'Jun', peso: 70 },
        { fecha: 'Jul', peso: 68 },
      ],
    },
    preferencias: {
      tipoDieta: 'Omnívoro',
      alergias: ['Lactosa'],
      disgustos: 'Brócoli, hígado',
      comidasPorDia: 4,
      presupuestoTiempo: 'Medio',
    },
    calculo: null,
    planActivo: null,
    planEjercicio: null,
    notasConsulta: [],
    seguimiento: {
      adherencia: 78,
      racha: 5,
      comidas: [
        { id: 1, fecha: 'Hoy 08:15', nombre: 'Avena con fruta y nueces', emoji: '🥣', comentario: '' },
        { id: 2, fecha: 'Ayer 14:00', nombre: 'Ensalada con pollo a la plancha', emoji: '🥗', comentario: '' },
        { id: 3, fecha: 'Ayer 20:30', nombre: 'Yogurt con miel', emoji: '🍯', comentario: '' },
      ],
      ejercicio: [
        { id: 1, fecha: 'Hoy', tipo: 'Caminata', duracion: '35 min' },
        { id: 2, fecha: 'Ayer', tipo: 'Fuerza — tren inferior', duracion: '45 min' },
      ],
      recetasEnCurso: [
        { id: 1, nombre: 'Bowl de quinoa con verduras asadas', frecuencia: '3 veces esta semana' },
      ],
      recetasSugeridas: [],
    },
  },
  {
    id: 2,
    nombre: 'Diego Ramírez',
    foto: null,
    edad: 41,
    genero: 'Masculino',
    telefono: '55 9876 5432',
    email: 'diego@mail.com',
    medico: {
      condiciones: ['Dislipidemia'],
      antecedentes: 'Colesterol alto diagnosticado en 2024.',
      medicamentos: 'Estatina (noche)',
      nivelActividad: 'Activo',
      objetivo: 'Ganancia muscular',
    },
    antropometria: {
      peso: 79,
      altura: 178,
      cintura: 88,
      cadera: 101,
      grasaCorporal: 18,
      historial: [
        { fecha: 'May', peso: 75 },
        { fecha: 'Jun', peso: 77 },
        { fecha: 'Jul', peso: 79 },
      ],
    },
    preferencias: {
      tipoDieta: 'Omnívoro',
      alergias: ['Mariscos'],
      disgustos: 'Cilantro',
      comidasPorDia: 5,
      presupuestoTiempo: 'Alto',
    },
    calculo: null,
    planActivo: null,
    planEjercicio: null,
    notasConsulta: [],
    seguimiento: {
      adherencia: 41,
      racha: 0,
      comidas: [],
      ejercicio: [],
      recetasEnCurso: [],
      recetasSugeridas: [],
    },
  },
];

export const CITAS_DEMO: Cita[] = [
  { id: 1, pacienteId: 1, paciente: 'Camila Torres', fecha: '2026-07-24', hora: '10:00', tipo: 'Seguimiento', recordatorio: true },
  { id: 2, pacienteId: 2, paciente: 'Diego Ramírez', fecha: '2026-07-25', hora: '17:30', tipo: 'Primera consulta', recordatorio: true },
];

export const MENSAJES_DEMO: Record<number, MensajeChat[]> = {
  1: [
    { de: 'paciente', texto: 'Hola, ¿el yogurt griego puede ser de sabor?', hora: '09:12' },
    { de: 'nutriologo', texto: 'Mejor natural, el de sabor trae azúcar añadida. Puedes endulzarlo con fruta.', hora: '09:30' },
  ],
  2: [],
};

export const FACTURAS_DEMO: Factura[] = [
  { id: 1, pacienteId: 1, paciente: 'Camila Torres', concepto: 'Consulta de seguimiento', monto: 600, fecha: '2026-07-10', pagada: true, cfdi: true },
  { id: 2, pacienteId: 2, paciente: 'Diego Ramírez', concepto: 'Primera consulta + plan', monto: 900, fecha: '2026-07-18', pagada: false, cfdi: false },
];

export const PLANTILLAS_DEMO: PlantillaPlan[] = [
  {
    id: 1,
    nombre: 'Déficit moderado — omnívoro',
    objetivo: 'Pérdida de grasa',
    calorias: 1600,
    descripcion: '4 comidas, alto en proteína, base de verduras y cereales integrales.',
  },
  {
    id: 2,
    nombre: 'Volumen limpio — deportista',
    objetivo: 'Ganancia muscular',
    calorias: 2600,
    descripcion: '5 comidas, superávit ligero, carbohidratos alrededor del entrenamiento.',
  },
];

export const MARCA_DEMO: Marca = {
  nombre: 'nutria',
  profesional: 'Nutrióloga certificada',
  color: '#166534',
  logo: null,
};
