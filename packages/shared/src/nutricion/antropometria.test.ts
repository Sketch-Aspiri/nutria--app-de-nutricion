import {
  clasificarImc,
  grasaCorporalDurninWomersley,
  imc,
  indiceCinturaCadera,
  indiceCinturaTalla,
  masaMagra,
  pesoAjustado,
  pesoIdeal,
  requierePesoAjustado,
} from './antropometria';

describe('imc', () => {
  it('calcula peso entre talla al cuadrado con un decimal', () => {
    expect(imc(68, 165)).toBe(25);
    expect(imc(95, 170)).toBe(32.9);
  });

  it('rechaza medidas faltantes', () => {
    expect(() => imc(0, 165)).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => imc(68, 0)).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});

describe('clasificarImc', () => {
  it.each([
    [17, 'Bajo peso'],
    [22, 'Peso normal'],
    [27, 'Sobrepeso'],
    [32, 'Obesidad grado I'],
    [37, 'Obesidad grado II'],
    [42, 'Obesidad grado III'],
  ])('clasifica un IMC de %s como "%s" con los cortes de la OMS', (valor, categoria) => {
    expect(clasificarImc(valor).categoria).toBe(categoria);
  });

  it('aplica el corte de talla baja de la NOM-008 en mujer de menos de 150 cm', () => {
    const resultado = clasificarImc(27, { alturaCm: 145, genero: 'Femenino' });

    expect(resultado.categoria).toBe('Obesidad (talla baja)');
    expect(resultado.cortesTallaBaja).toBe(true);
  });

  it('aplica el corte de talla baja en hombre de menos de 160 cm', () => {
    expect(clasificarImc(27, { alturaCm: 155, genero: 'Masculino' }).cortesTallaBaja).toBe(true);
  });

  it('no aplica el corte de talla baja con estatura suficiente', () => {
    const resultado = clasificarImc(27, { alturaCm: 165, genero: 'Femenino' });

    expect(resultado.categoria).toBe('Sobrepeso');
    expect(resultado.cortesTallaBaja).toBe(false);
  });

  it('no altera la clasificación de peso normal en talla baja', () => {
    expect(clasificarImc(22, { alturaCm: 145, genero: 'Femenino' }).categoria).toBe('Peso normal');
  });
});

describe('indiceCinturaCadera', () => {
  it('marca riesgo desde 0.85 en mujer', () => {
    expect(indiceCinturaCadera(92, 104, 'Femenino')).toMatchObject({ valor: 0.88, riesgo: 'alto' });
    expect(indiceCinturaCadera(80, 100, 'Femenino').riesgo).toBe('normal');
  });

  it('marca riesgo desde 0.90 en hombre', () => {
    expect(indiceCinturaCadera(88, 100, 'Masculino').riesgo).toBe('normal');
    expect(indiceCinturaCadera(95, 100, 'Masculino').riesgo).toBe('alto');
  });

  it('rechaza medidas faltantes', () => {
    expect(() => indiceCinturaCadera(0, 100, 'Femenino')).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});

describe('indiceCinturaTalla', () => {
  it('marca riesgo aumentado a partir de 0.5 y alto a partir de 0.6', () => {
    expect(indiceCinturaTalla(75, 165).riesgo).toBe('normal');
    expect(indiceCinturaTalla(90, 165).riesgo).toBe('aumentado');
    expect(indiceCinturaTalla(105, 165).riesgo).toBe('alto');
  });
});

describe('grasaCorporalDurninWomersley', () => {
  const pliegues = { tricipital: 12, bicipital: 10, subescapular: 14, suprailiaco: 16 };

  it('convierte la suma de los cuatro pliegues en % de grasa vía Siri', () => {
    const resultado = grasaCorporalDurninWomersley(pliegues, 29, 'Femenino', 68);

    expect(resultado.sumaPliegues).toBe(52);
    expect(resultado.grasaPct).toBeCloseTo(27.4, 1);
    expect(resultado.masaGrasaKg).toBeCloseTo(18.6, 1);
    expect(resultado.masaMagraKg).toBeCloseTo(49.4, 1);
  });

  it('estima menos grasa en hombre con los mismos pliegues', () => {
    const mujer = grasaCorporalDurninWomersley(pliegues, 29, 'Femenino');
    const hombre = grasaCorporalDurninWomersley(pliegues, 29, 'Masculino');

    expect(hombre.grasaPct).toBeLessThan(mujer.grasaPct);
  });

  it('sube el % estimado con la edad, a igual suma de pliegues', () => {
    const joven = grasaCorporalDurninWomersley(pliegues, 25, 'Femenino');
    const mayor = grasaCorporalDurninWomersley(pliegues, 55, 'Femenino');

    expect(mayor.grasaPct).toBeGreaterThan(joven.grasaPct);
  });

  it('exige los cuatro pliegues: con tres la ecuación quedaría sesgada', () => {
    expect(() =>
      grasaCorporalDurninWomersley({ ...pliegues, suprailiaco: undefined }, 29, 'Femenino'),
    ).toThrow('EXPEDIENTE_INCOMPLETO');
  });

  it('devuelve masas en nulo cuando no se pasa el peso', () => {
    const resultado = grasaCorporalDurninWomersley(pliegues, 29, 'Femenino');

    expect(resultado.masaGrasaKg).toBeNull();
    expect(resultado.masaMagraKg).toBeNull();
  });
});

describe('masaMagra', () => {
  it('descuenta el porcentaje de grasa del peso', () => {
    expect(masaMagra(68, 28)).toBeCloseTo(49, 1);
  });

  it('rechaza un porcentaje imposible', () => {
    expect(() => masaMagra(68, 0)).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => masaMagra(68, 100)).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});

describe('pesoIdeal', () => {
  it('sitúa el peso ideal en IMC 22 y el rango entre 18.5 y 24.9', () => {
    const resultado = pesoIdeal(165, 'Femenino');

    expect(resultado.porImc).toBeCloseTo(59.9, 1);
    expect(resultado.rangoSaludable.min).toBeCloseTo(50.4, 1);
    expect(resultado.rangoSaludable.max).toBeCloseTo(67.8, 1);
    expect(resultado.porImc).toBeGreaterThan(resultado.rangoSaludable.min);
    expect(resultado.porImc).toBeLessThan(resultado.rangoSaludable.max);
  });

  it('da un peso de Hamwi mayor en hombre que en mujer a igual talla', () => {
    expect(pesoIdeal(170, 'Masculino').hamwi).toBeGreaterThan(pesoIdeal(170, 'Femenino').hamwi);
  });
});

describe('pesoAjustado', () => {
  it('suma un cuarto del exceso al peso ideal', () => {
    // 60 + 0.25 * (100 - 60) = 70
    expect(pesoAjustado(100, 60)).toBe(70);
  });

  it('queda entre el peso ideal y el real', () => {
    const ajustado = pesoAjustado(95, 60);

    expect(ajustado).toBeGreaterThan(60);
    expect(ajustado).toBeLessThan(95);
  });

  it('solo se recomienda a partir de obesidad', () => {
    expect(requierePesoAjustado(31)).toBe(true);
    expect(requierePesoAjustado(28)).toBe(false);
  });
});
