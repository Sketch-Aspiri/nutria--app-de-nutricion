import {
  cambioDePeso,
  conteoDeLogros,
  fechaCorta,
  formatearKg,
  geometriaDeGrafica,
  GRAFICA,
  porcentajeDeLogro,
  serieDePesos,
} from './calculos';
import type { Logro, RegistroPeso } from './types';

function peso(fecha: string, pesoKg: number): RegistroPeso {
  return {
    id: `peso-${fecha}`,
    fecha,
    peso_kg: pesoKg,
    created_at: `${fecha}T12:00:00.000Z`,
  };
}

describe('serieDePesos', () => {
  it('ordena por fecha aunque el servidor cambie de criterio', () => {
    const serie = serieDePesos([peso('2026-07-10', 70), peso('2026-07-01', 73)]);

    expect(serie.map((registro) => registro.fecha)).toEqual(['2026-07-01', '2026-07-10']);
  });

  it('no muta el arreglo que recibe', () => {
    const original = [peso('2026-07-10', 70), peso('2026-07-01', 73)];
    serieDePesos(original);

    expect(original[0]!.fecha).toBe('2026-07-10');
  });

  it('descarta pesajes sin número utilizable en vez de romper la gráfica', () => {
    const roto = { ...peso('2026-07-02', 0), peso_kg: null as unknown as number };
    const serie = serieDePesos([peso('2026-07-01', 73), roto, peso('2026-07-03', 72)]);

    expect(serie).toHaveLength(2);
  });

  it('aguanta que el campo no sea un arreglo', () => {
    // El contrato promete un arreglo; una respuesta rara no debe tumbar la
    // pantalla completa de progreso.
    expect(serieDePesos(null as unknown as RegistroPeso[])).toEqual([]);
  });
});

describe('geometriaDeGrafica', () => {
  it('no dibuja nada con menos de dos pesajes', () => {
    // Un solo punto insinúa una línea plana que nadie midió.
    expect(geometriaDeGrafica([peso('2026-07-01', 73)])).toBeNull();
    expect(geometriaDeGrafica([])).toBeNull();
  });

  it('extiende la línea de margen a margen', () => {
    const geometria = geometriaDeGrafica([
      peso('2026-07-01', 73),
      peso('2026-07-08', 72),
      peso('2026-07-15', 71),
    ])!;

    expect(geometria.puntos).toHaveLength(3);
    expect(geometria.puntos[0]!.x).toBe(GRAFICA.margen);
    expect(geometria.puntos[2]!.x).toBe(GRAFICA.ancho - GRAFICA.margen);
  });

  it('pinta el peso mayor más arriba que el menor', () => {
    const geometria = geometriaDeGrafica([peso('2026-07-01', 73), peso('2026-07-08', 70)])!;

    // En SVG la `y` crece hacia abajo: más peso = `y` menor.
    expect(geometria.puntos[0]!.y).toBeLessThan(geometria.puntos[1]!.y);
  });

  it('mantiene una serie plana dentro del lienzo, sin dividir entre cero', () => {
    const geometria = geometriaDeGrafica([peso('2026-07-01', 71), peso('2026-07-08', 71)])!;

    for (const punto of geometria.puntos) {
      expect(Number.isFinite(punto.y)).toBe(true);
      expect(punto.y).toBeGreaterThanOrEqual(GRAFICA.margen);
      expect(punto.y).toBeLessThanOrEqual(GRAFICA.alto - GRAFICA.margen);
    }
    // Plana de verdad: los dos puntos a la misma altura.
    expect(geometria.puntos[0]!.y).toBe(geometria.puntos[1]!.y);
  });

  it('reporta los pesos reales, no los del lienzo con holgura', () => {
    const geometria = geometriaDeGrafica([peso('2026-07-01', 73.4), peso('2026-07-08', 70.2)])!;

    expect(geometria.pesoMaximo).toBe(73.4);
    expect(geometria.pesoMinimo).toBe(70.2);
  });

  it('cierra el área contra la base para el relleno', () => {
    const geometria = geometriaDeGrafica([peso('2026-07-01', 73), peso('2026-07-08', 70)])!;

    expect(geometria.linea.startsWith('M')).toBe(true);
    expect(geometria.area.endsWith('Z')).toBe(true);
  });
});

describe('cambioDePeso', () => {
  it('llama "Perdido" a una baja', () => {
    expect(cambioDePeso({ inicial: 75, actual: 72.5, cambio_kg: -2.5 })).toEqual({
      direccion: 'baja',
      kg: 2.5,
      etiqueta: 'Perdido',
    });
  });

  it('llama "Ganado" a una subida en vez de mostrar "Perdido −2 kg"', () => {
    // Un objetivo de ganancia de masa es tan válido como uno de pérdida: la
    // tarjeta no puede decirle "perdiste" a quien subió lo que quería subir.
    expect(cambioDePeso({ inicial: 60, actual: 62, cambio_kg: 2 })).toEqual({
      direccion: 'sube',
      kg: 2,
      etiqueta: 'Ganado',
    });
  });

  it('no inventa dirección cuando el peso no se movió', () => {
    expect(cambioDePeso({ inicial: 70, actual: 70, cambio_kg: 0 })).toEqual({
      direccion: 'igual',
      kg: 0,
      etiqueta: 'Sin cambio',
    });
  });

  it('devuelve null sin pesajes', () => {
    expect(cambioDePeso(null)).toBeNull();
  });
});

describe('formatearKg', () => {
  it('no arrastra decimales vacíos', () => {
    expect(formatearKg(72)).toBe('72');
    expect(formatearKg(72.5)).toBe('72.5');
    expect(formatearKg(72.04)).toBe('72');
  });

  it('devuelve un guion, no un cero, ante un valor inválido', () => {
    // En una app de salud un "0 kg" se lee como un dato sobre uno mismo.
    expect(formatearKg(Number.NaN)).toBe('—');
  });
});

describe('porcentajeDeLogro', () => {
  it('convierte el avance de 0-1 a entero', () => {
    expect(porcentajeDeLogro(0.43)).toBe(43);
    expect(porcentajeDeLogro(1)).toBe(100);
  });

  it('acota lo que se salga del rango para que la barra no se desborde', () => {
    expect(porcentajeDeLogro(1.4)).toBe(100);
    expect(porcentajeDeLogro(-0.2)).toBe(0);
    expect(porcentajeDeLogro(Number.NaN)).toBe(0);
  });
});

describe('conteoDeLogros', () => {
  const logro = (id: string, conseguido: boolean): Logro => ({
    id,
    titulo: id,
    descripcion: id,
    conseguido,
    progreso: conseguido ? 1 : 0.5,
  });

  it('cuenta los conseguidos sobre el total', () => {
    expect(conteoDeLogros([logro('a', true), logro('b', false), logro('c', true)])).toEqual({
      conseguidos: 2,
      total: 3,
    });
  });

  it('aguanta una lista vacía', () => {
    expect(conteoDeLogros([])).toEqual({ conseguidos: 0, total: 0 });
  });

  it('aguanta que el campo no sea un arreglo', () => {
    expect(conteoDeLogros(undefined as unknown as Logro[])).toEqual({ conseguidos: 0, total: 0 });
  });
});

describe('fechaCorta', () => {
  it('no corre el día por la zona horaria', () => {
    // `new Date('2026-07-03')` es medianoche UTC: en México (UTC−6) se
    // formatearía como 2 de julio. El día natural ya viene resuelto.
    expect(fechaCorta('2026-07-03')).toBe('3 jul');
    expect(fechaCorta('2026-01-01')).toBe('1 ene');
    expect(fechaCorta('2026-12-31')).toBe('31 dic');
  });

  it('devuelve vacío ante algo que no es una fecha', () => {
    expect(fechaCorta('ayer')).toBe('');
    expect(fechaCorta('')).toBe('');
    expect(fechaCorta(undefined as unknown as string)).toBe('');
  });

  it('devuelve vacío ante un mes imposible en vez de "3 undefined"', () => {
    expect(fechaCorta('2026-13-03')).toBe('');
    expect(fechaCorta('2026-00-03')).toBe('');
  });
});
