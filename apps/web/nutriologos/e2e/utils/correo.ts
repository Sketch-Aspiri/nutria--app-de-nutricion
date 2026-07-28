import { readFile, rm } from 'node:fs/promises';

/**
 * Buzón de correo de los E2E.
 *
 * `src/server/email.ts` anexa cada correo a `EMAIL_OUTBOX_FILE` cuando esa
 * variable existe, en lugar de mandarlo por Resend. `playwright.config.ts` es
 * quien la define, así que los tests pueden afirmar sobre lo que recibiría el
 * paciente sin escribirle a nadie de verdad.
 */

export type CorreoDePrueba = {
  para: string;
  asunto: string;
  html: string;
  at: string;
};

function rutaBuzon(): string {
  const ruta = process.env.EMAIL_OUTBOX_FILE;
  if (!ruta) {
    throw new Error(
      'EMAIL_OUTBOX_FILE no está definida. La fija playwright.config.ts para los E2E.',
    );
  }
  return ruta;
}

/** Deja el buzón vacío antes de un test que cuenta correos. */
export async function limpiarBuzon(): Promise<void> {
  await rm(rutaBuzon(), { force: true });
}

/** Correos acumulados, opcionalmente filtrados por destinatario. */
export async function leerBuzon(para?: string): Promise<CorreoDePrueba[]> {
  let contenido: string;
  try {
    contenido = await readFile(rutaBuzon(), 'utf8');
  } catch {
    // Todavía no se ha enviado nada: el archivo no existe.
    return [];
  }

  const correos = contenido
    .split('\n')
    .filter((linea) => linea.trim().length > 0)
    .map((linea) => JSON.parse(linea) as CorreoDePrueba);

  return para ? correos.filter((correo) => correo.para === para) : correos;
}
