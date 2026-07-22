import type { NivelActividad, Objetivo } from './types';

export const CONDICIONES: string[] = [
  'Diabetes tipo 1',
  'Diabetes tipo 2',
  'Hipertensión',
  'Hipotiroidismo',
  'Dislipidemia',
  'Enfermedad renal',
  'Ninguna',
];

export const ALERGIAS_COMUNES: string[] = [
  'Lactosa',
  'Gluten',
  'Mariscos',
  'Frutos secos',
  'Huevo',
  'Soya',
  'Ninguna',
];

export const TIPOS_DIETA: string[] = [
  'Omnívoro',
  'Vegetariano',
  'Vegano',
  'Keto',
  'Mediterránea',
  'Sin gluten',
];

export const NIVELES_ACTIVIDAD: NivelActividad[] = [
  'Sedentario',
  'Ligero',
  'Moderado',
  'Activo',
  'Muy activo',
];

export const OBJETIVOS: Objetivo[] = [
  'Pérdida de grasa',
  'Ganancia muscular',
  'Mantenimiento',
  'Control de diabetes',
  'Mejora deportiva',
  'Otro',
];
