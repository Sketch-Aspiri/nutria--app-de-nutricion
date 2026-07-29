/**
 * Clases de formulario de la app del paciente.
 *
 * Más altas que las del panel (`py-3` contra `py-2`): esto se llena con el
 * pulgar en un teléfono, y 44 px es el mínimo táctil cómodo. El tamaño de
 * fuente es 16 px porque iOS hace zoom automático en cualquier input con
 * texto más chico, y ese zoom desencuadra la pantalla.
 */
export const inputClass =
  'w-full border border-stone-200 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:border-emerald-400';

export const labelClass = 'text-xs text-stone-500 mb-1.5 block';
