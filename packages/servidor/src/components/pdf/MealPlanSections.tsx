import { Text, View } from '@react-pdf/renderer';
import React from 'react';

import { numeroPdf, textoCompacto } from './mealPlanPdfModel';
import type { BloqueComida } from './mealPlanPagination';
import type { MealPlanPdfStyles } from './mealPlanStyles';

export {
  EncabezadoContinuacion,
  EncabezadoPrincipal,
} from './MealPlanHeaderSections';

type StyleProps = {
  style: MealPlanPdfStyles;
};

type PiePaginaProps = StyleProps & {
  pagina: number;
  totalPaginas: number;
};

export function PiePagina({
  pagina,
  style,
  totalPaginas,
}: PiePaginaProps) {
  return (
    <>
      <View style={style.brandRule} />
      <View style={style.footerRule} />
      <Text style={style.footerDisclaimer}>
        Documento de uso personal. Sigue las indicaciones de tu profesional de nutrición.
      </Text>
      <Text style={style.pageNumber}>
        Página {pagina} de {totalPaginas}
      </Text>
    </>
  );
}

type BloqueComidaPdfProps = StyleProps & {
  comida: BloqueComida;
};

export function BloqueComidaPdf({
  comida,
  style,
}: BloqueComidaPdfProps) {
  return (
    <View style={style.meal} wrap={false}>
      <View style={style.mealHeader}>
        <Text style={style.mealName}>
          {textoCompacto(comida.nombre)}
          {comida.continuacion ? ' (continuación)' : ''}
        </Text>
        {comida.horario ? (
          <Text style={style.mealTime}>
            {textoCompacto(comida.horario)}
          </Text>
        ) : null}
      </View>
      {comida.descripcion ? (
        <Text style={style.mealDescription}>
          {textoCompacto(comida.descripcion)}
        </Text>
      ) : null}
      {comida.items.length > 0 ? (
        <>
          <View style={style.itemHeader}>
            <Text style={style.itemMain}>Alimento y porción</Text>
            <Text style={style.itemKcal}>Energía</Text>
            <Text style={style.itemMacros}>Proteína / carbos / grasa</Text>
          </View>
          {comida.items.map((item, index) => (
            <View
              key={item.id}
              style={[
                style.itemRow,
                index === comida.items.length - 1 ? style.itemLast : {},
              ]}
              wrap={false}
            >
              <View style={style.itemMain}>
                <Text style={style.itemName}>
                  {textoCompacto(item.nombre)}
                </Text>
                <Text style={style.itemPortion}>
                  {numeroPdf(item.cantidadPorciones)} porción
                  {item.cantidadPorciones === 1 ? '' : 'es'}
                  {item.porcion
                    ? ` - ${textoCompacto(item.porcion)}`
                    : ''}
                </Text>
              </View>
              <Text style={style.itemKcal}>
                {numeroPdf(item.energiaKcal)} kcal
              </Text>
              <Text style={style.itemMacros}>
                {numeroPdf(item.proteinaG)} g / {numeroPdf(item.carbohidratosG)} g /{' '}
                {numeroPdf(item.lipidosG)} g
              </Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={style.emptyMeal}>Sin alimentos capturados.</Text>
      )}
    </View>
  );
}

type NotaPlanProps = StyleProps & {
  nota: string;
};

export function NotaPlan({ nota, style }: NotaPlanProps) {
  return (
    <View style={style.note} wrap={false}>
      <Text style={style.noteTitle}>Indicaciones</Text>
      <Text style={style.noteText}>{nota}</Text>
    </View>
  );
}
