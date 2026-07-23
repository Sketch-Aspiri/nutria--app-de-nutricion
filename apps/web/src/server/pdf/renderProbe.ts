import { PLAN_PDF_FIXTURE, PLAN_PDF_LONG_TEXT_FIXTURE } from './fixtures';
import { renderMealPlanPdf } from './renderMealPlanPdf';

function contarPaginas(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

async function main(): Promise<void> {
  const [pdf, pdfTextoLargo] = await Promise.all([
    renderMealPlanPdf(PLAN_PDF_FIXTURE),
    renderMealPlanPdf(PLAN_PDF_LONG_TEXT_FIXTURE),
  ]);
  process.stdout.write(
    JSON.stringify({
      inicio: pdf.subarray(0, 8).toString('ascii'),
      final: pdf.subarray(-64).toString('ascii'),
      bytes: pdf.byteLength,
      paginas: contarPaginas(pdf),
      textoLargo: {
        inicio: pdfTextoLargo.subarray(0, 8).toString('ascii'),
        final: pdfTextoLargo.subarray(-64).toString('ascii'),
        bytes: pdfTextoLargo.byteLength,
        paginas: contarPaginas(pdfTextoLargo),
      },
    }),
  );
}

void main();
