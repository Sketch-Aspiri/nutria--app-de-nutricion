/**
 * Módulo de suscripciones compartido: catálogo de planes, topes y el cálculo de
 * entitlements. Solo reglas puras — ni la llave de Stripe ni llamadas HTTP
 * viven aquí, eso es servidor.
 */

export * from './planes';
