import type { Config } from 'tailwindcss';

/**
 * Mismas familias tipográficas que el panel, cargadas con `next/font` en el
 * layout: el prototipo las inyectaba con un `<link>` dentro de un `useEffect`,
 * lo que producía un parpadeo en cada carga y una petición a Google desde el
 * navegador del paciente.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      maxWidth: {
        // Ancho de la app. El prototipo dibujaba un teléfono de 390 px; aquí es
        // una app web real que en una pantalla grande se centra en vez de
        // estirarse, sin marco ni notch decorativos.
        app: '480px',
      },
      spacing: {
        // Alto de la navegación inferior, para que el contenido no quede
        // debajo de ella al final del scroll.
        nav: '4.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
