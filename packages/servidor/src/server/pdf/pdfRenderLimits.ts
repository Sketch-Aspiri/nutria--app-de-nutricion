const MAX_RENDERS_CONCURRENTES = 2;
const TIMEOUT_RENDER_MS = 15_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

type LimitesRender = {
  maxConcurrentes?: number;
  timeoutMs?: number;
  maxBytes?: number;
};

let rendersActivos = 0;

export class PdfCapacidadAgotadaError extends Error {
  constructor() {
    super('No hay capacidad disponible para renderizar otro PDF.');
    this.name = 'PdfCapacidadAgotadaError';
  }
}

export class PdfRenderTimeoutError extends Error {
  constructor() {
    super('La generación del PDF excedió su tiempo máximo.');
    this.name = 'PdfRenderTimeoutError';
  }
}

export class PdfDemasiadoGrandeError extends Error {
  constructor() {
    super('El PDF generado excedió el tamaño máximo.');
    this.name = 'PdfDemasiadoGrandeError';
  }
}

/**
 * Protege el proceso de renders costosos. Si una tarea excede el timeout, su
 * slot permanece ocupado hasta que realmente termina para no perder el límite
 * de concurrencia mientras el trabajo subyacente sigue consumiendo recursos.
 */
export async function ejecutarRenderPdfProtegido(
  tarea: () => Promise<Buffer>,
  limites: LimitesRender = {},
): Promise<Buffer> {
  const maxConcurrentes = limites.maxConcurrentes ?? MAX_RENDERS_CONCURRENTES;
  const timeoutMs = limites.timeoutMs ?? TIMEOUT_RENDER_MS;
  const maxBytes = limites.maxBytes ?? MAX_PDF_BYTES;

  if (rendersActivos >= maxConcurrentes) {
    throw new PdfCapacidadAgotadaError();
  }
  rendersActivos += 1;

  let liberado = false;
  const liberar = (): void => {
    if (liberado) return;
    liberado = true;
    rendersActivos -= 1;
  };

  const ejecucion = Promise.resolve().then(tarea);
  // La liberación depende de la tarea real, no del timeout de la respuesta.
  void ejecucion.then(liberar, liberar);

  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    temporizador = setTimeout(
      () => reject(new PdfRenderTimeoutError()),
      timeoutMs,
    );
  });

  try {
    const pdf = await Promise.race([ejecucion, timeout]);
    if (pdf.byteLength > maxBytes) throw new PdfDemasiadoGrandeError();
    return pdf;
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

