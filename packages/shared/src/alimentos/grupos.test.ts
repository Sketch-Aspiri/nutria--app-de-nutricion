import { GRUPOS_SMAE } from '../nutricion/equivalentes';

import {
  esGrupoAlimento,
  GRUPOS_ALIMENTO,
  NOMBRE_FUENTE,
  NOMBRE_GRUPO_ALIMENTO,
} from './grupos';

describe('GRUPOS_ALIMENTO', () => {
  it('contiene los ocho grupos de equivalentes más los alimentos libres', () => {
    expect(GRUPOS_ALIMENTO).toEqual([...GRUPOS_SMAE, 'libres']);
  });

  it('nombra en la UI todos los grupos que se pueden guardar', () => {
    for (const grupo of GRUPOS_ALIMENTO) {
      expect(NOMBRE_GRUPO_ALIMENTO[grupo]).toBeTruthy();
    }
  });

  it('no declara nombres para grupos que no existen', () => {
    expect(Object.keys(NOMBRE_GRUPO_ALIMENTO).sort()).toEqual([...GRUPOS_ALIMENTO].sort());
  });
});

describe('esGrupoAlimento', () => {
  it.each(GRUPOS_ALIMENTO)('acepta %s', (grupo) => {
    expect(esGrupoAlimento(grupo)).toBe(true);
  });

  it.each([['Verduras'], ['lacteos'], [''], [null], [undefined], [3], [{}]])(
    'rechaza %p',
    (valor) => {
      expect(esGrupoAlimento(valor)).toBe(false);
    },
  );
});

describe('NOMBRE_FUENTE', () => {
  it('explica de dónde salió el dato para poder auditarlo', () => {
    expect(NOMBRE_FUENTE.usda).toMatch(/USDA/);
    expect(NOMBRE_FUENTE.propia).toMatch(/nutriólogo/i);
  });
});
