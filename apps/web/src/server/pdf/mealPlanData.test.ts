/**
 * @jest-environment node
 */
import type { PlanParaPdf } from '@/server/plans/repository';

import { crearDatosPlanPdf, logoSeguro, nombreArchivoPlan } from './mealPlanData';

const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function planPrueba(): PlanParaPdf {
  return {
    id: 'plan-1',
    patientId: 'patient-1',
    estado: 'ACTIVO',
    caloriasDiarias: 1800,
    proteinaG: 120,
    carbosG: 200,
    grasaG: 58,
    nota: 'Fixture ficticio',
    origen: 'MANUAL',
    calculoSnapshot: null,
    compartidoAt: null,
    pdfUrl: null,
    createdAt: new Date('2026-07-23'),
    updatedAt: new Date('2026-07-23'),
    patient: {
      nombre: 'Paciente Ejemplo',
      nutritionist: {
        id: 'a1b2c3d4-0000-4000-8000-000000000001',
        name: 'Profesional Ejemplo',
        nutritionistProfile: {
          nombreCompleto: 'Lic. Profesional Ejemplo',
          cedulaProfesional: '00000000',
          especialidad: 'Nutrición clínica',
          marcaNombre: 'Consulta Ejemplo',
          marcaColor: '#0f766e',
          marcaLogoUrl: LOGO_PNG,
        },
      },
    },
    meals: [
      {
        id: 'meal-1',
        mealPlanId: 'plan-1',
        orden: 0,
        nombre: 'Desayuno',
        horario: '08:00',
        descripcion: null,
        items: [
          {
            id: 'item-1',
            mealId: 'meal-1',
            foodId: null,
            foodSnapshot: null,
            descripcionLibre: 'Preparación de prueba',
            cantidadPorciones: 1,
            energiaKcal: 250,
            proteinaG: 12,
            carbohidratosG: 30,
            lipidosG: 8,
            food: null,
          },
        ],
      },
    ],
  };
}

describe('crearDatosPlanPdf', () => {
  it('lleva marca, paciente, metas y snapshots de items al renderer', async () => {
    const data = await crearDatosPlanPdf(
      planPrueba(),
      new Date('2026-07-23T12:00:00Z'),
    );

    expect(data.marca).toMatchObject({
      nombre: 'Consulta Ejemplo',
      profesional: 'Lic. Profesional Ejemplo',
      cedulaProfesional: '00000000',
      color: '#0f766e',
    });
    expect(data.paciente.nombre).toBe('Paciente Ejemplo');
    expect(data.plan.caloriasDiarias).toBe(1800);
    expect(data.plan.comidas[0]?.items[0]).toMatchObject({
      nombre: 'Preparación de prueba',
      energiaKcal: 250,
    });
  });

  it('prioriza el snapshot histórico aunque el alimento vigente cambie o desaparezca', async () => {
    const plan = planPrueba();
    const item = plan.meals[0]!.items[0]!;
    const foodId = 'a1b2c3d4-0000-4000-8000-000000000001';
    item.foodId = foodId;
    item.foodSnapshot = {
      id: foodId,
      nombre: 'Avena histórica',
      grupo: 'cereales',
      porcion_descripcion: '1/2 taza histórica',
      porcion_gramos: 40,
      imagen_url: null,
    };
    item.food = {
      id: foodId,
      nombre: 'Nombre vigente modificado',
      grupoSmae: 'cereales',
      porcionDescripcion: '2 tazas vigentes',
      porcionGramos: 200,
      imagenUrl: null,
    };

    const conRelacion = (await crearDatosPlanPdf(plan)).plan.comidas[0]!.items[0]!;
    expect(conRelacion).toMatchObject({
      nombre: 'Avena histórica',
      porcion: '1/2 taza histórica (40 g)',
    });

    item.food = null;
    const sinRelacion = (await crearDatosPlanPdf(plan)).plan.comidas[0]!.items[0]!;
    expect(sinRelacion).toMatchObject({
      nombre: 'Avena histórica',
      porcion: '1/2 taza histórica (40 g)',
    });
  });

  it('resuelve el Blob por dueño antes de entregar el logo al renderer', async () => {
    const plan = planPrueba();
    const url =
      'https://nutria.public.blob.vercel-storage.com/brand-logos/' +
      'a1b2c3d4-0000-4000-8000-000000000001/' +
      'logo-a1b2c3d4e5f678901234abcd.png';
    plan.patient.nutritionist.nutritionistProfile!.marcaLogoUrl = url;
    const resolver = jest.fn(async () => LOGO_PNG);

    const data = await crearDatosPlanPdf(plan, new Date(), resolver);

    expect(resolver).toHaveBeenCalledWith(
      url,
      'a1b2c3d4-0000-4000-8000-000000000001',
    );
    expect(data.marca.logoUrl).toBe(LOGO_PNG);
  });

  it('solo acepta fuentes de logo compatibles y seguras', () => {
    expect(logoSeguro(LOGO_PNG)).toBe(LOGO_PNG);
    expect(
      logoSeguro('https://nutria.public.blob.vercel-storage.com/logo.png'),
    ).toBeNull();
    expect(logoSeguro('https://assets.example.test/logo.png')).toBeNull();
    expect(logoSeguro('http://127.0.0.1/logo.png')).toBeNull();
    expect(logoSeguro('file:///etc/passwd')).toBeNull();
    expect(logoSeguro('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(logoSeguro('data:image/webp;base64,UklGRg==')).toBeNull();
    expect(
      logoSeguro('https://nutria.public.blob.vercel-storage.com/logo.webp'),
    ).toBeNull();
  });

  it('rechaza SVG camuflado y PNG con dimensiones capaces de agotar memoria', () => {
    const svgCamuflado = `data:image/png;base64,${Buffer.from(
      '<svg><image href="http://169.254.169.254/latest/meta-data" /></svg>',
    ).toString('base64')}`;
    expect(logoSeguro(svgCamuflado)).toBeNull();

    const pngEnorme = Buffer.from(LOGO_PNG.split(',')[1]!, 'base64');
    pngEnorme.writeUInt32BE(100_000, 16);
    pngEnorme.writeUInt32BE(100_000, 20);
    expect(
      logoSeguro(`data:image/png;base64,${pngEnorme.toString('base64')}`),
    ).toBeNull();
  });

  it('produce un nombre de descarga ASCII y estable', () => {
    expect(nombreArchivoPlan('Ángela Núñez / prueba')).toBe(
      'plan-alimenticio-angela-nunez-prueba.pdf',
    );
  });
});
