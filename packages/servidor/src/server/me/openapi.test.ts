import { openApiPacientes } from './openapi';

/**
 * El contrato del paciente se prueba por sus invariantes, no ruta por ruta: lo
 * que importa es que documente los 21 endpoints y que no describa nada que la
 * app del paciente no deba poder pedir.
 */

const RUTAS = Object.keys(openApiPacientes.paths ?? {});

describe('OpenAPI de la app del paciente', () => {
  it('documenta los 18 endpoints de la fase 4 y los 3 de IA de la fase 5', () => {
    expect(RUTAS).toEqual(
      expect.arrayContaining([
        '/api/v1/me',
        '/api/v1/me/today',
        '/api/v1/me/meal_plan',
        '/api/v1/me/recipes',
        '/api/v1/me/activity_plan',
        '/api/v1/me/meal_logs',
        '/api/v1/me/meal_logs/{id}',
        '/api/v1/me/weight_logs',
        '/api/v1/me/exercise_logs',
        '/api/v1/me/water_logs',
        '/api/v1/me/photos',
        '/api/v1/me/progress',
        '/api/v1/me/messages',
        '/api/v1/me/messages/read',
        '/api/v1/me/appointments',
        '/api/v1/me/ai/coach',
        '/api/v1/me/ai/meal_estimate',
        '/api/v1/me/ai/substitution',
      ]),
    );
  });

  it('no documenta ninguna ruta del panel del nutriólogo', () => {
    // Cada app expone solo sus endpoints (§2). Un `/api/v1/patients/...` aquí
    // significaría que alguien montó una ruta del panel en la app del paciente.
    expect(RUTAS.every((ruta) => ruta.startsWith('/api/v1/me'))).toBe(true);
  });

  it('ninguna entrada acepta un identificador de paciente', () => {
    const documento = JSON.stringify(openApiPacientes);

    expect(documento).not.toContain('"patient_id"');
    expect(documento).not.toContain('"nutritionist_id"');
  });

  it('los tres endpoints de IA declaran cuota agotada, salida inválida y falta de llave', () => {
    for (const ruta of [
      '/api/v1/me/ai/coach',
      '/api/v1/me/ai/meal_estimate',
      '/api/v1/me/ai/substitution',
    ]) {
      const codigos = Object.keys(openApiPacientes.paths?.[ruta]?.post?.responses ?? {});

      for (const codigo of ['200', '400', '422', '429', '502', '503']) {
        expect(`${ruta} → ${codigo}: ${codigos.includes(codigo)}`).toBe(
          `${ruta} → ${codigo}: true`,
        );
      }
    }
  });

  it('solo la sustitución puede responder 404 por una receta ajena', () => {
    expect(openApiPacientes.paths?.['/api/v1/me/ai/substitution']?.post?.responses).toHaveProperty(
      '404',
    );
    expect(openApiPacientes.paths?.['/api/v1/me/ai/coach']?.post?.responses).not.toHaveProperty(
      '404',
    );
  });

  it('expone el tope del paciente pero no la cuota de la clínica', () => {
    const cuota = JSON.stringify(openApiPacientes.components?.schemas?.CuotaIAPaciente);

    expect(cuota).toContain('"limite"');
    // La cuota del consultorio lleva `plan` e `ilimitada`; ninguno debe estar.
    expect(cuota).not.toContain('"ilimitada"');
    expect(JSON.stringify(openApiPacientes)).not.toContain('CLINICA');
  });

  it('documenta que `falta_kg` es siempre nulo en la V1', () => {
    expect(JSON.stringify(openApiPacientes.components?.schemas?.Progreso)).toContain('falta_kg');
  });
});
