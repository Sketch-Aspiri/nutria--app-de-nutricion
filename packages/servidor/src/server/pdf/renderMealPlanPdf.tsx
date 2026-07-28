import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';

import {
  MealPlanDocument,
  type MealPlanPdfData,
} from '@/components/pdf/MealPlanDocument';

/** Renderiza el plan completo en memoria para entregarlo como respuesta HTTP. */
export async function renderMealPlanPdf(data: MealPlanPdfData): Promise<Buffer> {
  return renderToBuffer(<MealPlanDocument data={data} />);
}
