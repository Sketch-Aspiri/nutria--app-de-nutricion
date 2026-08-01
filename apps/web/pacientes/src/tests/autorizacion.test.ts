/**
 * @jest-environment node
 */
import { jsonError, unauthenticated } from '@/server/http';

/**
 * Contrato de autorización de toda la API del paciente.
 *
 * Cada handler debe delegar en `requierePaciente` **antes** de tocar nada y
 * devolver su respuesta tal cual. La prueba recorre los endpoints uno por uno
 * porque el riesgo real es que a alguno se le olvide la guarda: un test por
 * endpoint escrito a mano se olvidaría con la misma facilidad.
 */

const mockRequierePaciente = jest.fn();

jest.mock('@/server/auth/guards', () => ({
  requierePaciente: () => mockRequierePaciente(),
}));

// La capa de datos se anula entera: si un handler la llamara pese al rechazo de
// la guarda, el mock lo delataría en lugar de fallar por falta de base.
const repositorio = {
  perfilDe: jest.fn(),
  resumenDeHoy: jest.fn(),
  planVigente: jest.fn(),
  recetasEnviadas: jest.fn(),
  planActividadCompartido: jest.fn(),
  registrarComida: jest.fn(),
  borrarComida: jest.fn(),
  listarPesos: jest.fn(),
  registrarPeso: jest.fn(),
  listarEjercicio: jest.fn(),
  registrarEjercicio: jest.fn(),
  guardarAgua: jest.fn(),
  resumenDeProgreso: jest.fn(),
  listarMensajes: jest.fn(),
  enviarMensaje: jest.fn(),
  marcarMensajesLeidos: jest.fn(),
  contarMensajesSinLeer: jest.fn(),
  proximasCitas: jest.fn(),
};

// Cuenta y derechos ARCO (fase 11). Entran a la misma lista negra: exportar o
// dar de baja pese al rechazo de la guarda sería el peor fallo posible aquí.
const cuenta = {
  exportarDatosDelPaciente: jest.fn(),
  registrarExportacionPropia: jest.fn(),
  cambiarPassword: jest.fn(),
  verificarPassword: jest.fn(),
  darDeBajaCuenta: jest.fn(),
};

// La IA cuenta como capa de datos para esta prueba: llamarla pese al rechazo de
// la guarda sacaría datos del expediente hacia el proveedor.
const ia = {
  responderCoach: jest.fn(),
  estimarComida: jest.fn(),
  sustituirIngrediente: jest.fn(),
};

jest.mock('@/server/me/repository', () => repositorio);
jest.mock('@/server/me/cuenta', () => ({
  ...cuenta,
  ExportacionDemasiadoGrandeError: class extends Error {},
}));
jest.mock('@/server/email', () => ({ avisarBajaDePacienteApp: jest.fn() }));
jest.mock('@/server/me/fotos', () => ({
  MAX_FOTO_BYTES: 5 * 1024 * 1024,
  subirFotoComida: jest.fn(),
}));
jest.mock('@/server/me/limites', () => ({
  limiteDeEscritura: jest.fn().mockResolvedValue({ permitido: true }),
  limiteDeFotos: jest.fn().mockResolvedValue({ permitido: true }),
  limiteDeIa: jest.fn().mockResolvedValue({ permitido: true }),
}));
jest.mock('@/server/ai/cliente', () => ({
  iaConfigurada: () => true,
  IaNoConfiguradaError: class extends Error {},
  IaUpstreamError: class extends Error {},
}));
jest.mock('@/server/ai/servicioPaciente', () => ({
  ...ia,
  CuotaClinicaAgotadaError: class extends Error {},
  CuotaPacienteAgotadaError: class extends Error {},
  PacienteSinExpedienteError: class extends Error {},
  RecetaNoEncontradaError: class extends Error {},
  SalidaIaInvalidaError: class extends Error {},
}));

type Invocacion = () => Promise<Response>;

function peticion(body: unknown = {}): Request {
  return new Request('http://localhost:3001/api/v1/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Cada entrada invoca un handler real con argumentos mínimos válidos. */
async function endpoints(): Promise<Array<[string, Invocacion]>> {
  const perfil = await import('@/app/api/v1/me/route');
  const hoy = await import('@/app/api/v1/me/today/route');
  const plan = await import('@/app/api/v1/me/meal_plan/route');
  const recetas = await import('@/app/api/v1/me/recipes/route');
  const actividad = await import('@/app/api/v1/me/activity_plan/route');
  const comidas = await import('@/app/api/v1/me/meal_logs/route');
  const comida = await import('@/app/api/v1/me/meal_logs/[id]/route');
  const pesos = await import('@/app/api/v1/me/weight_logs/route');
  const ejercicio = await import('@/app/api/v1/me/exercise_logs/route');
  const agua = await import('@/app/api/v1/me/water_logs/route');
  const progreso = await import('@/app/api/v1/me/progress/route');
  const mensajes = await import('@/app/api/v1/me/messages/route');
  const leidos = await import('@/app/api/v1/me/messages/read/route');
  const citas = await import('@/app/api/v1/me/appointments/route');
  const fotos = await import('@/app/api/v1/me/photos/route');
  const coach = await import('@/app/api/v1/me/ai/coach/route');
  const estimacion = await import('@/app/api/v1/me/ai/meal_estimate/route');
  const sustitucion = await import('@/app/api/v1/me/ai/substitution/route');
  const exportar = await import('@/app/api/v1/me/export/route');
  const password = await import('@/app/api/v1/me/password/route');
  const baja = await import('@/app/api/v1/me/account/route');

  const params = { params: Promise.resolve({ id: 'cualquiera' }) };
  const url = new Request('http://localhost:3001/api/v1/me');

  return [
    ['GET /me', () => perfil.GET()],
    ['GET /me/today', () => hoy.GET()],
    ['GET /me/meal_plan', () => plan.GET()],
    ['GET /me/recipes', () => recetas.GET()],
    ['GET /me/activity_plan', () => actividad.GET()],
    ['POST /me/meal_logs', () => comidas.POST(peticion({ nombre: 'Comida' }))],
    ['DELETE /me/meal_logs/{id}', () => comida.DELETE(url, params)],
    ['GET /me/weight_logs', () => pesos.GET(url)],
    ['POST /me/weight_logs', () => pesos.POST(peticion({ fecha: '2026-07-28', peso_kg: 70 }))],
    ['GET /me/exercise_logs', () => ejercicio.GET(url)],
    [
      'POST /me/exercise_logs',
      () => ejercicio.POST(peticion({ fecha: '2026-07-28', tipo: 'Caminata', duracion_min: 30 })),
    ],
    ['PUT /me/water_logs', () => agua.PUT(peticion({ fecha: '2026-07-28', vasos: 4 }))],
    ['GET /me/progress', () => progreso.GET()],
    ['GET /me/messages', () => mensajes.GET()],
    ['POST /me/messages', () => mensajes.POST(peticion({ texto: 'Hola' }))],
    ['POST /me/messages/read', () => leidos.POST()],
    ['GET /me/appointments', () => citas.GET()],
    ['POST /me/photos', () => fotos.POST(peticion())],
    ['POST /me/ai/coach', () => coach.POST(peticion({ mensaje: 'Hola' }))],
    ['POST /me/ai/meal_estimate', () => estimacion.POST(peticion({ texto: '2 tacos' }))],
    ['POST /me/ai/substitution', () => sustitucion.POST(peticion({ ingrediente: 'pollo' }))],
    ['GET /me/export', () => exportar.GET(url)],
    ['POST /me/password', () => password.POST(peticion({ actual: 'a', nueva: 'b' }))],
    [
      'DELETE /me/account',
      () => baja.DELETE(peticion({ password: 'x', confirmacion: true })),
    ],
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('guarda de sesión en /api/v1/me/*', () => {
  it('cubre los endpoints publicados de las fases 4, 5 y 11', async () => {
    // Si se agrega un endpoint y no se agrega aquí, este conteo lo delata.
    expect(await endpoints()).toHaveLength(24);
  });

  it('responde 401 en todos los endpoints cuando no hay sesión', async () => {
    mockRequierePaciente.mockResolvedValue({ ok: false, respuesta: unauthenticated() });

    for (const [nombre, invocar] of await endpoints()) {
      const respuesta = await invocar();
      expect(`${nombre}: ${respuesta.status}`).toBe(`${nombre}: 401`);
    }
  });

  it('responde 403 en todos los endpoints cuando el rol no es de paciente', async () => {
    mockRequierePaciente.mockResolvedValue({
      ok: false,
      respuesta: jsonError(403, 'FORBIDDEN', 'Tu cuenta no tiene acceso a la app del paciente.'),
    });

    for (const [nombre, invocar] of await endpoints()) {
      const respuesta = await invocar();
      expect(`${nombre}: ${respuesta.status}`).toBe(`${nombre}: 403`);
    }
  });

  it('no toca la capa de datos cuando la guarda rechaza', async () => {
    mockRequierePaciente.mockResolvedValue({ ok: false, respuesta: unauthenticated() });

    for (const [, invocar] of await endpoints()) await invocar();

    for (const [nombre, fn] of Object.entries({ ...repositorio, ...ia, ...cuenta })) {
      expect(`${nombre}: ${fn.mock.calls.length}`).toBe(`${nombre}: 0`);
    }
  });

  it('consulta la guarda una vez por petición', async () => {
    mockRequierePaciente.mockResolvedValue({ ok: false, respuesta: unauthenticated() });
    const lista = await endpoints();

    for (const [, invocar] of lista) await invocar();

    expect(mockRequierePaciente).toHaveBeenCalledTimes(lista.length);
  });
});
