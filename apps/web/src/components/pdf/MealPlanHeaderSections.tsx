import { Image, Text, View } from '@react-pdf/renderer';
import React from 'react';

import {
  descripcionProfesional,
  inicialDeMarca,
  numeroPdf,
  textoCompacto,
  type MealPlanPdfData,
} from './mealPlanPdfModel';
import type { MealPlanPdfStyles } from './mealPlanStyles';

type StyleProps = {
  style: MealPlanPdfStyles;
};

type EncabezadoPrincipalProps = StyleProps & {
  data: MealPlanPdfData;
  fecha: string;
};

export function EncabezadoPrincipal({
  data,
  fecha,
  style,
}: EncabezadoPrincipalProps) {
  return (
    <View wrap={false}>
      <View style={style.header}>
        <View style={style.brand}>
          {data.marca.logoUrl ? (
            <Image
              cache={false}
              src={data.marca.logoUrl}
              style={style.logo}
            />
          ) : (
            <View style={style.logoFallback}>
              <Text style={style.logoInitial}>
                {inicialDeMarca(data.marca.nombre)}
              </Text>
            </View>
          )}
          <View>
            <Text style={style.brandName}>
              {textoCompacto(data.marca.nombre)}
            </Text>
            <Text style={style.professional}>
              {textoCompacto(descripcionProfesional(data))}
            </Text>
          </View>
        </View>
        <View style={style.documentMeta}>
          <Text style={style.documentTitle}>Plan alimenticio</Text>
          <Text>{fecha}</Text>
        </View>
      </View>

      <Text style={style.patientEyebrow}>Preparado para</Text>
      <Text style={style.patientName}>
        {textoCompacto(data.paciente.nombre)}
      </Text>

      <ResumenMacros data={data} style={style} />
    </View>
  );
}

type EncabezadoContinuacionProps = StyleProps & {
  data: MealPlanPdfData;
};

export function EncabezadoContinuacion({
  data,
  style,
}: EncabezadoContinuacionProps) {
  return (
    <View style={style.continuationHeader}>
      <Text style={style.continuationBrand}>
        {textoCompacto(data.marca.nombre)}
      </Text>
      <Text style={style.continuationPatient}>
        Plan alimenticio - {textoCompacto(data.paciente.nombre)}
      </Text>
    </View>
  );
}

type MacroProps = StyleProps & {
  etiqueta: string;
  unidad: string;
  valor: number;
};

function Macro({ etiqueta, unidad, valor, style }: MacroProps) {
  return (
    <View style={style.macroCard}>
      <Text style={style.macroValue}>
        {numeroPdf(valor, 0)} {unidad}
      </Text>
      <Text style={style.macroLabel}>{etiqueta}</Text>
    </View>
  );
}

type ResumenMacrosProps = StyleProps & {
  data: MealPlanPdfData;
};

function ResumenMacros({ data, style }: ResumenMacrosProps) {
  return (
    <View style={style.macroRow}>
      <Macro
        etiqueta="Energía diaria"
        unidad="kcal"
        valor={data.plan.caloriasDiarias}
        style={style}
      />
      <Macro
        etiqueta="Proteína"
        unidad="g"
        valor={data.plan.proteinaG}
        style={style}
      />
      <Macro
        etiqueta="Carbohidratos"
        unidad="g"
        valor={data.plan.carbosG}
        style={style}
      />
      <Macro
        etiqueta="Grasa"
        unidad="g"
        valor={data.plan.grasaG}
        style={style}
      />
    </View>
  );
}
