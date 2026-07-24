/**
 * Extrae y parsea el JSON de una respuesta de LLM que puede venir envuelta
 * en fences de markdown (```json ... ```). Lanza SyntaxError si no es JSON válido.
 */
export function extraerJSON<T>(texto: string): T {
  const limpio = texto.replace(/```json|```/g, '').trim();
  return JSON.parse(limpio) as T;
}
