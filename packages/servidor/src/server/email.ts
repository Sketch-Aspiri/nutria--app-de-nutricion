import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Resend } from 'resend';

import { INVITACION_VALIDA_DIAS } from './auth/tokens';
import { esDesarrollo, logger } from './logger';

const FROM_DEFAULT = 'nutria <no-reply@resend.dev>';

function baseUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

/**
 * Dominio de la app del paciente (`mi.nutria.mx`), distinto del panel.
 * En local corre en el puerto 3001, según §3.3 del plan de la app del paciente.
 */
function basePacientes(): string {
  return process.env.PACIENTES_URL ?? 'http://localhost:3001';
}

export type ResultadoEnvio =
  | { enviado: true }
  | { enviado: false; motivo: 'sin_configurar' | 'error_proveedor'; enlaceDev?: string };

/**
 * Buzón de pruebas de los E2E.
 *
 * Con `EMAIL_OUTBOX_FILE` definida, el correo se anexa a ese archivo como una
 * línea JSON en lugar de salir hacia Resend, y Playwright puede afirmar sobre
 * lo que recibiría el paciente (flujo E2E #6). La variable solo la define
 * `playwright.config.ts`: en Vercel no existe, así que producción nunca toma
 * esta rama. Se prefiere una variable explícita a un `NODE_ENV !== production`
 * porque en CI los E2E corren precisamente contra el build de producción.
 */
async function anexarAlBuzonDePruebas(
  ruta: string,
  correo: { para: string; asunto: string; html: string },
): Promise<ResultadoEnvio> {
  try {
    await mkdir(path.dirname(ruta), { recursive: true });
    await appendFile(ruta, `${JSON.stringify({ ...correo, at: new Date().toISOString() })}\n`);
    return { enviado: true };
  } catch (error: unknown) {
    logger.error('No se pudo escribir el buzón de pruebas de correo', error);
    return { enviado: false, motivo: 'error_proveedor' };
  }
}

async function enviar(para: string, asunto: string, html: string): Promise<ResultadoEnvio> {
  const buzonDePruebas = process.env.EMAIL_OUTBOX_FILE;
  if (buzonDePruebas) {
    return anexarAlBuzonDePruebas(buzonDePruebas, { para, asunto, html });
  }

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

/**
 * Escapa el texto que se interpola en el HTML del correo.
 *
 * El nombre del consultorio y las notas los escribe el nutriólogo: sin escapar,
 * un `<` suelto rompe la maquetación y una etiqueta deliberada convertiría el
 * correo en un vector de inyección hacia el paciente.
 */
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plantilla(
  titulo: string,
  cuerpo: string,
  cta?: { texto: string; url: string },
  pie = 'Si no solicitaste este correo, puedes ignorarlo.',
): string {
  const boton = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#065f46;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px">${cta.texto}</a>`
    : '';
  return `<!doctype html><html lang="es"><body style="font-family:system-ui,sans-serif;background:#fafaf9;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <div style="font-size:24px;color:#064e3b;font-weight:600">nutria</div>
    <h1 style="font-size:18px;color:#1c1917;margin:24px 0 8px">${titulo}</h1>
    <p style="color:#57534e;font-size:14px;line-height:1.6">${cuerpo}</p>
    ${boton}
    <p style="color:#a8a29e;font-size:12px;margin-top:24px">${pie}</p>
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

export type InvitacionPaciente = {
  para: string;
  pacienteNombre: string;
  /** Nombre del consultorio o del profesional que invita. */
  consultorio: string;
  token: string;
};

/**
 * Invitación a la app del paciente.
 *
 * Como el resto del correo dirigido al paciente, no lleva un solo dato clínico:
 * un buzón compartido o reenviado no debe revelar peso, objetivo ni plan. El
 * enlace apunta a la app del paciente, no al panel.
 */
export async function enviarInvitacionPaciente(
  invitacion: InvitacionPaciente,
): Promise<ResultadoEnvio> {
  const url = `${basePacientes()}/activar?token=${encodeURIComponent(invitacion.token)}`;
  const consultorio = escaparHtml(invitacion.consultorio);
  const resultado = await enviar(
    invitacion.para,
    'Tu acceso a la app de nutria',
    plantilla(
      `Hola, ${escaparHtml(invitacion.pacienteNombre)}`,
      `<strong>${consultorio}</strong> te invita a usar la app de nutria para seguir tu plan, registrar tus comidas y escribirle desde tu teléfono. Crea tu contraseña para entrar; el enlace vence en ${INVITACION_VALIDA_DIAS} días.`,
      { texto: 'Crear mi contraseña', url },
      'Si no reconoces esta invitación, ignora este correo: la cuenta no se crea hasta que abras el enlace.',
    ),
  );

  if (!resultado.enviado && esDesarrollo()) {
    logger.warn('Correo no enviado (RESEND_API_KEY sin configurar). Enlace de activación:', {
      url,
    });
    return { ...resultado, enlaceDev: url };
  }
  return resultado;
}

export type RecordatorioCita = {
  para: string;
  pacienteNombre: string;
  /** Fecha y hora ya formateadas en la zona del consultorio. */
  cuando: string;
  tipo: 'PRESENCIAL' | 'VIDEOLLAMADA';
  consultorio: string;
  videoUrl: string | null;
};

/**
 * Recordatorio de cita al paciente.
 *
 * El correo no lleva ningún dato clínico: nombre, cuándo y cómo. Un buzón
 * ajeno o reenviado no debe revelar peso, diagnóstico ni plan.
 */
export async function enviarRecordatorioCita(
  cita: RecordatorioCita,
): Promise<ResultadoEnvio> {
  const consultorio = escaparHtml(cita.consultorio);
  const modalidad =
    cita.tipo === 'VIDEOLLAMADA'
      ? 'Es una consulta por videollamada.'
      : 'Es una consulta presencial.';

  return enviar(
    cita.para,
    `Recordatorio: tu consulta ${cita.cuando}`,
    plantilla(
      `Hola, ${escaparHtml(cita.pacienteNombre)}`,
      `Te recordamos tu consulta con <strong>${consultorio}</strong> ${escaparHtml(
        cita.cuando,
      )}. ${modalidad}`,
      cita.tipo === 'VIDEOLLAMADA' && cita.videoUrl
        ? { texto: 'Entrar a la videollamada', url: cita.videoUrl }
        : undefined,
      `Si necesitas reprogramar, responde a ${consultorio}.`,
    ),
  );
}

/**
 * Copia electrónica del aviso simplificado al dar de alta un expediente.
 *
 * El mensaje no enumera condiciones, mediciones ni motivo de consulta. Solo
 * informa que existe un tratamiento de datos y dónde ejercer derechos ARCO.
 */
export function enviarAvisoPrivacidadPaciente(
  para: string,
  pacienteNombre: string,
): Promise<ResultadoEnvio> {
  const url = `${baseUrl()}/privacidad#pacientes`;
  return enviar(
    para,
    'Aviso de privacidad de nutria',
    plantilla(
      `Hola, ${escaparHtml(pacienteNombre)}`,
      'Tu profesional de nutrición registró un expediente en nutria. El sistema protege datos personales y de salud para prestar y dar seguimiento a la consulta nutricional. Consulta las finalidades, transferencias y medios para ejercer tus derechos ARCO en el aviso integral.',
      { texto: 'Consultar aviso de privacidad', url },
      'Este correo no contiene información clínica. Si no reconoces el alta, usa el contacto indicado en el aviso.',
    ),
  );
}
