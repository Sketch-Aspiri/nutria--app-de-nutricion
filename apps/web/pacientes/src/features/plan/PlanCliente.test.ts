/**
 * @jest-environment node
 */
import { vistaValida } from './PlanCliente';

/**
 * Solo la función pura: el resto de `PlanCliente` son tres enlaces y clases de
 * Tailwind, y cada sección tiene su propia suite. Lo que sí puede fallar aquí es
 * que una `?vista=` manipulada deje la pantalla en blanco.
 */
describe('vistaValida', () => {
  it.each(['comidas', 'recetas', 'actividad'] as const)('respeta la vista %s', (vista) => {
    expect(vistaValida(vista)).toBe(vista);
  });

  it.each([null, undefined, '', 'RECETAS', 'perfil', '../plan'])(
    'cae en comidas con %p',
    (valor) => {
      expect(vistaValida(valor)).toBe('comidas');
    },
  );
});
