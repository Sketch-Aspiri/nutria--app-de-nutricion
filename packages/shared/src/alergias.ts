const SIN_ALERGIA = 'Ninguna';

/**
 * Detecta si un texto (descripción de comida/receta) menciona alguna alergia del paciente.
 * "Ninguna" nunca genera conflicto. La comparación ignora mayúsculas.
 * Es una heurística de apoyo para el nutriólogo, no una validación clínica definitiva.
 */
export function tieneConflictoAlergia(texto: string | null | undefined, alergias: string[]): boolean {
  if (!texto) return false;
  const t = texto.toLowerCase();
  return alergias.some((a) => a !== SIN_ALERGIA && t.includes(a.toLowerCase()));
}
