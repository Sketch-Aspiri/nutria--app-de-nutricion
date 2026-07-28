import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PLAN_PDF_FIXTURE, PLAN_PDF_LONG_TEXT_FIXTURE } from './fixtures';
import { renderMealPlanPdf } from './renderMealPlanPdf';

const directorio = path.resolve(process.cwd(), '..', '..', 'output', 'pdf');
const destino = path.join(directorio, 'plan-alimenticio-fixture.pdf');
const destinoTextoLargo = path.join(
  directorio,
  'plan-alimenticio-texto-largo-fixture.pdf',
);

async function main(): Promise<void> {
  const [pdf, pdfTextoLargo] = await Promise.all([
    renderMealPlanPdf(PLAN_PDF_FIXTURE),
    renderMealPlanPdf(PLAN_PDF_LONG_TEXT_FIXTURE),
  ]);
  await mkdir(directorio, { recursive: true });
  await Promise.all([
    writeFile(destino, pdf),
    writeFile(destinoTextoLargo, pdfTextoLargo),
  ]);
  process.stdout.write(`${destino}\n${destinoTextoLargo}\n`);
}

void main();
