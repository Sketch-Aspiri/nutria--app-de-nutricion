/**
 * Design tokens compartidos entre apps/web y apps/mobile.
 * La web los consume vía Tailwind; mobile los importa directamente.
 */
export const colors = {
  brand: {
    deep: '#022c22', // emerald-950 — fondos de sidebar/login
    primary: '#064e3b', // emerald-900 — botones y acentos
    primaryHover: '#065f46', // emerald-800
    accent: '#84cc16', // lime-500 — rachas, éxito
    accentSoft: '#ecfccb', // lime-50
  },
  neutral: {
    bg: '#fafaf9', // stone-50
    border: '#e7e5e4', // stone-200
    textMuted: '#a8a29e', // stone-400
    text: '#57534e', // stone-600
  },
  warning: '#ea580c', // orange-600 — alertas de adherencia/alergias
  brandPalette: ['#166534', '#0f766e', '#7c3aed', '#be123c', '#c2410c', '#1d4ed8'],
} as const;

export const typography = {
  display: "'Fraunces', serif",
  body: "'Inter', sans-serif",
  mono: "'IBM Plex Mono', monospace",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
