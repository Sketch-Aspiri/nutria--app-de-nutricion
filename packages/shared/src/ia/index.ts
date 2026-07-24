/**
 * Módulo de IA compartido: solo reglas puras (seudonimización, cuotas, parseo).
 * Ni la llave del proveedor ni las llamadas HTTP viven aquí — eso es servidor.
 */

export * from './json';
export * from './limites';
export * from './seudonimizar';
