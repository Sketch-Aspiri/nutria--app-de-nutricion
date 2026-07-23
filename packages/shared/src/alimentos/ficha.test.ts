import {
  CAMPOS_NUTRIMENTOS,
  NOMBRE_NUTRIMENTO,
  escalarAlimento,
  sumarNutrimentos,
  verificarEnergia,
  type AlimentoFicha,
  type Nutrimentos,
} from './ficha';

/** Tortilla de maíz: una porción = 1 equivalente de cereal. */
const TORTILLA: Pick<AlimentoFicha, 'porcion_gramos' | 'equivalentes'> & Nutrimentos = {
  porcion_gramos: 30,
  equivalentes: { cereales: 1 },
  energia_kcal: 70,
  proteina_g: 1.8,
  lipidos_g: 0.8,
  carbohidratos_g: 14.4,
  saturadas_g: 0.1,
  colesterol_mg: 0,
  fibra_g: 1.7,
  azucar_g: 0.4,
  sodio_mg: 3,
  potasio_mg: 55,
  calcio_mg: 46,
  hierro_mg: 0.4,
  acido_folico_ug: 1,
  vitamina_a_ug: 0,
  // Sodio conocido pero vitamina C sin capturar: el caso que importa probar.
  vitamina_c_mg: null,
};

describe('escalarAlimento', () => {
  it('multiplica energía, macros y gramos por la cantidad de porciones', () => {
    const dos = escalarAlimento(TORTILLA, 2);

    expect(dos.energia_kcal).toBe(140);
    expect(dos.proteina_g).toBe(3.6);
    expect(dos.carbohidratos_g).toBe(28.8);
    expect(dos.gramos).toBe(60);
  });

  it('escala también los equivalentes declarados', () => {
    expect(escalarAlimento(TORTILLA, 3).equivalentes).toEqual({ cereales: 3 });
  });

  it('acepta media porción', () => {
    const media = escalarAlimento(TORTILLA, 0.5);

    expect(media.energia_kcal).toBe(35);
    expect(media.equivalentes).toEqual({ cereales: 0.5 });
  });

  it('mantiene en null lo que no está capturado, no lo convierte en cero', () => {
    expect(escalarAlimento(TORTILLA, 2).vitamina_c_mg).toBeNull();
  });

  it('distingue un cero capturado de un dato ausente', () => {
    const escalado = escalarAlimento(TORTILLA, 2);

    expect(escalado.colesterol_mg).toBe(0);
    expect(escalado.vitamina_c_mg).toBeNull();
  });

  it('devuelve todo en cero cuando la cantidad es cero', () => {
    expect(escalarAlimento(TORTILLA, 0).energia_kcal).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza la cantidad inválida %p',
    (porciones) => {
      expect(() => escalarAlimento(TORTILLA, porciones)).toThrow(/porciones/i);
    },
  );

  it('redondea a dos decimales para no arrastrar ruido de punto flotante', () => {
    expect(escalarAlimento(TORTILLA, 1 / 3).proteina_g).toBe(0.6);
  });
});

describe('sumarNutrimentos', () => {
  const frijol = escalarAlimento(
    {
      ...TORTILLA,
      porcion_gramos: 90,
      equivalentes: { leguminosas: 1 },
      energia_kcal: 120,
      proteina_g: 8,
      lipidos_g: 1,
      carbohidratos_g: 20,
      vitamina_c_mg: 0,
    },
    1,
  );

  it('suma las porciones escaladas de una comida', () => {
    const total = sumarNutrimentos([escalarAlimento(TORTILLA, 2), frijol]);

    expect(total.energia_kcal).toBe(260);
    expect(total.proteina_g).toBe(11.6);
    expect(total.gramos).toBe(150);
  });

  it('acumula los equivalentes por grupo', () => {
    const total = sumarNutrimentos([escalarAlimento(TORTILLA, 2), frijol]);

    expect(total.equivalentes).toEqual({ cereales: 2, leguminosas: 1 });
  });

  it('reporta como incompleto el nutrimento que algún alimento no tenía', () => {
    const total = sumarNutrimentos([escalarAlimento(TORTILLA, 1), frijol]);

    expect(total.incompletos).toContain('vitamina_c_mg');
    expect(total.incompletos).not.toContain('proteina_g');
  });

  it('no marca incompleto lo que todos los alimentos sí tenían', () => {
    expect(sumarNutrimentos([frijol]).incompletos).toEqual([]);
  });

  it('devuelve ceros y ningún faltante para una comida vacía', () => {
    const total = sumarNutrimentos([]);

    expect(total.energia_kcal).toBe(0);
    expect(total.equivalentes).toEqual({});
    expect(total.incompletos).toEqual([]);
  });
});

describe('verificarEnergia', () => {
  it('aprueba la ficha cuyos macronutrimentos explican su energía', () => {
    const revision = verificarEnergia(TORTILLA);

    expect(revision.coherente).toBe(true);
    expect(revision.motivo).toBeNull();
  });

  it('atrapa el dígito de más en la energía', () => {
    const revision = verificarEnergia({
      energia_kcal: 700,
      proteina_g: 1.8,
      lipidos_g: 0.8,
      carbohidratos_g: 14.4,
    });

    expect(revision.coherente).toBe(false);
    expect(revision.motivo).toMatch(/700 kcal/);
  });

  it('atrapa el dígito de más en un macronutrimento', () => {
    expect(
      verificarEnergia({
        energia_kcal: 70,
        proteina_g: 1.8,
        lipidos_g: 80,
        carbohidratos_g: 14.4,
      }).coherente,
    ).toBe(false);
  });

  it('tolera la diferencia que meten fibra y polioles en un alimento chico', () => {
    // Fresas: 49 kcal declaradas contra 55 por Atwater.
    expect(
      verificarEnergia({
        energia_kcal: 49,
        proteina_g: 1,
        lipidos_g: 0.5,
        carbohidratos_g: 11.7,
      }).coherente,
    ).toBe(true);
  });

  it('acepta un alimento libre de energía', () => {
    expect(
      verificarEnergia({
        energia_kcal: 2,
        proteina_g: 0.3,
        lipidos_g: 0,
        carbohidratos_g: 0,
      }).coherente,
    ).toBe(true);
  });

  it('reporta las kcal que implican los macronutrimentos', () => {
    const revision = verificarEnergia({
      energia_kcal: 100,
      proteina_g: 10,
      lipidos_g: 10,
      carbohidratos_g: 10,
    });

    expect(revision.kcal_macronutrimentos).toBe(170);
  });
});

describe('catálogo de nutrimentos', () => {
  it('nombra en la UI todos los campos que se calculan', () => {
    for (const campo of CAMPOS_NUTRIMENTOS) {
      expect(NOMBRE_NUTRIMENTO[campo]).toBeTruthy();
    }
  });

  it('no declara nombres para campos que ya no existen', () => {
    expect(Object.keys(NOMBRE_NUTRIMENTO).sort()).toEqual([...CAMPOS_NUTRIMENTOS].sort());
  });
});
