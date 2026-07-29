/**
 * @jest-environment node
 */
import { esRutaActiva } from '@/components/nav/BottomNav';

/**
 * Estado activo de la barra inferior.
 *
 * Se prueba la función pura, no el render: lo único que puede fallar aquí es la
 * comparación de rutas —y con `/` de por medio, un `startsWith` ingenuo dejaría
 * "Hoy" encendido en todas las pantallas—. El resto de `BottomNav` son enlaces
 * y clases de Tailwind, sin lógica que valga un jsdom.
 */

describe('esRutaActiva', () => {
  it('enciende Hoy solo en la raíz', () => {
    expect(esRutaActiva('/', '/')).toBe(true);
  });

  it.each(['/plan', '/progreso', '/mensajes', '/perfil'])(
    'no deja Hoy encendido en %s',
    (pathname) => {
      // El bug clásico: `'/plan'.startsWith('/')` es verdadero.
      expect(esRutaActiva(pathname, '/')).toBe(false);
    },
  );

  it.each([
    ['/plan', '/plan'],
    ['/progreso', '/progreso'],
    ['/mensajes', '/mensajes'],
  ])('enciende %s en su propia ruta', (pathname, href) => {
    expect(esRutaActiva(pathname, href)).toBe(true);
  });

  it('sigue encendido en las subrutas de la sección', () => {
    // La fase 8 abre el detalle de receta bajo /plan; la pestaña no debe apagarse.
    expect(esRutaActiva('/plan/recetas/42', '/plan')).toBe(true);
  });

  it('no confunde secciones con prefijo común', () => {
    expect(esRutaActiva('/planeta', '/plan')).toBe(false);
  });

  it('solo enciende un destino a la vez', () => {
    const destinos = ['/', '/plan', '/progreso', '/mensajes'];
    const activos = destinos.filter((href) => esRutaActiva('/progreso', href));
    expect(activos).toEqual(['/progreso']);
  });
});
