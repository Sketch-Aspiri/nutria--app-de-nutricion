import { Document, Page, Text } from '@react-pdf/renderer';
import React from 'react';

import {
  BloqueComidaPdf,
  EncabezadoContinuacion,
  EncabezadoPrincipal,
  NotaPlan,
  PiePagina,
} from './MealPlanSections';
import {
  normalizarColorMarca,
  type MealPlanPdfData,
  type MealPlanPdfItem,
  type MealPlanPdfMeal,
} from './mealPlanPdfModel';
import { paginarPlan } from './mealPlanPagination';
import { crearEstilosPdf } from './mealPlanStyles';

export {
  normalizarColorMarca,
  type MealPlanPdfData,
  type MealPlanPdfItem,
  type MealPlanPdfMeal,
};

export function MealPlanDocument({ data }: { data: MealPlanPdfData }) {
  const colorMarca = normalizarColorMarca(data.marca.color);
  const style = crearEstilosPdf(colorMarca);
  const fecha = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(data.generadoEn);
  const paginas = paginarPlan(data.plan.comidas, data.plan.nota);

  return (
    <Document
      author={data.marca.profesional}
      creator={data.marca.nombre}
      subject={`Plan alimenticio de ${data.paciente.nombre}`}
      title={`Plan alimenticio - ${data.paciente.nombre}`}
    >
      {paginas.map((pagina, paginaIndice) => {
        const primera = paginaIndice === 0;

        return (
          <Page key={paginaIndice} size="A4" style={style.page} wrap={false}>
            <PiePagina
              pagina={paginaIndice + 1}
              style={style}
              totalPaginas={paginas.length}
            />

            {primera ? (
              <EncabezadoPrincipal data={data} fecha={fecha} style={style} />
            ) : (
              <EncabezadoContinuacion data={data} style={style} />
            )}

            {pagina.bloques.length > 0 ? (
              <Text style={style.sectionTitle}>
                Distribución del día{primera ? '' : ' - continuación'}
              </Text>
            ) : primera ? (
              <Text style={style.emptyMeal}>Sin comidas capturadas.</Text>
            ) : null}

            {pagina.bloques.map((comida) => (
              <BloqueComidaPdf
                key={comida.key}
                comida={comida}
                style={style}
              />
            ))}

            {pagina.nota ? (
              <NotaPlan nota={pagina.nota} style={style} />
            ) : null}
          </Page>
        );
      })}
    </Document>
  );
}
