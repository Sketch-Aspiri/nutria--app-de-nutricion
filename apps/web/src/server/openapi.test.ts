import { openApiDocument } from './openapi';

describe('OpenAPI de la fase 4', () => {
  it('documenta todos los endpoints de planes, PDF y plantillas', () => {
    expect(Object.keys(openApiDocument.paths ?? {})).toEqual(
      expect.arrayContaining([
        '/api/v1/me',
        '/api/v1/patients/{patientId}/meal_plans',
        '/api/v1/meal_plans/{id}',
        '/api/v1/meal_plans/{id}/activate',
        '/api/v1/meal_plans/{id}/share',
        '/api/v1/meal_plans/{id}/duplicate',
        '/api/v1/meal_plans/{id}/pdf',
        '/api/v1/meal_plans/{id}/export_pdf',
        '/api/v1/plan_templates',
        '/api/v1/plan_templates/{id}',
      ]),
    );
  });

  it('refleja locking optimista y errores de capacidad del PDF', () => {
    const actualizar = openApiDocument.paths?.['/api/v1/meal_plans/{id}']?.patch;
    const pdf = openApiDocument.paths?.['/api/v1/meal_plans/{id}/pdf']?.get;

    expect(actualizar?.responses).toHaveProperty('409');
    expect(pdf?.responses).toHaveProperty('429');
    expect(pdf?.responses).toHaveProperty('503');
  });

  it('publica la estructura reutilizable de las plantillas', () => {
    const plantilla = openApiDocument.components?.schemas?.PlanTemplate;

    expect(JSON.stringify(plantilla)).toContain('"estructura"');
    expect(JSON.stringify(plantilla)).toContain('"comidas"');
  });
});
