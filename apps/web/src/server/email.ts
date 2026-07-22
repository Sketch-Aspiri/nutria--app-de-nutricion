import { Resend } from 'resend';

import { esDesarrollo, logger } from './logger';

const FROM_DEFAULT = 'nutria <no-reply@resend.dev>';

function baseUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

export type ResultadoEnvio =
  | { enviado: true }
  | { enviado: false; motivo: 'sin_configurar' | 'error_proveedor'; enlaceDev?: string };

async function enviar(para: string, asunto: string, html: string): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { enviado: false, motivo: 'sin_configurar' };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? FROM_DEFAULT,
      to: para,
      subject: asunto,
      html,
    });
    if (error) {
      logger.error('Resend rechazó el envío', error.message);
      return { enviado: false, motivo: 'error_proveedor' };
    }
    return { enviado: true };
  } catch (error: unknown) {
    logger.error('No se pudo contactar al proveedor de correo', error);
    return { enviado: false, motivo: 'error_proveedor' };
  }
}

function plantilla(titulo: string, cuerpo: string, cta: { texto: string; url: string }): string {
  return `<!doctype html><html lang="es"><body style="font-family:system-ui,sans-serif;background:#fafaf9;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <div style="font-size:24px;color:#064e3b;font-weight:600">nutria</div>
    <h1 style="font-size:18px;color:#1c1917;margin:24px 0 8px">${titulo}</h1>
    <p style="color:#57534e;font-size:14px;line-height:1.6">${cuerpo}</p>
    <a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#065f46;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px">${cta.texto}</a>
    <p style="color:#a8a29e;font-size:12px;margin-top:24px">Si no solicitaste este correo, puedes ignorarlo.</p>
  </div></body></html>`;
}

/**
 * Sin RESEND_API_KEY el registro no se rompe: en desarrollo se devuelve el
 * enlace para copiarlo desde la consola del servidor.
 */
export async function enviarVerificacionEmail(
  para: string,
  token: string,
): Promise<ResultadoEnvio> {
  const url = `${baseUrl()}/verificar?token=${encodeURIComponent(token)}`;
  const resultado = await enviar(
    para,
    'Confirma tu correo en nutria',
    plantilla(
      'Confirma tu correo',
      'Para activar tu cuenta de nutriólogo y empezar a registrar pacientes, confirma tu dirección de correo. El enlace vence en 24 horas.',
      { texto: 'Confirmar mi correo', url },
    ),
  );

  if (!resultado.enviado && esDesarrollo()) {
    logger.warn('Correo no enviado (RESEND_API_KEY sin configurar). Enlace de verificación:', {
      url,
    });
    return { ...resultado, enlaceDev: url };
  }
  return resultado;
}
