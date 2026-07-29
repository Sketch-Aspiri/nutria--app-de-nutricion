/**
 * @jest-environment node
 */
import { IaNoConfiguradaError, IaUpstreamError } from '@/server/ai/cliente';
import {
  CuotaClinicaAgotadaError,
  CuotaPacienteAgotadaError,
  PacienteSinExpedienteError,
  RecetaNoEncontradaError,
  SalidaIaInvalidaError,
} from '@/server/ai/servicioPaciente';

import { errorDeIaPaciente } from './iaHttp';

jest.mock('@/server/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const CUOTA_PACIENTE = { limite: 30, usadas: 30, restantes: 0, agotada: true };
const CUOTA_CLINICA = {
  plan: 'PRO' as const,
  limite: 150,
  usadas: 150,
  restantes: 0,
  agotada: true,
  ilimitada: false,
};

async function cuerpo(respuesta: Response) {
  return (await respuesta.json()) as { error: { code: string; message: string } };
}

describe('errorDeIaPaciente', () => {
  it('traduce el tope del paciente a 429 con su límite', async () => {
    const respuesta = errorDeIaPaciente(new CuotaPacienteAgotadaError(CUOTA_PACIENTE));

    expect(respuesta.status).toBe(429);
    const { error } = await cuerpo(respuesta);
    expect(error.code).toBe('AI_LIMIT_REACHED');
    expect(error.message).toContain('30');
  });

  it('no le revela al paciente el plan ni la cuota de su nutrióloga', async () => {
    const respuesta = errorDeIaPaciente(new CuotaClinicaAgotadaError(CUOTA_CLINICA));

    expect(respuesta.status).toBe(429);
    const { error } = await cuerpo(respuesta);
    expect(error.message).not.toMatch(/PRO|150|plan/i);
  });

  it('traduce una receta ajena a 404', () => {
    expect(errorDeIaPaciente(new RecetaNoEncontradaError()).status).toBe(404);
  });

  it('traduce un expediente inexistente a 404', () => {
    expect(errorDeIaPaciente(new PacienteSinExpedienteError()).status).toBe(404);
  });

  it('traduce una salida inválida a 422 con el motivo que ve el paciente', async () => {
    const respuesta = errorDeIaPaciente(new SalidaIaInvalidaError('No pude estimarlo.'));

    expect(respuesta.status).toBe(422);
    const { error } = await cuerpo(respuesta);
    expect(error.code).toBe('AI_INVALID_OUTPUT');
    expect(error.message).toBe('No pude estimarlo.');
  });

  it('traduce la falta de llave a 503 y el fallo del proveedor a 502', () => {
    expect(errorDeIaPaciente(new IaNoConfiguradaError()).status).toBe(503);
    expect(errorDeIaPaciente(new IaUpstreamError(429)).status).toBe(502);
  });

  it('cae en 500 genérico ante cualquier otro error', async () => {
    const respuesta = errorDeIaPaciente(new Error('algo raro'));

    expect(respuesta.status).toBe(500);
    const { error } = await cuerpo(respuesta);
    // El mensaje del error interno no se le enseña a nadie.
    expect(error.message).not.toContain('algo raro');
  });
});
