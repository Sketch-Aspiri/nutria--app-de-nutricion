import type { FilaAlimento } from '../tipos';

/**
 * Tanda 1: núcleo de alimentos de consumo habitual en México.
 *
 * Procedencia de los valores: tablas de composición de dominio público (USDA
 * FoodData Central, SR Legacy y Foundation Foods) y, para los preparados
 * mexicanos que USDA no cubre, las tablas de composición del INCMNSZ / INSP.
 * Los hechos nutrimentales no son materia de derecho de autor; aquí no se
 * reproduce ninguna tabla ajena completa ni su maquetación, y la asignación de
 * equivalentes usa la aritmética pública del sistema (`nutricion/equivalentes`),
 * no el listado del SMAE.
 *
 * Las cantidades son POR PORCIÓN. Un nutrimento que no aparece en la fila es un
 * nutrimento no capturado, y llega a la base como `null`.
 *
 * Antes de escribir, `revisarCatalogo` comprueba dos invariantes de cada fila:
 * que los equivalentes declarados correspondan a la energía, y que la energía
 * corresponda a los macronutrimentos (Atwater). Al agregar un alimento,
 * el seed falla antes de tocar la base si alguna de las dos no cuadra.
 *
 * Estos valores son un punto de partida verificable, no una tabla clínica
 * certificada: antes de usarlos en consulta conviene que un nutriólogo revise
 * por muestreo los alimentos que más receta.
 */
export const NUCLEO_MX: FilaAlimento[] = [
  // ---------------------------------------------------------------------
  // Verduras — 1 equivalente ≈ 25 kcal, 4 g HC, 2 g proteína
  // ---------------------------------------------------------------------
  { ref: 'mx:nopal-cocido', nombre: 'Nopal cocido', grupo: 'verduras', porcion: '1 taza', g: 150, kcal: 22, prot: 2, lip: 0.1, hc: 4.5, fib: 3, na: 40, k: 210, ca: 244, fe: 0.9, va: 25, vc: 8, eq: { verduras: 1 } },
  { ref: 'mx:espinaca-cruda', nombre: 'Espinaca cruda', grupo: 'verduras', porcion: '2 tazas', g: 60, kcal: 14, prot: 1.7, lip: 0.2, hc: 2.2, fib: 1.3, na: 47, k: 335, ca: 60, fe: 1.6, fol: 116, va: 281, vc: 17, eq: { verduras: 1 } },
  { ref: 'mx:acelga-cocida', nombre: 'Acelga cocida', grupo: 'verduras', porcion: '1/2 taza', g: 88, kcal: 18, prot: 1.7, lip: 0.1, hc: 3.6, fib: 1.8, na: 157, k: 481, ca: 51, fe: 2, va: 268, vc: 16, eq: { verduras: 1 } },
  { ref: 'mx:calabacita-cocida', nombre: 'Calabacita cocida', grupo: 'verduras', porcion: '1 taza', g: 180, kcal: 27, prot: 2, lip: 0.4, hc: 4.8, fib: 1.8, na: 5, k: 350, ca: 24, fe: 0.7, vc: 12, eq: { verduras: 1 } },
  { ref: 'mx:jitomate', nombre: 'Jitomate', grupo: 'verduras', porcion: '1 pieza mediana', g: 123, kcal: 22, prot: 1.1, lip: 0.2, hc: 4.8, fib: 1.5, azu: 3.2, na: 6, k: 292, ca: 12, fe: 0.3, fol: 18, va: 51, vc: 17, eq: { verduras: 1 } },
  { ref: 'mx:tomate-verde', nombre: 'Tomate verde (tomatillo)', grupo: 'verduras', porcion: '1/2 taza picado', g: 66, kcal: 21, prot: 0.6, lip: 0.7, hc: 3.9, fib: 1.3, na: 1, k: 177, ca: 5, fe: 0.4, vc: 8, eq: { verduras: 1 } },
  { ref: 'mx:cebolla', nombre: 'Cebolla blanca picada', grupo: 'verduras', porcion: '1/2 taza', g: 80, kcal: 32, prot: 0.9, lip: 0.1, hc: 7.5, fib: 1.4, azu: 3.4, na: 3, k: 116, ca: 18, fe: 0.2, vc: 6, eq: { verduras: 1 } },
  { ref: 'mx:chayote-cocido', nombre: 'Chayote cocido', grupo: 'verduras', porcion: '3/4 taza', g: 120, kcal: 29, prot: 0.8, lip: 0.6, hc: 6.1, fib: 3.4, na: 2, k: 208, ca: 16, fe: 0.3, vc: 10, eq: { verduras: 1 } },
  { ref: 'mx:zanahoria-cruda', nombre: 'Zanahoria rallada', grupo: 'verduras', porcion: '1/2 taza', g: 55, kcal: 23, prot: 0.5, lip: 0.1, hc: 5.3, fib: 1.5, azu: 2.6, na: 38, k: 179, ca: 18, fe: 0.2, va: 459, vc: 3, eq: { verduras: 1 } },
  { ref: 'mx:brocoli-cocido', nombre: 'Brócoli cocido', grupo: 'verduras', porcion: '1/2 taza', g: 78, kcal: 27, prot: 1.9, lip: 0.3, hc: 5.6, fib: 2.6, na: 32, k: 229, ca: 31, fe: 0.5, fol: 84, vc: 51, eq: { verduras: 1 } },
  { ref: 'mx:coliflor-cocida', nombre: 'Coliflor cocida', grupo: 'verduras', porcion: '3/4 taza', g: 96, kcal: 22, prot: 1.7, lip: 0.4, hc: 4, fib: 2, na: 15, k: 138, ca: 15, fe: 0.3, vc: 42, eq: { verduras: 1 } },
  { ref: 'mx:ejote-cocido', nombre: 'Ejote cocido', grupo: 'verduras', porcion: '1/2 taza', g: 62, kcal: 22, prot: 1.2, lip: 0.2, hc: 4.9, fib: 2, na: 1, k: 91, ca: 27, fe: 0.4, vc: 6, eq: { verduras: 1 } },
  { ref: 'mx:lechuga-romana', nombre: 'Lechuga romana', grupo: 'verduras', porcion: '2 tazas', g: 94, kcal: 16, prot: 1.2, lip: 0.3, hc: 3.1, fib: 2, na: 8, k: 231, ca: 31, fe: 0.9, fol: 128, va: 407, vc: 22, eq: { verduras: 1 } },
  { ref: 'mx:pepino', nombre: 'Pepino con cáscara', grupo: 'verduras', porcion: '1 taza rebanado', g: 104, kcal: 16, prot: 0.7, lip: 0.1, hc: 3.8, fib: 0.5, na: 2, k: 152, ca: 16, fe: 0.3, vc: 3, eq: { verduras: 1 } },
  { ref: 'mx:chile-poblano', nombre: 'Chile poblano crudo', grupo: 'verduras', porcion: '1 pieza', g: 85, kcal: 17, prot: 0.8, lip: 0.2, hc: 3.7, fib: 1.4, na: 3, k: 145, ca: 8, fe: 0.3, vc: 60, eq: { verduras: 1 } },
  { ref: 'mx:champinon-cocido', nombre: 'Champiñón cocido', grupo: 'verduras', porcion: '1/2 taza', g: 78, kcal: 22, prot: 1.7, lip: 0.4, hc: 4.1, fib: 1.7, na: 2, k: 278, ca: 5, fe: 1.4, eq: { verduras: 1 } },
  { ref: 'mx:betabel-cocido', nombre: 'Betabel cocido', grupo: 'verduras', porcion: '1/2 taza', g: 85, kcal: 37, prot: 1.4, lip: 0.1, hc: 8.5, fib: 1.7, azu: 6.8, na: 65, k: 259, ca: 14, fe: 0.7, fol: 68, vc: 3, eq: { verduras: 1 } },
  { ref: 'mx:quelites-cocidos', nombre: 'Quelites cocidos', grupo: 'verduras', porcion: '1/2 taza', g: 90, kcal: 21, prot: 2, lip: 0.3, hc: 3.7, fib: 2, ca: 138, fe: 1.2, va: 290, vc: 20, eq: { verduras: 1 } },
  { ref: 'mx:verdolaga-cocida', nombre: 'Verdolagas cocidas', grupo: 'verduras', porcion: '1/2 taza', g: 90, kcal: 18, prot: 1.5, lip: 0.3, hc: 3.1, fib: 1.5, k: 305, ca: 70, fe: 1.2, vc: 10, eq: { verduras: 1 } },
  { ref: 'mx:flor-de-calabaza', nombre: 'Flor de calabaza', grupo: 'verduras', porcion: '1 taza', g: 50, kcal: 15, prot: 1, lip: 0.1, hc: 3.3, fib: 0.6, ca: 20, fe: 0.4, va: 65, vc: 14, eq: { verduras: 1 } },
  { ref: 'mx:pimiento-morron', nombre: 'Pimiento morrón rojo', grupo: 'verduras', porcion: '1 taza picado', g: 149, kcal: 39, prot: 1.5, lip: 0.4, hc: 9, fib: 3.1, azu: 6.3, na: 6, k: 314, ca: 10, fe: 0.6, va: 234, vc: 190, eq: { verduras: 1 } },
  { ref: 'mx:apio', nombre: 'Apio crudo', grupo: 'verduras', porcion: '1 taza picado', g: 101, kcal: 16, prot: 0.7, lip: 0.2, hc: 3, fib: 1.6, na: 81, k: 263, ca: 40, fe: 0.2, vc: 3, eq: { verduras: 1 } },
  { ref: 'mx:col-cocida', nombre: 'Col cocida', grupo: 'verduras', porcion: '1/2 taza', g: 75, kcal: 17, prot: 1, lip: 0.3, hc: 4.1, fib: 1.4, na: 6, k: 147, ca: 36, fe: 0.1, vc: 28, eq: { verduras: 1 } },
  { ref: 'mx:rabano', nombre: 'Rábano', grupo: 'verduras', porcion: '1 taza rebanado', g: 116, kcal: 19, prot: 0.8, lip: 0.1, hc: 3.9, fib: 1.9, na: 45, k: 270, ca: 29, fe: 0.4, vc: 17, eq: { verduras: 1 } },
  { ref: 'mx:jicama', nombre: 'Jícama cruda', grupo: 'verduras', porcion: '1/2 taza', g: 60, kcal: 23, prot: 0.4, lip: 0.1, hc: 5.3, fib: 3, na: 2, k: 90, ca: 7, fe: 0.4, vc: 12, eq: { verduras: 1 } },
  { ref: 'mx:huitlacoche', nombre: 'Huitlacoche cocido', grupo: 'verduras', porcion: '1/2 taza', g: 80, kcal: 25, prot: 2.5, lip: 0.6, hc: 4, fib: 1.6, eq: { verduras: 1 } },
  { ref: 'mx:germinado-de-soya', nombre: 'Germinado de soya', grupo: 'verduras', porcion: '1 taza', g: 104, kcal: 31, prot: 3.2, lip: 0.2, hc: 6.2, fib: 1.9, k: 155, vc: 14, eq: { verduras: 1 } },

  // ---------------------------------------------------------------------
  // Frutas — 1 equivalente ≈ 60 kcal, 15 g HC
  // ---------------------------------------------------------------------
  { ref: 'mx:manzana', nombre: 'Manzana con cáscara', grupo: 'frutas', porcion: '1 pieza chica', g: 130, kcal: 68, prot: 0.3, lip: 0.2, hc: 18, fib: 3.1, azu: 13.5, na: 1, k: 137, ca: 8, fe: 0.2, vc: 6, ig: 36, eq: { frutas: 1 } },
  { ref: 'mx:platano', nombre: 'Plátano tabasco', grupo: 'frutas', porcion: '1/2 pieza', g: 60, kcal: 53, prot: 0.7, lip: 0.2, hc: 13.6, fib: 1.6, azu: 7.3, na: 1, k: 215, ca: 3, fe: 0.2, vc: 5, ig: 51, eq: { frutas: 1 } },
  { ref: 'mx:papaya', nombre: 'Papaya en cubos', grupo: 'frutas', porcion: '1 taza', g: 145, kcal: 62, prot: 0.7, lip: 0.4, hc: 15.7, fib: 2.5, azu: 11.3, na: 12, k: 264, ca: 29, fe: 0.4, fol: 55, va: 68, vc: 88, ig: 60, eq: { frutas: 1 } },
  { ref: 'mx:mango-manila', nombre: 'Mango manila', grupo: 'frutas', porcion: '1/2 pieza', g: 100, kcal: 60, prot: 0.8, lip: 0.4, hc: 15, fib: 1.6, azu: 13.7, k: 168, ca: 11, fe: 0.2, va: 54, vc: 36, ig: 51, eq: { frutas: 1 } },
  { ref: 'mx:naranja', nombre: 'Naranja', grupo: 'frutas', porcion: '1 pieza mediana', g: 140, kcal: 65, prot: 1.3, lip: 0.2, hc: 16.3, fib: 3.4, azu: 12.9, na: 0, k: 232, ca: 60, fe: 0.1, fol: 40, vc: 70, ig: 43, eq: { frutas: 1 } },
  { ref: 'mx:mandarina', nombre: 'Mandarina', grupo: 'frutas', porcion: '1 pieza grande', g: 120, kcal: 63, prot: 1, lip: 0.4, hc: 15.9, fib: 2.2, azu: 12.6, k: 199, ca: 44, vc: 32, eq: { frutas: 1 } },
  { ref: 'mx:guayaba', nombre: 'Guayaba', grupo: 'frutas', porcion: '2 piezas chicas', g: 90, kcal: 61, prot: 2.3, lip: 0.9, hc: 12.9, fib: 4.9, azu: 8, k: 378, ca: 16, fe: 0.2, fol: 44, vc: 208, eq: { frutas: 1 } },
  { ref: 'mx:sandia', nombre: 'Sandía en cubos', grupo: 'frutas', porcion: '1 taza', g: 152, kcal: 46, prot: 0.9, lip: 0.2, hc: 11.5, fib: 0.6, azu: 9.4, na: 2, k: 170, ca: 11, fe: 0.4, va: 43, vc: 12, ig: 72, eq: { frutas: 1 } },
  { ref: 'mx:melon', nombre: 'Melón chino en cubos', grupo: 'frutas', porcion: '1 taza', g: 160, kcal: 54, prot: 1.3, lip: 0.3, hc: 13, fib: 1.4, azu: 12.5, na: 26, k: 427, ca: 14, fe: 0.3, fol: 34, va: 270, vc: 59, ig: 65, eq: { frutas: 1 } },
  { ref: 'mx:pina', nombre: 'Piña en cubos', grupo: 'frutas', porcion: '3/4 taza', g: 124, kcal: 62, prot: 0.7, lip: 0.1, hc: 16.2, fib: 1.7, azu: 12.2, na: 1, k: 135, ca: 16, fe: 0.4, vc: 59, ig: 59, eq: { frutas: 1 } },
  { ref: 'mx:fresa', nombre: 'Fresa entera', grupo: 'frutas', porcion: '1 taza', g: 152, kcal: 49, prot: 1, lip: 0.5, hc: 11.7, fib: 3, azu: 7.4, na: 2, k: 233, ca: 24, fe: 0.6, fol: 36, vc: 89, ig: 40, eq: { frutas: 1 } },
  { ref: 'mx:uva', nombre: 'Uva roja', grupo: 'frutas', porcion: '15 piezas', g: 75, kcal: 52, prot: 0.5, lip: 0.1, hc: 13.6, fib: 0.7, azu: 11.6, na: 2, k: 143, ca: 8, fe: 0.3, vc: 3, ig: 53, eq: { frutas: 1 } },
  { ref: 'mx:pera', nombre: 'Pera', grupo: 'frutas', porcion: '1 pieza chica', g: 120, kcal: 68, prot: 0.4, lip: 0.2, hc: 18.3, fib: 3.7, azu: 11.7, na: 1, k: 138, ca: 11, fe: 0.2, vc: 5, ig: 38, eq: { frutas: 1 } },
  { ref: 'mx:durazno', nombre: 'Durazno', grupo: 'frutas', porcion: '1 pieza grande', g: 150, kcal: 59, prot: 1.4, lip: 0.4, hc: 14.3, fib: 2.3, azu: 12.6, k: 285, ca: 9, fe: 0.4, va: 24, vc: 10, ig: 42, eq: { frutas: 1 } },
  { ref: 'mx:ciruela', nombre: 'Ciruela roja', grupo: 'frutas', porcion: '2 piezas', g: 132, kcal: 61, prot: 0.9, lip: 0.4, hc: 15, fib: 1.9, azu: 13, k: 205, ca: 8, fe: 0.2, vc: 12, eq: { frutas: 1 } },
  { ref: 'mx:tuna', nombre: 'Tuna', grupo: 'frutas', porcion: '1 pieza grande', g: 150, kcal: 61, prot: 1.1, lip: 0.8, hc: 14.3, fib: 5.4, k: 330, ca: 84, fe: 0.4, vc: 21, eq: { frutas: 1 } },
  { ref: 'mx:mamey', nombre: 'Mamey', grupo: 'frutas', porcion: '1/3 taza', g: 50, kcal: 62, prot: 0.7, lip: 0.2, hc: 15.6, fib: 3, k: 226, vc: 10, eq: { frutas: 1 } },
  { ref: 'mx:zapote-negro', nombre: 'Zapote negro', grupo: 'frutas', porcion: '1/2 taza', g: 100, kcal: 65, prot: 0.6, lip: 0.1, hc: 17, fib: 3.5, vc: 20, eq: { frutas: 1 } },
  { ref: 'mx:toronja', nombre: 'Toronja', grupo: 'frutas', porcion: '1/2 pieza', g: 123, kcal: 52, prot: 1, lip: 0.2, hc: 13.1, fib: 1.8, azu: 11.4, k: 166, ca: 27, vc: 46, ig: 25, eq: { frutas: 1 } },
  { ref: 'mx:kiwi', nombre: 'Kiwi', grupo: 'frutas', porcion: '1 1/2 piezas', g: 105, kcal: 64, prot: 1.2, lip: 0.6, hc: 15.4, fib: 3.2, azu: 9.5, k: 325, ca: 36, vc: 96, eq: { frutas: 1 } },
  { ref: 'mx:higo', nombre: 'Higo fresco', grupo: 'frutas', porcion: '2 piezas', g: 100, kcal: 74, prot: 0.8, lip: 0.3, hc: 19.2, fib: 2.9, azu: 16.3, k: 232, ca: 35, fe: 0.4, eq: { frutas: 1 } },
  { ref: 'mx:pitahaya', nombre: 'Pitaya (pitahaya)', grupo: 'frutas', porcion: '1 taza', g: 170, kcal: 60, prot: 1.1, lip: 0.6, hc: 13, fib: 3, vc: 6, eq: { frutas: 1 } },
  { ref: 'mx:pasas', nombre: 'Pasas', grupo: 'frutas', porcion: '2 cucharadas', g: 20, kcal: 60, prot: 0.6, lip: 0.1, hc: 15.9, fib: 0.8, azu: 11.9, k: 149, fe: 0.4, eq: { frutas: 1 } },
  { ref: 'mx:arandano-deshidratado', nombre: 'Arándano deshidratado', grupo: 'frutas', porcion: '2 cucharadas', g: 20, kcal: 62, prot: 0, lip: 0.3, hc: 16.6, fib: 1.2, azu: 13.2, eq: { frutas: 1 } },
  { ref: 'mx:jugo-de-naranja', nombre: 'Jugo de naranja natural', grupo: 'frutas', porcion: '1/2 taza', g: 124, kcal: 56, prot: 0.9, lip: 0.2, hc: 12.9, fib: 0.2, azu: 10.4, k: 248, vc: 62, ig: 50, eq: { frutas: 1 } },

  // ---------------------------------------------------------------------
  // Cereales y tubérculos — 1 equivalente ≈ 70 kcal; "con grasa" suma aceites
  // ---------------------------------------------------------------------
  { ref: 'mx:tortilla-de-maiz', nombre: 'Tortilla de maíz', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1 pieza', g: 30, kcal: 66, prot: 1.7, lip: 0.8, hc: 13.8, sat: 0.1, col: 0, fib: 1.7, na: 3, k: 55, ca: 46, fe: 0.4, eq: { cereales: 1 } },
  { ref: 'mx:tortilla-de-harina', nombre: 'Tortilla de harina', grupo: 'cereales', subgrupo: 'con grasa', porcion: '1 pieza chica', g: 30, kcal: 94, prot: 2.5, lip: 2.3, hc: 15.6, sat: 0.6, fib: 0.9, na: 190, ca: 40, fe: 1.1, eq: { cereales: 1, aceites: 0.5 } },
  { ref: 'mx:bolillo', nombre: 'Bolillo sin migajón', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/3 pieza', g: 30, kcal: 83, prot: 2.7, lip: 0.5, hc: 16.9, fib: 0.8, na: 160, fe: 1, eq: { cereales: 1 } },
  { ref: 'mx:pan-integral', nombre: 'Pan integral de caja', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1 rebanada', g: 28, kcal: 69, prot: 3.6, lip: 0.9, hc: 11.6, fib: 1.9, na: 132, k: 69, ca: 30, fe: 0.7, eq: { cereales: 1 } },
  { ref: 'mx:pan-blanco', nombre: 'Pan blanco de caja', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1 rebanada', g: 25, kcal: 66, prot: 1.9, lip: 0.8, hc: 12.7, fib: 0.6, na: 127, ca: 37, fe: 0.9, eq: { cereales: 1 } },
  { ref: 'mx:arroz-blanco-cocido', nombre: 'Arroz blanco cocido', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/3 taza', g: 55, kcal: 72, prot: 1.5, lip: 0.2, hc: 15.6, fib: 0.2, na: 1, k: 19, fe: 0.7, ig: 73, eq: { cereales: 1 } },
  { ref: 'mx:arroz-integral-cocido', nombre: 'Arroz integral cocido', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/3 taza', g: 65, kcal: 71, prot: 1.7, lip: 0.6, hc: 14.9, fib: 1, na: 3, k: 56, fe: 0.3, ig: 68, eq: { cereales: 1 } },
  { ref: 'mx:avena-cruda', nombre: 'Avena en hojuelas', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/4 taza', g: 20, kcal: 78, prot: 3.4, lip: 1.4, hc: 13.3, fib: 2.1, na: 1, k: 86, ca: 10, fe: 0.9, eq: { cereales: 1 } },
  { ref: 'mx:pasta-cocida', nombre: 'Pasta cocida', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/3 taza', g: 47, kcal: 73, prot: 2.7, lip: 0.4, hc: 14.3, fib: 0.9, na: 1, fe: 0.6, ig: 49, eq: { cereales: 1 } },
  { ref: 'mx:pasta-integral-cocida', nombre: 'Pasta integral cocida', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/3 taza', g: 47, kcal: 61, prot: 2.6, lip: 0.3, hc: 12.9, fib: 2.1, na: 2, eq: { cereales: 1 } },
  { ref: 'mx:papa-cocida', nombre: 'Papa cocida', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/2 pieza mediana', g: 85, kcal: 74, prot: 1.6, lip: 0.1, hc: 17, fib: 1.8, na: 4, k: 328, ca: 6, fe: 0.3, vc: 11, ig: 78, eq: { cereales: 1 } },
  { ref: 'mx:camote-cocido', nombre: 'Camote cocido', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/2 taza', g: 100, kcal: 76, prot: 1.4, lip: 0.1, hc: 17.7, fib: 2.5, azu: 5.7, na: 27, k: 230, ca: 27, fe: 0.7, va: 709, vc: 13, eq: { cereales: 1 } },
  { ref: 'mx:elote-desgranado', nombre: 'Elote desgranado cocido', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/2 taza', g: 82, kcal: 72, prot: 2.7, lip: 1.1, hc: 15.6, fib: 1.8, azu: 2.9, na: 1, k: 158, fe: 0.4, fol: 19, eq: { cereales: 1 } },
  { ref: 'mx:tostada-horneada', nombre: 'Tostada horneada', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1 1/2 piezas', g: 18, kcal: 66, prot: 1.7, lip: 0.8, hc: 13.5, fib: 1.5, na: 30, ca: 28, eq: { cereales: 1 } },
  { ref: 'mx:tostada-frita', nombre: 'Tostada frita', grupo: 'cereales', subgrupo: 'con grasa', porcion: '1 pieza', g: 20, kcal: 93, prot: 1.6, lip: 4, hc: 13, sat: 0.7, fib: 1.6, na: 80, eq: { cereales: 1, aceites: 0.5 } },
  { ref: 'mx:galleta-salada', nombre: 'Galletas saladas', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '5 piezas', g: 15, kcal: 65, prot: 1.3, lip: 1.7, hc: 10.8, sat: 0.4, fib: 0.4, na: 145, eq: { cereales: 1 } },
  { ref: 'mx:galleta-maria', nombre: 'Galletas Marías', grupo: 'cereales', subgrupo: 'con grasa', porcion: '4 piezas', g: 20, kcal: 87, prot: 1.4, lip: 2.4, hc: 15, sat: 1.1, azu: 4.5, na: 60, eq: { cereales: 1, aceites: 0.5 } },
  { ref: 'mx:amaranto-tostado', nombre: 'Amaranto tostado', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/4 taza', g: 20, kcal: 75, prot: 2.8, lip: 1.3, hc: 13, fib: 1.3, ca: 32, fe: 1.5, eq: { cereales: 1 } },
  { ref: 'mx:quinoa-cocida', nombre: 'Quinoa cocida', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/3 taza', g: 62, kcal: 74, prot: 2.7, lip: 1.2, hc: 12.9, fib: 1.6, na: 4, k: 108, fe: 0.9, eq: { cereales: 1 } },
  { ref: 'mx:cereal-de-maiz', nombre: 'Cereal de maíz sin azúcar', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '3/4 taza', g: 20, kcal: 76, prot: 1.4, lip: 0.1, hc: 17.2, fib: 0.6, na: 145, fe: 5.4, eq: { cereales: 1 } },
  { ref: 'mx:granola', nombre: 'Granola', grupo: 'cereales', subgrupo: 'con grasa', porcion: '1/4 taza', g: 25, kcal: 118, prot: 3, lip: 5, hc: 15.5, sat: 0.8, fib: 2.5, azu: 5, na: 5, eq: { cereales: 1, aceites: 1 } },
  { ref: 'mx:palomitas-naturales', nombre: 'Palomitas naturales', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '2 tazas', g: 16, kcal: 62, prot: 2, lip: 0.7, hc: 12.4, fib: 2.3, na: 1, eq: { cereales: 1 } },
  { ref: 'mx:platano-macho-cocido', nombre: 'Plátano macho cocido', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/3 taza', g: 50, kcal: 58, prot: 0.5, lip: 0.1, hc: 15.5, fib: 1.1, k: 233, vc: 6, eq: { cereales: 1 } },
  { ref: 'mx:yuca-cocida', nombre: 'Yuca cocida', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '1/4 taza', g: 40, kcal: 64, prot: 0.6, lip: 0.1, hc: 15.3, fib: 0.7, k: 110, vc: 8, eq: { cereales: 1 } },
  { ref: 'mx:masa-de-maiz', nombre: 'Masa de maíz nixtamalizada', grupo: 'cereales', subgrupo: 'sin grasa', porcion: '2 cucharadas', g: 30, kcal: 65, prot: 1.7, lip: 0.7, hc: 13.5, fib: 1.4, ca: 40, eq: { cereales: 1 } },
  { ref: 'mx:concha', nombre: 'Concha (pan dulce)', grupo: 'cereales', subgrupo: 'con grasa y azúcar', porcion: '1/2 pieza', g: 35, kcal: 130, prot: 2.8, lip: 4.5, hc: 20, sat: 2, azu: 8, na: 105, eq: { cereales: 1, aceites: 1, azucares: 0.5 } },

  // ---------------------------------------------------------------------
  // Leguminosas — 1 equivalente ≈ 120 kcal, 8 g proteína
  // ---------------------------------------------------------------------
  { ref: 'mx:frijol-bayo-cocido', nombre: 'Frijol bayo cocido', grupo: 'leguminosas', porcion: '1/2 taza', g: 85, kcal: 114, prot: 7.6, lip: 0.5, hc: 20.4, fib: 7.5, na: 2, k: 340, ca: 40, fe: 1.8, fol: 110, ig: 30, eq: { leguminosas: 1 } },
  { ref: 'mx:frijol-negro-cocido', nombre: 'Frijol negro cocido', grupo: 'leguminosas', porcion: '1/2 taza', g: 86, kcal: 114, prot: 7.6, lip: 0.5, hc: 20.4, fib: 7.5, na: 1, k: 305, ca: 23, fe: 1.8, fol: 128, ig: 30, eq: { leguminosas: 1 } },
  { ref: 'mx:frijol-refrito', nombre: 'Frijol refrito', grupo: 'leguminosas', subgrupo: 'con grasa', porcion: '1/2 taza', g: 90, kcal: 152, prot: 7, lip: 5, hc: 19, sat: 1.8, fib: 6, na: 380, k: 300, fe: 1.6, eq: { leguminosas: 1, aceites: 0.75 } },
  { ref: 'mx:lenteja-cocida', nombre: 'Lenteja cocida', grupo: 'leguminosas', porcion: '1/2 taza', g: 99, kcal: 115, prot: 8.9, lip: 0.4, hc: 19.9, fib: 7.8, na: 2, k: 366, ca: 19, fe: 3.3, fol: 179, eq: { leguminosas: 1 } },
  { ref: 'mx:garbanzo-cocido', nombre: 'Garbanzo cocido', grupo: 'leguminosas', porcion: '1/2 taza', g: 82, kcal: 135, prot: 7.3, lip: 2.1, hc: 22.5, fib: 6.2, na: 6, k: 239, ca: 40, fe: 2.4, fol: 141, eq: { leguminosas: 1 } },
  { ref: 'mx:haba-cocida', nombre: 'Haba cocida', grupo: 'leguminosas', porcion: '1/2 taza', g: 85, kcal: 94, prot: 6.5, lip: 0.3, hc: 16.7, fib: 4.6, k: 228, ca: 31, fe: 1.3, fol: 88, eq: { leguminosas: 0.75 } },
  { ref: 'mx:alubia-cocida', nombre: 'Alubia cocida', grupo: 'leguminosas', porcion: '1/2 taza', g: 90, kcal: 110, prot: 7.5, lip: 0.4, hc: 20, fib: 6, k: 300, ca: 60, fe: 2, eq: { leguminosas: 1 } },
  { ref: 'mx:soya-cocida', nombre: 'Frijol de soya cocido', grupo: 'leguminosas', subgrupo: 'con grasa', porcion: '1/2 taza', g: 86, kcal: 149, prot: 14.3, lip: 7.7, hc: 8.5, sat: 1.1, fib: 5.2, k: 443, ca: 88, fe: 4.4, eq: { leguminosas: 1, aceites: 0.5 } },
  { ref: 'mx:chicharo-cocido', nombre: 'Chícharo cocido', grupo: 'leguminosas', porcion: '1/2 taza', g: 80, kcal: 67, prot: 4.3, lip: 0.2, hc: 12.5, fib: 4.4, na: 2, k: 217, ca: 22, fe: 1.2, vc: 11, eq: { leguminosas: 0.5 } },

  // ---------------------------------------------------------------------
  // Origen animal — muy bajo 40, bajo 55, moderado 75, alto 100 kcal por eq.
  // ---------------------------------------------------------------------
  { ref: 'mx:pechuga-de-pollo', nombre: 'Pechuga de pollo sin piel, cocida', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '30 g', g: 30, kcal: 49, prot: 9.3, lip: 1.1, hc: 0, sat: 0.3, col: 26, na: 22, k: 78, fe: 0.3, eq: { origen_animal: 1 } },
  { ref: 'mx:pierna-de-pollo', nombre: 'Pierna de pollo sin piel, cocida', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 63, prot: 8.5, lip: 3, hc: 0, sat: 0.8, col: 30, na: 26, k: 72, fe: 0.4, eq: { origen_animal: 1 } },
  { ref: 'mx:pechuga-de-pavo', nombre: 'Pechuga de pavo cocida', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '30 g', g: 30, kcal: 47, prot: 8.9, lip: 1, hc: 0, sat: 0.3, col: 21, na: 20, k: 75, eq: { origen_animal: 1 } },
  { ref: 'mx:huevo-entero', nombre: 'Huevo entero', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '1 pieza', g: 50, kcal: 72, prot: 6.3, lip: 4.8, hc: 0.4, sat: 1.6, col: 186, na: 71, k: 69, ca: 28, fe: 0.9, fol: 24, va: 80, eq: { origen_animal: 1 } },
  { ref: 'mx:clara-de-huevo', nombre: 'Clara de huevo', grupo: 'origen_animal', subgrupo: 'muy bajo aporte de grasa', porcion: '2 piezas', g: 66, kcal: 34, prot: 7.2, lip: 0.1, hc: 0.5, sat: 0, col: 0, na: 110, k: 108, eq: { origen_animal: 0.75 } },
  { ref: 'mx:atun-en-agua', nombre: 'Atún en agua drenado', grupo: 'origen_animal', subgrupo: 'muy bajo aporte de grasa', porcion: '30 g', g: 30, kcal: 38, prot: 8.4, lip: 0.3, hc: 0, sat: 0.1, col: 12, na: 111, k: 72, eq: { origen_animal: 0.75 } },
  { ref: 'mx:tilapia', nombre: 'Filete de tilapia cocido', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '40 g', g: 40, kcal: 51, prot: 10.4, lip: 0.9, hc: 0, sat: 0.3, col: 20, na: 22, k: 120, eq: { origen_animal: 1 } },
  { ref: 'mx:huachinango', nombre: 'Huachinango cocido', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '40 g', g: 40, kcal: 51, prot: 10.5, lip: 0.7, hc: 0, sat: 0.2, col: 32, na: 26, k: 178, eq: { origen_animal: 1 } },
  { ref: 'mx:salmon', nombre: 'Salmón cocido', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 62, prot: 6.8, lip: 3.7, hc: 0, sat: 0.8, col: 21, na: 17, k: 111, eq: { origen_animal: 1 } },
  { ref: 'mx:camaron', nombre: 'Camarón cocido', grupo: 'origen_animal', subgrupo: 'muy bajo aporte de grasa', porcion: '40 g', g: 40, kcal: 40, prot: 9.5, lip: 0.2, hc: 0.1, sat: 0.1, col: 76, na: 45, k: 90, eq: { origen_animal: 0.75 } },
  { ref: 'mx:sardina', nombre: 'Sardina en aceite drenada', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 62, prot: 7.4, lip: 3.4, hc: 0, sat: 0.5, col: 43, na: 154, ca: 116, fe: 0.9, eq: { origen_animal: 1 } },
  { ref: 'mx:bistec-de-res', nombre: 'Bistec de res magro cocido', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '30 g', g: 30, kcal: 58, prot: 8.8, lip: 2.3, hc: 0, sat: 0.9, col: 25, na: 16, k: 96, fe: 0.8, eq: { origen_animal: 1 } },
  { ref: 'mx:carne-molida-res', nombre: 'Carne molida de res 90/10 cocida', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 62, prot: 8.5, lip: 3, hc: 0, sat: 1.2, col: 27, na: 20, k: 92, fe: 0.8, eq: { origen_animal: 1 } },
  { ref: 'mx:arrachera', nombre: 'Arrachera cocida', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 66, prot: 8.5, lip: 3.4, hc: 0, sat: 1.4, col: 24, na: 18, k: 90, fe: 0.9, eq: { origen_animal: 1 } },
  { ref: 'mx:lomo-de-cerdo', nombre: 'Lomo de cerdo cocido', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '30 g', g: 30, kcal: 51, prot: 8.7, lip: 1.5, hc: 0, sat: 0.5, col: 25, na: 15, k: 128, eq: { origen_animal: 1 } },
  { ref: 'mx:chuleta-de-cerdo', nombre: 'Chuleta de cerdo cocida', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 70, prot: 8, lip: 4, hc: 0, sat: 1.4, col: 24, na: 18, k: 96, eq: { origen_animal: 1 } },
  { ref: 'mx:higado-de-res', nombre: 'Hígado de res cocido', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '30 g', g: 30, kcal: 58, prot: 8.8, lip: 1.5, hc: 1.5, sat: 0.6, col: 118, na: 20, fe: 1.7, fol: 79, va: 2790, eq: { origen_animal: 1 } },
  { ref: 'mx:machaca', nombre: 'Machaca (carne seca)', grupo: 'origen_animal', subgrupo: 'muy bajo aporte de grasa', porcion: '20 g', g: 20, kcal: 61, prot: 11, lip: 1.5, hc: 0.5, sat: 0.6, col: 25, na: 400, eq: { origen_animal: 1 } },
  { ref: 'mx:jamon-de-pavo', nombre: 'Jamón de pavo', grupo: 'origen_animal', subgrupo: 'bajo aporte de grasa', porcion: '2 rebanadas', g: 56, kcal: 63, prot: 9.5, lip: 1.8, hc: 1.6, sat: 0.5, col: 30, na: 620, eq: { origen_animal: 1 } },
  { ref: 'mx:chorizo', nombre: 'Chorizo de cerdo cocido', grupo: 'origen_animal', subgrupo: 'alto aporte de grasa', porcion: '30 g', g: 30, kcal: 128, prot: 7, lip: 11, hc: 0.5, sat: 4, col: 26, na: 350, eq: { origen_animal: 1, aceites: 1.5 } },
  { ref: 'mx:queso-panela', nombre: 'Queso panela', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 69, prot: 5.3, lip: 5, hc: 0.9, sat: 3, col: 17, na: 188, ca: 180, eq: { origen_animal: 1, aceites: 0.25 } },
  { ref: 'mx:queso-oaxaca', nombre: 'Queso Oaxaca', grupo: 'origen_animal', subgrupo: 'alto aporte de grasa', porcion: '30 g', g: 30, kcal: 106, prot: 7, lip: 8.4, hc: 0.8, sat: 5.3, col: 25, na: 200, ca: 210, eq: { origen_animal: 1, aceites: 1 } },
  { ref: 'mx:queso-fresco', nombre: 'Queso fresco', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '30 g', g: 30, kcal: 88, prot: 5.6, lip: 6.6, hc: 1, sat: 4.2, col: 21, na: 190, ca: 170, eq: { origen_animal: 1, aceites: 0.75 } },
  { ref: 'mx:requeson', nombre: 'Requesón', grupo: 'origen_animal', subgrupo: 'moderado aporte de grasa', porcion: '1/4 taza', g: 60, kcal: 82, prot: 7, lip: 4.8, hc: 2.5, sat: 3, col: 17, na: 220, ca: 90, eq: { origen_animal: 1, aceites: 0.5 } },

  // ---------------------------------------------------------------------
  // Leche — descremada 95, semidescremada ~118, entera ~140 kcal por eq.
  // ---------------------------------------------------------------------
  { ref: 'mx:leche-descremada', nombre: 'Leche descremada', grupo: 'leche', subgrupo: 'descremada', porcion: '1 taza', g: 240, kcal: 83, prot: 8.3, lip: 0.2, hc: 12.2, sat: 0.1, col: 5, azu: 12.2, na: 103, k: 382, ca: 299, va: 156, eq: { leche: 1 } },
  { ref: 'mx:leche-semidescremada', nombre: 'Leche semidescremada (2 %)', grupo: 'leche', subgrupo: 'semidescremada', porcion: '1 taza', g: 244, kcal: 122, prot: 8, lip: 4.8, hc: 12, sat: 3.1, col: 20, azu: 12, na: 115, k: 366, ca: 293, eq: { leche: 1, aceites: 0.5 } },
  { ref: 'mx:leche-entera', nombre: 'Leche entera', grupo: 'leche', subgrupo: 'entera', porcion: '1 taza', g: 244, kcal: 149, prot: 7.7, lip: 8, hc: 11.7, sat: 4.6, col: 24, azu: 12.3, na: 105, k: 322, ca: 276, eq: { leche: 1, aceites: 1 } },
  { ref: 'mx:yogurt-natural', nombre: 'Yogurt natural sin azúcar', grupo: 'leche', subgrupo: 'entera', porcion: '3/4 taza', g: 180, kcal: 111, prot: 6.3, lip: 5.9, hc: 8.5, sat: 3.8, col: 23, azu: 8.5, na: 82, ca: 220, eq: { leche: 1, aceites: 0.5 } },
  { ref: 'mx:yogurt-griego', nombre: 'Yogurt griego natural sin azúcar', grupo: 'leche', subgrupo: 'descremada', porcion: '3/4 taza', g: 170, kcal: 100, prot: 17, lip: 0.7, hc: 6, sat: 0.2, col: 9, azu: 5.5, na: 60, ca: 190, eq: { leche: 1 } },
  { ref: 'mx:yogurt-bebible', nombre: 'Yogurt bebible con azúcar', grupo: 'leche', subgrupo: 'con azúcar', porcion: '1 botella (250 ml)', g: 250, kcal: 190, prot: 7.5, lip: 3, hc: 33, sat: 1.9, col: 12, azu: 30, na: 95, ca: 250, eq: { leche: 1, azucares: 2, aceites: 0.5 } },
  { ref: 'mx:bebida-de-soya', nombre: 'Bebida de soya sin azúcar', grupo: 'leche', subgrupo: 'bebida vegetal', porcion: '1 taza', g: 243, kcal: 80, prot: 7, lip: 4, hc: 4, sat: 0.5, col: 0, na: 90, ca: 300, eq: { leche: 1 } },
  { ref: 'mx:bebida-de-almendra', nombre: 'Bebida de almendra sin azúcar', grupo: 'leche', subgrupo: 'bebida vegetal', porcion: '1 taza', g: 240, kcal: 39, prot: 1.5, lip: 2.9, hc: 1.4, sat: 0.2, col: 0, na: 170, ca: 450, eq: { aceites: 1 } },

  // ---------------------------------------------------------------------
  // Aceites y grasas — 1 equivalente ≈ 45 kcal, 5 g lípidos
  // ---------------------------------------------------------------------
  { ref: 'mx:aceite-de-canola', nombre: 'Aceite de canola', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '1 cucharadita', g: 5, kcal: 44, prot: 0, lip: 5, hc: 0, sat: 0.4, col: 0, na: 0, eq: { aceites: 1 } },
  { ref: 'mx:aceite-de-oliva', nombre: 'Aceite de oliva', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '1 cucharadita', g: 5, kcal: 44, prot: 0, lip: 5, hc: 0, sat: 0.7, col: 0, na: 0, eq: { aceites: 1 } },
  { ref: 'mx:aguacate', nombre: 'Aguacate', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '1/4 pieza', g: 34, kcal: 54, prot: 0.7, lip: 5, hc: 2.9, sat: 0.7, col: 0, fib: 2.3, na: 2, k: 165, fol: 27, vc: 3, eq: { aceites: 1 } },
  { ref: 'mx:crema-acida', nombre: 'Crema ácida', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '2 cucharadas', g: 30, kcal: 59, prot: 0.7, lip: 5.8, hc: 1.6, sat: 3.6, col: 18, na: 15, ca: 25, eq: { aceites: 1 } },
  { ref: 'mx:mantequilla', nombre: 'Mantequilla', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '1 cucharadita', g: 5, kcal: 36, prot: 0, lip: 4.1, hc: 0, sat: 2.6, col: 11, na: 32, eq: { aceites: 1 } },
  { ref: 'mx:mayonesa', nombre: 'Mayonesa', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '1 cucharadita', g: 5, kcal: 34, prot: 0, lip: 3.7, hc: 0.2, sat: 0.6, col: 3, na: 70, eq: { aceites: 1 } },
  { ref: 'mx:manteca-de-cerdo', nombre: 'Manteca de cerdo', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '1 cucharadita', g: 4, kcal: 36, prot: 0, lip: 4, hc: 0, sat: 1.6, col: 4, na: 0, eq: { aceites: 1 } },
  { ref: 'mx:aceituna', nombre: 'Aceitunas verdes', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '10 piezas', g: 33, kcal: 48, prot: 0.3, lip: 5, hc: 1.3, sat: 0.7, col: 0, fib: 1.1, na: 500, eq: { aceites: 1 } },
  { ref: 'mx:chia', nombre: 'Semillas de chía', grupo: 'aceites', subgrupo: 'con proteína', porcion: '1 cucharada', g: 12, kcal: 58, prot: 2, lip: 3.7, hc: 5, sat: 0.4, fib: 4.1, ca: 76, fe: 0.9, eq: { aceites: 1 } },
  { ref: 'mx:linaza', nombre: 'Linaza molida', grupo: 'aceites', subgrupo: 'con proteína', porcion: '1 cucharada', g: 7, kcal: 37, prot: 1.3, lip: 3, hc: 2, sat: 0.3, fib: 1.9, ca: 18, eq: { aceites: 1 } },
  { ref: 'mx:coco-rallado', nombre: 'Coco rallado sin azúcar', grupo: 'aceites', subgrupo: 'sin proteína', porcion: '2 cucharadas', g: 10, kcal: 66, prot: 0.7, lip: 6.5, hc: 2.4, sat: 5.8, fib: 1.6, na: 2, eq: { aceites: 1.5 } },
  { ref: 'mx:almendras', nombre: 'Almendras', grupo: 'aceites', subgrupo: 'con proteína', porcion: '10 piezas', g: 12, kcal: 69, prot: 2.5, lip: 6, hc: 2.6, sat: 0.5, fib: 1.5, na: 0, k: 87, ca: 32, fe: 0.4, eq: { aceites: 1.5 } },
  { ref: 'mx:cacahuates', nombre: 'Cacahuates tostados', grupo: 'aceites', subgrupo: 'con proteína', porcion: '14 piezas', g: 15, kcal: 87, prot: 3.5, lip: 7.5, hc: 2.4, sat: 1, fib: 1.3, na: 2, k: 100, fe: 0.7, eq: { aceites: 2 } },
  { ref: 'mx:nuez-de-castilla', nombre: 'Nuez de Castilla', grupo: 'aceites', subgrupo: 'con proteína', porcion: '4 mitades', g: 14, kcal: 92, prot: 2.1, lip: 9.2, hc: 1.9, sat: 0.9, fib: 0.9, na: 0, k: 62, eq: { aceites: 2 } },
  { ref: 'mx:pepitas', nombre: 'Pepitas de calabaza', grupo: 'aceites', subgrupo: 'con proteína', porcion: '2 cucharadas', g: 16, kcal: 91, prot: 4.7, lip: 7.8, hc: 2.5, sat: 1.4, fib: 1, na: 3, k: 128, fe: 2.3, eq: { aceites: 2 } },
  { ref: 'mx:semillas-de-girasol', nombre: 'Semillas de girasol', grupo: 'aceites', subgrupo: 'con proteína', porcion: '2 cucharadas', g: 16, kcal: 93, prot: 3.3, lip: 8.2, hc: 3.2, sat: 0.7, fib: 1.4, na: 1, k: 105, eq: { aceites: 2 } },
  { ref: 'mx:ajonjoli', nombre: 'Ajonjolí', grupo: 'aceites', subgrupo: 'con proteína', porcion: '2 cucharadas', g: 18, kcal: 103, prot: 3.2, lip: 8.9, hc: 4.2, sat: 1.2, fib: 2.1, na: 2, ca: 176, fe: 2.6, eq: { aceites: 2 } },
  { ref: 'mx:crema-de-cacahuate', nombre: 'Crema de cacahuate', grupo: 'aceites', subgrupo: 'con proteína', porcion: '1 cucharada', g: 16, kcal: 94, prot: 3.6, lip: 8, hc: 3.6, sat: 1.6, fib: 0.8, na: 74, k: 104, eq: { aceites: 2 } },

  // ---------------------------------------------------------------------
  // Azúcares — 1 equivalente ≈ 40 kcal, 10 g HC
  // ---------------------------------------------------------------------
  { ref: 'mx:azucar-de-mesa', nombre: 'Azúcar de mesa', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '2 cucharaditas', g: 8, kcal: 31, prot: 0, lip: 0, hc: 8, azu: 8, na: 0, eq: { azucares: 1 } },
  { ref: 'mx:miel', nombre: 'Miel de abeja', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '2 cucharaditas', g: 14, kcal: 43, prot: 0, lip: 0, hc: 11.6, azu: 11.6, na: 1, eq: { azucares: 1 } },
  { ref: 'mx:piloncillo', nombre: 'Piloncillo', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '1 cucharada', g: 12, kcal: 45, prot: 0, lip: 0, hc: 11.6, azu: 11.4, ca: 10, fe: 0.2, eq: { azucares: 1 } },
  { ref: 'mx:mermelada', nombre: 'Mermelada', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '1 cucharada', g: 20, kcal: 56, prot: 0, lip: 0, hc: 13.8, azu: 9.7, na: 6, eq: { azucares: 1.5 } },
  { ref: 'mx:cajeta', nombre: 'Cajeta', grupo: 'azucares', subgrupo: 'con grasa', porcion: '1 cucharada', g: 20, kcal: 65, prot: 1.2, lip: 1.5, hc: 12, sat: 0.9, azu: 11, na: 30, ca: 45, eq: { azucares: 1.5 } },
  { ref: 'mx:chocolate-de-mesa', nombre: 'Chocolate de mesa', grupo: 'azucares', subgrupo: 'con grasa', porcion: '1/2 tablilla', g: 20, kcal: 90, prot: 0.8, lip: 3, hc: 15.6, sat: 1.8, azu: 14, na: 5, eq: { azucares: 1.5, aceites: 0.5 } },
  { ref: 'mx:refresco-de-cola', nombre: 'Refresco de cola', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '1 vaso (240 ml)', g: 248, kcal: 101, prot: 0, lip: 0, hc: 26, azu: 26, na: 10, eq: { azucares: 2.5 } },
  { ref: 'mx:jugo-industrial', nombre: 'Jugo industrial de manzana', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '1 vaso (240 ml)', g: 248, kcal: 114, prot: 0.2, lip: 0.3, hc: 28, azu: 24, na: 10, k: 250, vc: 60, eq: { azucares: 3 } },
  { ref: 'mx:gelatina-de-sabor', nombre: 'Gelatina de sabor preparada', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '1/2 taza', g: 120, kcal: 84, prot: 1.7, lip: 0, hc: 19, azu: 18, na: 60, eq: { azucares: 2 } },
  { ref: 'mx:paleta-de-hielo', nombre: 'Paleta de hielo de agua', grupo: 'azucares', subgrupo: 'sin grasa', porcion: '1 pieza', g: 66, kcal: 50, prot: 0, lip: 0, hc: 13, azu: 11, na: 5, eq: { azucares: 1 } },

  // ---------------------------------------------------------------------
  // Libres de energía — no suman equivalentes, sí aparecen en el plan
  // ---------------------------------------------------------------------
  { ref: 'mx:cafe-americano', nombre: 'Café americano sin azúcar', grupo: 'libres', porcion: '1 taza', g: 240, kcal: 2, prot: 0.3, lip: 0, hc: 0, na: 5, k: 116, eq: {} },
  { ref: 'mx:te-de-manzanilla', nombre: 'Té de manzanilla', grupo: 'libres', porcion: '1 taza', g: 240, kcal: 2, prot: 0, lip: 0, hc: 0.5, na: 2, eq: {} },
  { ref: 'mx:agua-mineral', nombre: 'Agua mineral', grupo: 'libres', porcion: '1 vaso', g: 240, kcal: 0, prot: 0, lip: 0, hc: 0, na: 25, ca: 8, eq: {} },
  { ref: 'mx:vinagre', nombre: 'Vinagre', grupo: 'libres', porcion: '1 cucharada', g: 15, kcal: 3, prot: 0, lip: 0, hc: 0.1, na: 1, eq: {} },
  { ref: 'mx:salsa-verde', nombre: 'Salsa verde cruda', grupo: 'libres', porcion: '2 cucharadas', g: 30, kcal: 8, prot: 0.3, lip: 0.2, hc: 1.5, na: 100, vc: 3, eq: {} },
  { ref: 'mx:chile-serrano', nombre: 'Chile serrano crudo', grupo: 'libres', porcion: '1 pieza', g: 15, kcal: 6, prot: 0.3, lip: 0.1, hc: 1.3, fib: 0.7, na: 1, vc: 13, eq: {} },
  { ref: 'mx:cilantro', nombre: 'Cilantro fresco', grupo: 'libres', porcion: '1/4 taza', g: 4, kcal: 1, prot: 0.1, lip: 0, hc: 0.1, na: 2, va: 14, eq: {} },
  { ref: 'mx:epazote', nombre: 'Epazote fresco', grupo: 'libres', porcion: '2 ramas', g: 5, kcal: 2, prot: 0.1, lip: 0, hc: 0.4, eq: {} },
  { ref: 'mx:caldo-desgrasado', nombre: 'Caldo de pollo desgrasado', grupo: 'libres', porcion: '1 taza', g: 240, kcal: 15, prot: 1.5, lip: 0.5, hc: 1, na: 860, eq: {} },
  { ref: 'mx:jugo-de-limon', nombre: 'Jugo de limón', grupo: 'libres', porcion: '1 cucharada', g: 15, kcal: 3, prot: 0.1, lip: 0, hc: 1, na: 0, vc: 7, eq: {} },
];
