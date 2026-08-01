/**
 * @jest-environment node
 */
import { obtenerPlan, obtenerPlanActividad, obtenerRecetas, sustituirIngrediente } from './api';

const fetchMock = jest.fn();

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeAll(() => {
  jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
});

beforeEach(() => {
  fetchMock.mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('API del plan', () => {
  it('acepta null como plan vigente sin tratarlo como error', async () => {
    fetchMock.mockResolvedValue(respuestaJson(null));

    await expect(obtenerPlan()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me/meal_plan', undefined);
  });

  it('desenvuelve el `data` del listado de recetas', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({ data: [{ id: 'receta-1' }], meta: { page: 1, per_page: 1, total: 1 } }),
    );

    await expect(obtenerRecetas()).resolves.toMatchObject([{ id: 'receta-1' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me/recipes', undefined);
  });

  it('devuelve lista vacía si el envoltorio llega sin `data`', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ meta: { total: 0 } }));

    await expect(obtenerRecetas()).resolves.toEqual([]);
  });

  it('pide el plan de actividad en su propio endpoint', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ id: 'actividad-1', texto: 'Camina 30 min' }));

    await expect(obtenerPlanActividad()).resolves.toMatchObject({ texto: 'Camina 30 min' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me/activity_plan', undefined);
  });

  it('manda solo el ingrediente y la receta, nunca el prompt ni el patient_id', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({ datos: { sustituto: 'Tahini', razon: 'Similar' } }),
    );

    await sustituirIngrediente({
      ingrediente: 'crema de cacahuate',
      receta_id: '11111111-1111-4111-8111-111111111111',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/me/ai/substitution');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      ingrediente: 'crema de cacahuate',
      receta_id: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('propaga el mensaje seguro cuando el paciente agota su cuota de IA', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson(
        { error: { code: 'AI_QUOTA_EXCEEDED', message: 'Ya usaste tus consultas del mes.' } },
        429,
      ),
    );

    await expect(sustituirIngrediente({ ingrediente: 'avena' })).rejects.toMatchObject({
      code: 'AI_QUOTA_EXCEEDED',
      status: 429,
      message: 'Ya usaste tus consultas del mes.',
    });
  });
});
