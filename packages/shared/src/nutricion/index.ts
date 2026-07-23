/**
 * Módulo de nutrición: fórmulas clínicas puras, sin dependencias de UI ni de
 * base de datos. Las importan tanto `apps/web` (cliente y handlers de API)
 * como `apps/mobile`; ninguna de las dos duplica la aritmética.
 */

export * from './antropometria';
export * from './calculo';
export * from './energia';
export * from './equivalentes';
export * from './requerimientos';
export * from './snapshot';
