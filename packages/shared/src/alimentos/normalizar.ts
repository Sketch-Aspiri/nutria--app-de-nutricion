/**
 * Normalización y sinónimos para la búsqueda de alimentos.
 *
 * La columna `nombre_normalizado` de la base se llena con `normalizarNombre`,
 * y la búsqueda difusa (pg_trgm) compara contra ella. Que ambos lados usen
 * exactamente esta función es lo que hace que "Plátano" encuentre "platano".
 */

/** Minúsculas, sin acentos, sin puntuación y con espacios colapsados. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Términos que nombran lo mismo en México y fuera de México.
 *
 * pg_trgm resuelve la variante ortográfica ("jitomate" ≈ "jitomates"), pero no
 * la sinonimia: "jitomate" y "tomate rojo" no comparten suficientes trigramas.
 * Cada grupo se expande a todas sus variantes antes de consultar.
 */
export const SINONIMOS_ALIMENTO: string[][] = [
  ['jitomate', 'tomate rojo'],
  ['tomate verde', 'tomatillo'],
  ['elote', 'maiz'],
  ['ejote', 'judia verde'],
  ['camote', 'batata'],
  ['chicharo', 'guisante'],
  ['aguacate', 'palta'],
  ['platano', 'banana'],
  ['betabel', 'remolacha'],
  ['durazno', 'melocoton'],
  ['chabacano', 'albaricoque'],
  ['cacahuate', 'mani'],
  ['papa', 'patata'],
  ['calabacita', 'calabacin'],
  ['pimiento morron', 'chile morron'],
  ['pina', 'anana'],
  ['toronja', 'pomelo'],
  ['crema de cacahuate', 'mantequilla de mani'],
  ['carne de res', 'carne de vaca'],
  ['refresco', 'gaseosa'],
];

/**
 * Devuelve la consulta normalizada seguida de sus variantes por sinonimia.
 *
 * El primer elemento siempre es lo que el nutriólogo escribió: quien consulta
 * puede darle más peso que a las variantes al ordenar los resultados.
 */
export function expandirBusqueda(texto: string): string[] {
  const base = normalizarNombre(texto);
  if (!base) return [];

  const variantes = new Set<string>();

  for (const grupo of SINONIMOS_ALIMENTO) {
    const presente = grupo.find((termino) => palabraCompleta(termino).test(base));
    if (!presente) continue;

    for (const alterno of grupo) {
      if (alterno === presente) continue;
      variantes.add(base.replace(palabraCompleta(presente), alterno));
    }
  }

  variantes.delete(base);
  return [base, ...variantes];
}

/**
 * El sinónimo tiene que casar como palabra: "papa" no puede convertir
 * "papaya" en "patataya". Los términos ya vienen normalizados (solo letras,
 * dígitos y espacios), así que no hay metacaracteres que escapar.
 */
function palabraCompleta(termino: string): RegExp {
  return new RegExp(`\\b${termino}\\b`);
}
