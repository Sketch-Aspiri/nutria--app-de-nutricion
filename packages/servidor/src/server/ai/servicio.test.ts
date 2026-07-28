/**
 * @jest-environment node
 */
import { IaUpstreamError, generar, generarConStream } from './cliente';
import {
  cargarCatalogoAlimentos,
  cargarContextoPaciente,
  identificadoresDePaciente,
} from './contexto';
import type { AlimentoCatalogo, ContextoPaciente } from './contexto';
import {
  CuotaAgotadaError,
  PacienteNoEncontradoError,
  generarContenido,
} from './servicio';
import { devolverGeneracion, registrarTokens, reservarGeneracion } from './uso';

jest.mock('./cliente', () => {
  const real = jest.requireActual('./cliente');
  return { ...real, generar: jest.fn(), generarConStream: jest.fn() };
});
jest.mock('./contexto', () => ({
  cargarContextoPaciente: jest.fn(),
  cargarCatalogoAlimentos: jest.fn(),
  identificadoresDePaciente: jest.fn(),
  limpiarTextoDelNutriologo: (texto: string) => texto,
}));
jest.mock('./uso', () => ({
  reservarGeneracion: jest.fn(),
  devolverGeneracion: jest.fn(),
  registrarTokens: jest.fn(),
}));

const mockGenerar = generar as jest.Mock;
const mockGenerarConStream = generarConStream as jest.Mock;
const mockContexto = cargarContextoPaciente as jest.Mock;
const mockCatalogo = cargarCatalogoAlimentos as jest.Mock;
const mockIdentificadores = identificadoresDePaciente as jest.Mock;
const mockReservar = reservarGeneracion as jest.Mock;
const mockDevolver = devolverGeneracion as jest.Mock;
const mockRegistrar = registrarTokens as jest.Mock;

const USER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const PATIENT_ID = 'b1b2c3d4-0000-4000-8000-000000000002';

const ALIMENTO: AlimentoCatalogo = {
  id: 'f1b2c3d4-0000-4000-8000-000000000001',
  nombre: 'Tortilla de maíz',
  grupo: 'cereales',
  porcion: '1 pieza (30 g)',
  porcionDescripcion: '1 pieza',
  porcionGramos: 30,
  imagenUrl: null,
  energiaKcal: 70,
  proteinaG: 2,
  carbosG: 14,
  lipidosG: 1,
};

const CONTEXTO: ContextoPaciente = {
  patientId: PATIENT_ID,
  edad: 34,
  genero: 'Femenino',
  nivelActividad: 'Moderado',
  objetivo: 'Pérdida de grasa',
  condiciones: [],
  antecedentes: null,
  medicamentos: null,
  tipoDieta: null,
  alergias: ['Nuez'],
  disgustos: null,
  comidasPorDia: 1,
  pesoKg: 68,
  alturaCm: 162,
  meta: { calorias: 2_000, proteinaG: 120, carbosG: 200, grasaG: 70, ecuacion: 'mifflin' },
};

const CUOTA = { plan: 'PRO' as const, limite: 150, usadas: 1, restantes: 149, agotada: false };

function planValido(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    calorias_diarias: 2_000,
    proteina_g: 120,
    carbos_g: 200,
    grasa_g: 70,
    nota: 'Revisar porciones.',
    comidas: [
      {
        nombre: 'Comida',
        horario: '14:00',
        descripcion: 'Preparación de prueba',
        items: [{ food_id: ALIMENTO.id, descripcion: 'Dos tortillas', cantidad_porciones: 2 }],
      },
    ],
    ...overrides,
  });
}

function respuesta(texto: string) {
  return { texto, uso: { entrada: 1_000, salida: 500 } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReservar.mockResolvedValue({ permitida: true, cuota: CUOTA });
  mockContexto.mockResolvedValue(CONTEXTO);
  mockCatalogo.mockResolvedValue([ALIMENTO]);
  mockIdentificadores.mockResolvedValue({ nombre: 'Ana López', email: null, telefono: null });
  mockDevolver.mockResolvedValue(undefined);
  mockRegistrar.mockResolvedValue(undefined);
});

describe('generarContenido — cuota', () => {
  it('rechaza sin llamar al proveedor cuando la cuota está agotada', async () => {
    mockReservar.mockResolvedValue({
      permitida: false,
      cuota: { ...CUOTA, usadas: 150, restantes: 0, agotada: true },
    });

    await expect(
      generarContenido(USER_ID, { tipo: 'PLAN', patient_id: PATIENT_ID, stream: false }),
    ).rejects.toBeInstanceOf(CuotaAgotadaError);
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('reembolsa la generación cuando el proveedor falla', async () => {
    mockGenerar.mockRejectedValue(new IaUpstreamError(529));

    await expect(
      generarContenido(USER_ID, { tipo: 'PLAN', patient_id: PATIENT_ID, stream: false }),
    ).rejects.toBeInstanceOf(IaUpstreamError);
    expect(mockDevolver).toHaveBeenCalledWith(USER_ID);
  });

  it('reembolsa la generación cuando el paciente no es del nutriólogo', async () => {
    mockContexto.mockResolvedValue(null);

    await expect(
      generarContenido(USER_ID, { tipo: 'PLAN', patient_id: PATIENT_ID, stream: false }),
    ).rejects.toBeInstanceOf(PacienteNoEncontradoError);
    expect(mockDevolver).toHaveBeenCalledWith(USER_ID);
    expect(mockGenerar).not.toHaveBeenCalled();
  });
});

describe('generarContenido — plan', () => {
  it('devuelve el borrador enriquecido cuando la salida valida', async () => {
    mockGenerar.mockResolvedValue(respuesta(planValido()));

    const salida = await generarContenido(USER_ID, {
      tipo: 'PLAN',
      patient_id: PATIENT_ID,
      stream: false,
    });

    expect(salida.formato).toBe('estructurado');
    expect(salida.advertencias).toEqual([]);
    expect(mockGenerar).toHaveBeenCalledTimes(1);
    // El servidor recalculó los nutrimentos desde el catálogo real.
    expect(salida.datos).toMatchObject({ totales: { energia_kcal: 140 } });
  });

  it('registra los tokens de cada llamada', async () => {
    mockGenerar.mockResolvedValue(respuesta(planValido()));

    await generarContenido(USER_ID, { tipo: 'PLAN', patient_id: PATIENT_ID, stream: false });

    expect(mockRegistrar).toHaveBeenCalledWith(USER_ID, { entrada: 1_000, salida: 500 });
  });

  it('reintenta una vez cuando la salida no pasa la validación clínica', async () => {
    mockGenerar
      .mockResolvedValueOnce(respuesta(planValido({ calorias_diarias: 3_000 })))
      .mockResolvedValueOnce(respuesta(planValido()));

    const salida = await generarContenido(USER_ID, {
      tipo: 'PLAN',
      patient_id: PATIENT_ID,
      stream: false,
    });

    expect(mockGenerar).toHaveBeenCalledTimes(2);
    expect(salida.formato).toBe('estructurado');
  });

  it('le explica al modelo el motivo del rechazo en el reintento', async () => {
    mockGenerar
      .mockResolvedValueOnce(respuesta(planValido({ calorias_diarias: 3_000 })))
      .mockResolvedValueOnce(respuesta(planValido()));

    await generarContenido(USER_ID, { tipo: 'PLAN', patient_id: PATIENT_ID, stream: false });

    const segundoPrompt = mockGenerar.mock.calls[1]?.[0].prompt as string;
    expect(segundoPrompt).toContain('INTENTO ANTERIOR RECHAZADO');
    expect(segundoPrompt).toContain('3000 kcal');
  });

  it('degrada a texto editable tras agotar el reintento', async () => {
    mockGenerar.mockResolvedValue(respuesta(planValido({ calorias_diarias: 3_000 })));

    const salida = await generarContenido(USER_ID, {
      tipo: 'PLAN',
      patient_id: PATIENT_ID,
      stream: false,
    });

    expect(mockGenerar).toHaveBeenCalledTimes(2);
    expect(salida.formato).toBe('texto');
    expect(salida.datos).toBeNull();
    expect(salida.advertencias.join(' ')).toContain('kcal');
    // Aun degradada, sigue siendo una generación entregada: no se reembolsa.
    expect(mockDevolver).not.toHaveBeenCalled();
  });

  it('reintenta cuando la respuesta no es JSON válido', async () => {
    mockGenerar
      .mockResolvedValueOnce(respuesta('lo siento, no puedo'))
      .mockResolvedValueOnce(respuesta(planValido()));

    const salida = await generarContenido(USER_ID, {
      tipo: 'PLAN',
      patient_id: PATIENT_ID,
      stream: false,
    });

    expect(salida.formato).toBe('estructurado');
    expect(mockGenerar.mock.calls[1]?.[0].prompt).toContain('no fue JSON válido');
  });

  it('bloquea un borrador con un alérgeno declarado', async () => {
    const conAlergeno = planValido({
      comidas: [
        {
          nombre: 'Comida',
          horario: '14:00',
          descripcion: 'Ensalada con nuez',
          items: [{ food_id: null, descripcion: 'Ensalada', cantidad_porciones: 1 }],
        },
      ],
    });
    mockGenerar.mockResolvedValue(respuesta(conAlergeno));

    const salida = await generarContenido(USER_ID, {
      tipo: 'PLAN',
      patient_id: PATIENT_ID,
      stream: false,
    });

    expect(salida.formato).toBe('texto');
    expect(salida.advertencias.join(' ')).toContain('Nuez');
  });
});

describe('generarContenido — salidas de texto libre', () => {
  it('devuelve el texto tal cual sin intentar validarlo como JSON', async () => {
    mockGenerar.mockResolvedValue(respuesta('  Lunes: caminata de 30 minutos.  '));

    const salida = await generarContenido(USER_ID, {
      tipo: 'PLAN_ACTIVIDAD',
      patient_id: PATIENT_ID,
      stream: false,
    });

    expect(salida).toMatchObject({
      formato: 'texto',
      texto: 'Lunes: caminata de 30 minutos.',
      advertencias: [],
    });
    expect(mockGenerar).toHaveBeenCalledTimes(1);
  });

  it('no carga el catálogo de alimentos para una sugerencia de respuesta', async () => {
    mockGenerar.mockResolvedValue(respuesta('Claro, te espero el martes.'));

    await generarContenido(USER_ID, {
      tipo: 'RESPUESTA_MENSAJE',
      patient_id: PATIENT_ID,
      mensaje: '¿Puedo mover mi cita?',
      stream: false,
    });

    expect(mockCatalogo).not.toHaveBeenCalled();
  });
});

describe('generarContenido — streaming', () => {
  it('emite progreso en vez de texto crudo en las salidas estructuradas', async () => {
    mockGenerarConStream.mockImplementation(
      async (_opciones: unknown, alRecibir: (fragmento: string) => void) => {
        alRecibir('{"calorias');
        alRecibir('_diarias": 2000');
        return respuesta(planValido());
      },
    );
    const eventos: unknown[] = [];

    const salida = await generarContenido(
      USER_ID,
      { tipo: 'PLAN', patient_id: PATIENT_ID, stream: true },
      (evento) => eventos.push(evento),
    );

    expect(salida.formato).toBe('estructurado');
    expect(eventos).toEqual([
      { tipo: 'progreso', caracteres: 10 },
      { tipo: 'progreso', caracteres: 25 },
    ]);
  });

  it('emite los fragmentos de texto en las salidas libres', async () => {
    mockGenerarConStream.mockImplementation(
      async (_opciones: unknown, alRecibir: (fragmento: string) => void) => {
        alRecibir('Lunes: ');
        alRecibir('caminata.');
        return respuesta('Lunes: caminata.');
      },
    );
    const eventos: unknown[] = [];

    await generarContenido(
      USER_ID,
      { tipo: 'PLAN_ACTIVIDAD', patient_id: PATIENT_ID, stream: true },
      (evento) => eventos.push(evento),
    );

    expect(eventos).toEqual([
      { tipo: 'delta', texto: 'Lunes: ' },
      { tipo: 'delta', texto: 'caminata.' },
    ]);
  });

  it('avisa del reintento por el mismo canal', async () => {
    mockGenerarConStream
      .mockResolvedValueOnce(respuesta(planValido({ calorias_diarias: 3_000 })))
      .mockResolvedValueOnce(respuesta(planValido()));
    const eventos: Array<{ tipo: string }> = [];

    await generarContenido(
      USER_ID,
      { tipo: 'PLAN', patient_id: PATIENT_ID, stream: true },
      (evento) => eventos.push(evento),
    );

    expect(eventos.filter((evento) => evento.tipo === 'reintento')).toHaveLength(1);
  });
});
