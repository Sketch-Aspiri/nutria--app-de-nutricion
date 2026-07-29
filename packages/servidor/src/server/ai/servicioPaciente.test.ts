/**
 * @jest-environment node
 */
import { AVISO_IA_PACIENTE, CONFIGURACION_PACIENTE } from './config';
import {
  CuotaClinicaAgotadaError,
  CuotaPacienteAgotadaError,
  PacienteSinExpedienteError,
  RecetaNoEncontradaError,
  SalidaIaInvalidaError,
  estimarComida,
  responderCoach,
  sustituirIngrediente,
} from './servicioPaciente';

const mockGenerar = jest.fn();
const mockCargarContexto = jest.fn();
const mockReceta = jest.fn();
const mockNutriologo = jest.fn();
const mockReservar = jest.fn();
const mockDevolverCompleta = jest.fn();
const mockRegistrarTokens = jest.fn();

jest.mock('./cliente', () => ({
  generar: (...args: unknown[]) => mockGenerar(...args),
}));

jest.mock('./contextoPaciente', () => ({
  cargarContextoCoach: (...args: unknown[]) => mockCargarContexto(...args),
  recetaEnviadaDelPaciente: (...args: unknown[]) => mockReceta(...args),
  // El filtro real ya se prueba en contextoPaciente.test.ts; aquí interesa que
  // el servicio lo aplique, así que se marca el texto de forma reconocible.
  limpiarTextoDelPaciente: (texto: string) => texto.replace(/Ana/gi, '[PACIENTE]'),
}));

jest.mock('./uso', () => ({
  registrarTokens: (...args: unknown[]) => mockRegistrarTokens(...args),
}));

jest.mock('./usoPaciente', () => ({
  nutriologoDelPaciente: (...args: unknown[]) => mockNutriologo(...args),
  reservarInteraccion: (...args: unknown[]) => mockReservar(...args),
  devolverInteraccionCompleta: (...args: unknown[]) => mockDevolverCompleta(...args),
}));

const PACIENTE_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const USER_ID = 'a1b2c3d4-0000-4000-8000-000000000002';
const NUTRIOLOGO_ID = 'a1b2c3d4-0000-4000-8000-000000000003';
const RECETA_ID = 'a1b2c3d4-0000-4000-8000-000000000004';

const CONTEXTO = {
  patientId: PACIENTE_ID,
  objetivo: 'Pérdida de grasa',
  metas: { calorias: 1800, proteinaG: 120, carbosG: 180, grasaG: 60 },
  alergias: ['Cacahuate'],
  tipoDieta: null,
  disgustos: null,
  comidasPorDia: 3,
  identificadores: { nombre: 'Ana', email: null, telefono: null },
};

const CUOTA_PACIENTE = { limite: 30, usadas: 3, restantes: 27, agotada: false };
const CUOTA_CLINICA = {
  plan: 'PRO' as const,
  limite: 150,
  usadas: 10,
  restantes: 140,
  agotada: false,
  ilimitada: false,
};

const ESTIMACION = {
  alimento: '2 tacos de pollo',
  calorias: 420,
  proteina_g: 28,
  carbos_g: 40,
  grasa_g: 15,
};

function respuesta(texto: string) {
  return { texto, uso: { entrada: 100, salida: 50 } };
}

/** Prompt y sistema que recibió el modelo en la última llamada. */
function llamada() {
  return mockGenerar.mock.calls[0][0] as {
    modelo: string;
    maxTokens: number;
    sistema: string;
    prompt: string;
    jsonSchema?: unknown;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCargarContexto.mockResolvedValue(CONTEXTO);
  mockNutriologo.mockResolvedValue(NUTRIOLOGO_ID);
  mockReservar.mockResolvedValue({
    ok: true,
    cuotas: { paciente: CUOTA_PACIENTE, clinica: CUOTA_CLINICA },
  });
  mockDevolverCompleta.mockResolvedValue(undefined);
  mockRegistrarTokens.mockResolvedValue(undefined);
});

describe('responderCoach', () => {
  it('devuelve el texto del modelo con el aviso y la cuota del paciente', async () => {
    mockGenerar.mockResolvedValue(respuesta('  Toma agua entre comidas.  '));

    await expect(responderCoach(PACIENTE_ID, USER_ID, { mensaje: '¿Y el agua?' })).resolves.toEqual(
      {
        tipo: 'COACH_PACIENTE',
        formato: 'texto',
        texto: 'Toma agua entre comidas.',
        aviso: AVISO_IA_PACIENTE,
        cuota: CUOTA_PACIENTE,
      },
    );
  });

  it('no expone la cuota de la clínica al paciente', async () => {
    mockGenerar.mockResolvedValue(respuesta('Listo.'));

    const salida = await responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' });

    expect(JSON.stringify(salida)).not.toContain('PRO');
  });

  it('usa Haiku con el presupuesto corto de §8 y sin schema JSON', async () => {
    mockGenerar.mockResolvedValue(respuesta('Listo.'));

    await responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' });

    expect(llamada()).toMatchObject({
      modelo: CONFIGURACION_PACIENTE.COACH_PACIENTE.modelo,
      maxTokens: 400,
    });
    expect(llamada().jsonSchema).toBeUndefined();
  });

  it('seudonimiza el mensaje y el historial antes de mandarlos', async () => {
    mockGenerar.mockResolvedValue(respuesta('Listo.'));

    await responderCoach(PACIENTE_ID, USER_ID, {
      mensaje: 'Soy Ana y tengo hambre',
      historial: [{ rol: 'paciente', texto: 'Ana otra vez' }],
    });

    expect(llamada().prompt).not.toMatch(/Ana/);
    expect(llamada().prompt).toContain('[PACIENTE]');
  });

  it('incluye la conversación previa solo cuando la hay', async () => {
    mockGenerar.mockResolvedValue(respuesta('Listo.'));

    await responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' });

    expect(llamada().prompt).not.toContain('CONVERSACIÓN PREVIA');
  });

  it('prohíbe en el sistema cambiar el plan y dar indicaciones médicas', async () => {
    mockGenerar.mockResolvedValue(respuesta('Listo.'));

    await responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' });

    expect(llamada().sistema).toMatch(/NUNCA cambies su plan/);
    expect(llamada().sistema).toMatch(/diagnósticos/);
  });

  it('rechaza una respuesta vacía en vez de mostrarla', async () => {
    mockGenerar.mockResolvedValue(respuesta('   '));

    await expect(responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' })).rejects.toBeInstanceOf(
      SalidaIaInvalidaError,
    );
  });
});

describe('cuotas y expediente', () => {
  it('rechaza cuando el paciente agotó su tope mensual', async () => {
    mockReservar.mockResolvedValue({
      ok: false,
      motivo: 'paciente',
      cuota: { ...CUOTA_PACIENTE, restantes: 0, agotada: true },
    });

    await expect(responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' })).rejects.toBeInstanceOf(
      CuotaPacienteAgotadaError,
    );
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('rechaza cuando la clínica agotó la suya', async () => {
    mockReservar.mockResolvedValue({ ok: false, motivo: 'clinica', cuota: CUOTA_CLINICA });

    await expect(responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' })).rejects.toBeInstanceOf(
      CuotaClinicaAgotadaError,
    );
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('falla sin llamar al modelo si el expediente ya no existe', async () => {
    mockCargarContexto.mockResolvedValue(null);

    await expect(responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' })).rejects.toBeInstanceOf(
      PacienteSinExpedienteError,
    );
    expect(mockReservar).not.toHaveBeenCalled();
  });

  it('cobra los tokens contra el nutriólogo, no contra el paciente', async () => {
    mockGenerar.mockResolvedValue(respuesta('Listo.'));

    await responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' });

    expect(mockRegistrarTokens).toHaveBeenCalledWith(NUTRIOLOGO_ID, {
      entrada: 100,
      salida: 50,
    });
  });

  it('reembolsa las dos reservas si el proveedor falla', async () => {
    mockGenerar.mockRejectedValue(new Error('502'));

    await expect(responderCoach(PACIENTE_ID, USER_ID, { mensaje: 'Hola' })).rejects.toThrow();
    expect(mockDevolverCompleta).toHaveBeenCalledWith(USER_ID, NUTRIOLOGO_ID);
  });
});

describe('estimarComida', () => {
  it('devuelve los macros estimados sin guardar nada', async () => {
    mockGenerar.mockResolvedValue(respuesta(JSON.stringify(ESTIMACION)));

    const salida = await estimarComida(PACIENTE_ID, USER_ID, { texto: '2 tacos de pollo' });

    expect(salida).toEqual({
      tipo: 'ESTIMACION_COMIDA',
      formato: 'estructurado',
      datos: ESTIMACION,
      aviso: AVISO_IA_PACIENTE,
      cuota: CUOTA_PACIENTE,
    });
  });

  it('pide la salida con schema JSON', async () => {
    mockGenerar.mockResolvedValue(respuesta(JSON.stringify(ESTIMACION)));

    await estimarComida(PACIENTE_ID, USER_ID, { texto: 'tacos' });

    expect(llamada().jsonSchema).toMatchObject({ required: expect.arrayContaining(['calorias']) });
  });

  it('rechaza una salida que no es JSON', async () => {
    mockGenerar.mockResolvedValue(respuesta('lo siento, no sé'));

    await expect(
      estimarComida(PACIENTE_ID, USER_ID, { texto: 'tacos' }),
    ).rejects.toBeInstanceOf(SalidaIaInvalidaError);
  });

  it('rechaza cifras fuera de los topes que acepta el diario', async () => {
    mockGenerar.mockResolvedValue(
      respuesta(JSON.stringify({ ...ESTIMACION, calorias: 99_000 })),
    );

    await expect(
      estimarComida(PACIENTE_ID, USER_ID, { texto: 'tacos' }),
    ).rejects.toBeInstanceOf(SalidaIaInvalidaError);
  });
});

describe('sustituirIngrediente', () => {
  const SUSTITUTO = { sustituto: '1 taza de frijol', razon: 'Aporta proteína parecida.' };

  it('propone el sustituto con su razón', async () => {
    mockGenerar.mockResolvedValue(respuesta(JSON.stringify(SUSTITUTO)));

    await expect(
      sustituirIngrediente(PACIENTE_ID, USER_ID, { ingrediente: 'pollo' }),
    ).resolves.toMatchObject({ tipo: 'SUSTITUCION_INGREDIENTE', datos: SUSTITUTO });
  });

  it('usa la receta como contexto cuando el paciente la indica', async () => {
    mockReceta.mockResolvedValue({ nombre: 'Ensalada', ingredientes: ['pollo', 'lechuga'] });
    mockGenerar.mockResolvedValue(respuesta(JSON.stringify(SUSTITUTO)));

    await sustituirIngrediente(PACIENTE_ID, USER_ID, {
      ingrediente: 'pollo',
      receta_id: RECETA_ID,
    });

    expect(mockReceta).toHaveBeenCalledWith(PACIENTE_ID, RECETA_ID);
    expect(llamada().prompt).toContain('Ensalada');
  });

  it('falla si la receta no es del paciente o no le fue enviada', async () => {
    mockReceta.mockResolvedValue(null);

    await expect(
      sustituirIngrediente(PACIENTE_ID, USER_ID, { ingrediente: 'pollo', receta_id: RECETA_ID }),
    ).rejects.toBeInstanceOf(RecetaNoEncontradaError);
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('rechaza un sustituto que menciona un alérgeno declarado', async () => {
    mockGenerar.mockResolvedValue(
      respuesta(
        JSON.stringify({ sustituto: 'crema de cacahuate', razon: 'Es alta en proteína.' }),
      ),
    );

    await expect(
      sustituirIngrediente(PACIENTE_ID, USER_ID, { ingrediente: 'pollo' }),
    ).rejects.toMatchObject({
      name: 'SalidaIaInvalidaError',
      motivo: expect.stringMatching(/alergias/i),
    });
  });

  it('avisa de las alergias en el prompt, además de validar la salida', async () => {
    mockGenerar.mockResolvedValue(respuesta(JSON.stringify(SUSTITUTO)));

    await sustituirIngrediente(PACIENTE_ID, USER_ID, { ingrediente: 'pollo' });

    expect(llamada().prompt).toContain('Cacahuate');
    expect(llamada().sistema).toMatch(/alergias/i);
  });
});
