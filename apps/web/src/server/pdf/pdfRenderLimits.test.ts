/**
 * @jest-environment node
 */
import {
  ejecutarRenderPdfProtegido,
  PdfCapacidadAgotadaError,
  PdfDemasiadoGrandeError,
  PdfRenderTimeoutError,
} from './pdfRenderLimits';

describe('ejecutarRenderPdfProtegido', () => {
  it('rechaza trabajo adicional cuando los slots están ocupados', async () => {
    let resolverPrimero!: (pdf: Buffer) => void;
    let resolverSegundo!: (pdf: Buffer) => void;
    const primero = ejecutarRenderPdfProtegido(
      () =>
        new Promise<Buffer>((resolve) => {
          resolverPrimero = resolve;
        }),
    );
    const segundo = ejecutarRenderPdfProtegido(
      () =>
        new Promise<Buffer>((resolve) => {
          resolverSegundo = resolve;
        }),
    );

    await expect(
      ejecutarRenderPdfProtegido(async () => Buffer.from('%PDF-tercero')),
    ).rejects.toBeInstanceOf(PdfCapacidadAgotadaError);

    resolverPrimero(Buffer.from('%PDF-primero'));
    resolverSegundo(Buffer.from('%PDF-segundo'));
    await Promise.all([primero, segundo]);
  });

  it('corta la respuesta por timeout sin liberar antes la tarea subyacente', async () => {
    let resolver!: (pdf: Buffer) => void;
    const tarea = ejecutarRenderPdfProtegido(
      () =>
        new Promise<Buffer>((resolve) => {
          resolver = resolve;
        }),
      { maxConcurrentes: 1, timeoutMs: 5 },
    );

    await expect(tarea).rejects.toBeInstanceOf(PdfRenderTimeoutError);
    await expect(
      ejecutarRenderPdfProtegido(async () => Buffer.from('%PDF-nuevo'), {
        maxConcurrentes: 1,
      }),
    ).rejects.toBeInstanceOf(PdfCapacidadAgotadaError);

    resolver(Buffer.from('%PDF-tardío'));
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  it('rechaza un resultado mayor al máximo permitido', async () => {
    await expect(
      ejecutarRenderPdfProtegido(async () => Buffer.alloc(9), { maxBytes: 8 }),
    ).rejects.toBeInstanceOf(PdfDemasiadoGrandeError);
  });
});

