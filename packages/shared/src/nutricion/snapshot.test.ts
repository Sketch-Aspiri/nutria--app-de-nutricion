import { VERSION_SNAPSHOT, construirSnapshotCalculo } from './snapshot';
import type { DatosSnapshot } from './snapshot';

const datos: DatosSnapshot = {
  peso: 78.5,
  altura: 162,
  edad: 34,
  genero: 'Femenino',
  nivelActividad: 'Ligero',
  objetivo: 'Pérdida de grasa',
  cintura: 92,
  cadera: 104,
  condiciones: ['Hipertensión'],
};

const FECHA = new Date('2026-07-22T15:00:00.000Z');

describe('construirSnapshotCalculo', () => {
  it('deja registradas las entradas junto al resultado, para poder auditarlo', () => {
    const snapshot = construirSnapshotCalculo(datos, FECHA);

    expect(snapshot.version).toBe(VERSION_SNAPSHOT);
    expect(snapshot.calculadoEn).toBe('2026-07-22T15:00:00.000Z');
    expect(snapshot.entradas).toMatchObject({
      peso: 78.5,
      altura: 162,
      edad: 34,
      objetivo: 'Pérdida de grasa',
      condiciones: ['Hipertensión'],
      usarPesoAjustado: false,
      modoProteina: 'porcentaje',
    });
    expect(snapshot.resultado.objetivoCalorias).toBeGreaterThan(0);
  });

  it('resume la antropometría con IMC, índices de riesgo y peso ideal', () => {
    const { antropometria } = construirSnapshotCalculo(datos, FECHA);

    expect(antropometria.imc).toBeCloseTo(29.9, 1);
    expect(antropometria.clasificacion.categoria).toBe('Sobrepeso');
    expect(antropometria.cinturaCadera?.riesgo).toBe('alto');
    // 92 / 162 = 0.57: por encima de 0.5, todavía por debajo de 0.6.
    expect(antropometria.cinturaTalla?.riesgo).toBe('aumentado');
    expect(antropometria.pesoIdeal.porImc).toBeGreaterThan(0);
    expect(antropometria.requierePesoAjustado).toBe(false);
  });

  it('omite los índices que dependen de medidas ausentes, sin inventarlos', () => {
    const { antropometria } = construirSnapshotCalculo(
      { ...datos, cintura: undefined, cadera: undefined },
      FECHA,
    );

    expect(antropometria.cinturaCadera).toBeNull();
    expect(antropometria.cinturaTalla).toBeNull();
    expect(antropometria.grasa).toBeNull();
  });

  it('deriva el % de grasa de los pliegues cuando no hay uno capturado', () => {
    const { antropometria, entradas } = construirSnapshotCalculo(
      {
        ...datos,
        pliegues: { tricipital: 22, bicipital: 12, subescapular: 24, suprailiaco: 26 },
      },
      FECHA,
    );

    expect(antropometria.grasa?.origen).toBe('pliegues');
    expect(antropometria.grasa?.grasaPct).toBeGreaterThan(0);
    expect(entradas.grasaPct).toBe(antropometria.grasa?.grasaPct);
  });

  it('el % de grasa capturado gana sobre el estimado por pliegues', () => {
    const { antropometria } = construirSnapshotCalculo(
      {
        ...datos,
        grasaPct: 33,
        pliegues: { tricipital: 22, bicipital: 12, subescapular: 24, suprailiaco: 26 },
      },
      FECHA,
    );

    expect(antropometria.grasa?.origen).toBe('medido');
    expect(antropometria.grasa?.grasaPct).toBe(33);
  });

  it('habilita Katch-McArdle en la comparativa cuando hay pliegues', () => {
    const sinPliegues = construirSnapshotCalculo(datos, FECHA);
    const conPliegues = construirSnapshotCalculo(
      {
        ...datos,
        pliegues: { tricipital: 22, bicipital: 12, subescapular: 24, suprailiaco: 26 },
      },
      FECHA,
    );

    const buscarKatch = (s: typeof sinPliegues) =>
      s.comparativa.find((fila) => fila.ecuacion === 'katch_mcardle');

    expect(buscarKatch(sinPliegues)?.disponible).toBe(false);
    expect(buscarKatch(conPliegues)?.disponible).toBe(true);
  });

  it('reparte las calorías del resultado en equivalentes SMAE', () => {
    const { resultado, equivalentes } = construirSnapshotCalculo(datos, FECHA);

    expect(equivalentes.renglones.length).toBeGreaterThan(0);
    expect(equivalentes.totales.kcal).toBeGreaterThan(0);
    expect(Math.abs(equivalentes.totales.kcal - resultado.objetivoCalorias)).toBeLessThan(
      resultado.objetivoCalorias * 0.1,
    );
  });

  it('es serializable a JSON sin pérdida: es lo que se guarda en el plan', () => {
    const snapshot = construirSnapshotCalculo(datos, FECHA);

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('el mismo expediente produce el mismo snapshot', () => {
    expect(construirSnapshotCalculo(datos, FECHA)).toEqual(
      construirSnapshotCalculo(datos, FECHA),
    );
  });

  it('propaga el fallo cuando el expediente no tiene medidas', () => {
    expect(() => construirSnapshotCalculo({ ...datos, peso: 0 }, FECHA)).toThrow(
      'EXPEDIENTE_INCOMPLETO',
    );
  });
});
