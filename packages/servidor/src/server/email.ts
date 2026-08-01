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

type ConfigSmtp = {
  host: string;
  port: number;
  /** Buzón que autentica y que aparece como remitente real del mensaje. */
  user: string;
  pass: string;
};

/**
 * Configuración SMTP de un buzón propio (Gmail, Outlook, el correo del dominio).
 *
 * Es la salida para la fase de prueba con pocos nutriólogos: Resend y cualquier
 * otro proveedor transaccional exigen un dominio verificado para escribirle a
 * terceros, mientras que un buzón personal ya está autenticado ante su propio
 * proveedor. A cambio hay un tope diario bajo (500 mensajes en Gmail gratuito),
 * así que al abrir el registro conviene volver a Resend con dominio propio.
 */
function configSmtp(): ConfigSmtp | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  return { host, port: Number.isFinite(port) ? port : 465, user, pass };
}

/**
 * El transporte se reutiliza entre envíos para no renegociar TLS en cada correo;
 * `nodemailer` se carga bajo demanda para no arrastrarlo al bundle de quien
 * despliegue con Resend.
 */
let transporteSmtp: { sendMail: (correo: Record<string, string>) => Promise<unknown> } | null = null;

async function enviarPorSmtp(
  config: ConfigSmtp,
  correo: { para: string; asunto: string } & Correo,
): Promise<ResultadoEnvio> {
  try {
    if (!transporteSmtp) {
      const { createTransport } = await import('nodemailer');
      transporteSmtp = createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      });
    }

    await transporteSmtp.sendMail({
      // Gmail reescribe el remitente si no coincide con la cuenta autenticada:
      // por eso el usuario SMTP es el respaldo, no una dirección inventada.
      from: process.env.EMAIL_FROM ?? `nutria <${config.user}>`,
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    });
    return { enviado: true };
  } catch (error: unknown) {
    logger.error('El servidor SMTP rechazó el envío', error);
    return { enviado: false, motivo: 'error_proveedor' };
  }
}

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
  correo: { para: string; asunto: string } & Correo,
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

async function enviar(para: string, asunto: string, correo: Correo): Promise<ResultadoEnvio> {
  const buzonDePruebas = process.env.EMAIL_OUTBOX_FILE;
  if (buzonDePruebas) {
    return anexarAlBuzonDePruebas(buzonDePruebas, { para, asunto, ...correo });
  }

  const smtp = configSmtp();
  if (smtp) {
    return enviarPorSmtp(smtp, { para, asunto, ...correo });
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
      html: correo.html,
      text: correo.texto,
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

/**
 * Convierte a texto plano un fragmento de los que arma `plantilla`.
 *
 * No pretende ser un conversor de HTML general: solo cubre las etiquetas y
 * entidades que produce `escaparHtml` y las plantillas de este archivo.
 */
function aTextoPlano(fragmento: string): string {
  return fragmento
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // `&amp;` va al final: si se deshiciera primero, un `&amp;lt;` del original
    // acabaría convertido en `<` y volvería a colarse el marcado que se escapó.
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Cada correo viaja en sus dos versiones.
 *
 * La alternativa en texto plano no es un adorno de accesibilidad: un mensaje
 * *solo* HTML es una de las señales que más pesa para que Gmail lo mande a spam,
 * y con un remitente sin dominio propio no sobra margen.
 */
type Correo = { html: string; texto: string };

function plantilla(
  titulo: string,
  cuerpo: string,
  cta?: { texto: string; url: string },
  pie = 'Si no solicitaste este correo, puedes ignorarlo.',
): Correo {
  const boton = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#065f46;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px">${cta.texto}</a>`
    : '';
  const html = `<!doctype html><html lang="es"><body style="font-family:system-ui,sans-serif;background:#fafaf9;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <div style="font-size:24px;color:#064e3b;font-weight:600">nutria</div>
    <h1 style="font-size:18px;color:#1c1917;margin:24px 0 8px">${titulo}</h1>
    <p style="color:#57534e;font-size:14px;line-height:1.6">${cuerpo}</p>
    ${boton}
    <p style="color:#a8a29e;font-size:12px;margin-top:24px">${pie}</p>
  </div></body></html>`;

  // En texto plano el enlace tiene que ir visible: no hay `href` donde esconderlo.
  const enlace = cta ? `\n\n${cta.texto}:\n${cta.url}` : '';
  const texto = `nutria\n\n${aTextoPlano(titulo)}\n\n${aTextoPlano(
    cuerpo,
  )}${enlace}\n\n${aTextoPlano(pie)}`;

  return { html, texto };
}

/**
 * Sin proveedor de correo configurado el registro no se rompe: en desarrollo se
 * devuelve el enlace para copiarlo desde la consola del servidor.
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
    logger.warn('Correo no enviado (sin proveedor configurado). Enlace de verificación:', {
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
      `<strong>${consultorio}</strong> te invita a usar la app de nutria para seguir tu plan, registrar tus comidas y escribirle desde tu teléfono. Crea tu contraseña para entrar; el enlace vence en ${INVITACION_VALIDA_DIAS} días.<br><br>Si te llegó más de una invitación, abre siempre la más reciente: por seguridad, cada invitación nueva desactiva el enlace de la anterior.`,
      { texto: 'Crear mi contraseña', url },
      'Si no reconoces esta invitación, ignora este correo: la cuenta no se crea hasta que abras el enlace.',
    ),
  );

  if (!resultado.enviado && esDesarrollo()) {
    logger.warn('Correo no enviado (sin proveedor configurado). Enlace de activación:', {
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
 * Enmascara la parte local de un correo: `andres@gmail.com` → `a***s@gmail.com`.
 *
 * Se usa en el aviso interno de altas. El dominio se conserva porque no
 * identifica a nadie por sí solo y sí sirve para distinguir tráfico real de
 * pruebas; la parte local se recorta porque el titular de ese buzón no aceptó
 * que su dirección viaje a un buzón administrativo.
 */
export function enmascararCorreo(email: string): string {
  const arroba = email.lastIndexOf('@');
  if (arroba <= 0) return '***';

  const local = email.slice(0, arroba);
  const dominio = email.slice(arroba);
  if (local.length <= 2) return `***${dominio}`;
  return `${local[0]}***${local[local.length - 1]}${dominio}`;
}

export type AltaParaAviso =
  | { tipo: 'nutriologo'; nombre: string; email: string }
  /**
   * Del paciente no se manda nombre y el correo va enmascarado: es titular de
   * un tercero (su nutriólogo), no cliente de la plataforma.
   */
  | { tipo: 'paciente'; email: string; consultorio: string };

function cuerpoDelAviso(alta: AltaParaAviso): { asunto: string; titulo: string; cuerpo: string } {
  if (alta.tipo === 'nutriologo') {
    return {
      asunto: '[nutria] Alta nueva: nutriólogo',
      titulo: 'Se registró un nutriólogo',
      cuerpo: `<strong>${escaparHtml(alta.nombre)}</strong><br>${escaparHtml(
        alta.email,
      )}<br><br>La cuenta queda pendiente hasta que confirme su correo.`,
    };
  }

  return {
    asunto: '[nutria] Alta nueva: paciente',
    titulo: 'Un paciente activó su cuenta',
    cuerpo: `${escaparHtml(enmascararCorreo(alta.email))}<br>Consultorio: <strong>${escaparHtml(
      alta.consultorio,
    )}</strong>`,
  };
}

/**
 * Aviso interno al equipo cada vez que se da de alta una cuenta.
 *
 * Es una señal de operación, no parte del flujo del usuario: **nunca lanza**, y
 * quien lo llama ignora el resultado. Que el buzón administrativo esté caído no
 * puede tumbar un registro que ya se guardó en la base.
 *
 * Sin `ADMIN_NOTIFY_EMAIL` no se envía nada y no se registra error: en local y
 * en los previews es lo normal.
 */
export async function avisarAltaAlEquipo(alta: AltaParaAviso): Promise<ResultadoEnvio> {
  const destino = process.env.ADMIN_NOTIFY_EMAIL;
  if (!destino) return { enviado: false, motivo: 'sin_configurar' };

  try {
    const { asunto, titulo, cuerpo } = cuerpoDelAviso(alta);
    const resultado = await enviar(
      destino,
      asunto,
      plantilla(titulo, cuerpo, undefined, 'Aviso interno automático de nutria. No hace falta responder.'),
    );
    if (!resultado.enviado) {
      logger.warn('No se pudo avisar del alta al equipo', { motivo: resultado.motivo });
    }
    return resultado;
  } catch (error: unknown) {
    logger.error('Falló el aviso interno de alta', error);
    return { enviado: false, motivo: 'error_proveedor' };
  }
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

/**
 * Aviso a la nutrióloga de que un paciente se dio de baja de la app.
 *
 * Sigue siendo la responsable del expediente clínico, que permanece intacto:
 * lo que terminó es el acceso del paciente a la app, no el tratamiento. Por eso
 * el mensaje aclara qué se conservó, en vez de dejarle creer que perdió datos.
 *
 * **Nunca lanza** y su resultado no cambia la respuesta: la baja ya se ejecutó
 * en una transacción y el paciente no puede quedar con la cuenta viva porque el
 * proveedor de correo esté caído.
 */
export async function avisarBajaDePacienteApp(
  para: string,
  pacienteNombre: string,
): Promise<ResultadoEnvio> {
  try {
    return await enviar(
      para,
      '[nutria] Un paciente cerró su acceso a la app',
      plantilla(
        'Baja de acceso a la app',
        `<strong>${escaparHtml(
          pacienteNombre,
        )}</strong> se dio de baja de la app del paciente y ya no podrá entrar ni registrar comidas, peso o mensajes.<br><br>Su <strong>expediente clínico permanece intacto</strong> en tu panel: mediciones, notas, planes e historial siguen bajo tu resguardo, como responsable del expediente. Si te pide cancelar esos datos, atiéndelo por el procedimiento del aviso de privacidad.`,
        undefined,
        'Aviso automático de nutria. No contiene información clínica.',
      ),
    );
  } catch (error: unknown) {
    logger.error('Falló el aviso de baja al nutriólogo', error);
    return { enviado: false, motivo: 'error_proveedor' };
  }
}
