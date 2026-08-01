import {
  agregarOptimista,
  agruparPorDia,
  diaLocal,
  esOptimista,
  etiquetaDeDia,
  horaCorta,
  mensajeOptimista,
  ordenarMensajes,
  sinLeerDe,
} from './calculos';
import type { Mensaje, RespuestaMensajes } from './types';

/**
 * Las fechas se construyen con el constructor **local** (`new Date(a, m, d, h)`)
 * a propósito: así el ISO que se genera y la hora que se lee de vuelta son
 * consistentes en cualquier zona horaria, y la suite no depende de la máquina.
 */
function enLocal(anio: number, mes: number, dia: number, hora = 12, minuto = 0): string {
  return new Date(anio, mes - 1, dia, hora, minuto).toISOString();
}

function mensaje(id: string, created: string, parcial: Partial<Mensaje> = {}): Mensaje {
  return {
    id,
    emisor: 'PATIENT',
    texto: `Mensaje ${id}`,
    leido_at: null,
    created_at: created,
    ...parcial,
  };
}

describe('ordenarMensajes', () => {
  it('voltea el orden que manda el servidor: el más viejo arriba', () => {
    // `listarMensajes` ordena `desc` para quedarse con los últimos 100; un
    // chat se lee al revés.
    const delServidor = [
      mensaje('c', enLocal(2026, 7, 31, 18)),
      mensaje('b', enLocal(2026, 7, 31, 12)),
      mensaje('a', enLocal(2026, 7, 30, 9)),
    ];

    expect(ordenarMensajes(delServidor).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('no muta el arreglo de la caché', () => {
    const original = [mensaje('c', enLocal(2026, 7, 31, 18)), mensaje('a', enLocal(2026, 7, 30, 9))];
    ordenarMensajes(original);

    expect(original[0]!.id).toBe('c');
  });

  it('mantiene un orden estable si dos caen en el mismo instante', () => {
    // Sin desempate, dos mensajes simultáneos bailarían entre sondeos.
    const mismoInstante = enLocal(2026, 7, 31, 12);
    const orden = ordenarMensajes([
      mensaje('b', mismoInstante),
      mensaje('a', mismoInstante),
    ]).map((m) => m.id);

    expect(orden).toEqual(['a', 'b']);
  });

  it('aguanta que el campo no sea un arreglo', () => {
    expect(ordenarMensajes(null as unknown as Mensaje[])).toEqual([]);
  });
});

describe('agruparPorDia', () => {
  it('parte el hilo por día natural y conserva el orden dentro del grupo', () => {
    const grupos = agruparPorDia(
      [
        mensaje('c', enLocal(2026, 7, 31, 9)),
        mensaje('a', enLocal(2026, 7, 29, 20)),
        mensaje('b', enLocal(2026, 7, 29, 21)),
      ],
      new Date(2026, 6, 31, 12),
    );

    expect(grupos).toHaveLength(2);
    expect(grupos[0]!.mensajes.map((m) => m.id)).toEqual(['a', 'b']);
    expect(grupos[1]!.etiqueta).toBe('Hoy');
  });

  it('agrupa por la fecha local, no por la de UTC', () => {
    // Un mensaje de las 23:40 en México sigue siendo de ese día aunque en UTC
    // ya sea el siguiente.
    const grupos = agruparPorDia(
      [mensaje('a', enLocal(2026, 7, 30, 23, 40)), mensaje('b', enLocal(2026, 7, 30, 8))],
      new Date(2026, 6, 31, 12),
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.etiqueta).toBe('Ayer');
  });

  it('descarta un `created_at` ilegible en vez de romper el hilo completo', () => {
    const grupos = agruparPorDia(
      [mensaje('a', enLocal(2026, 7, 31, 9)), mensaje('roto', 'no-es-fecha')],
      new Date(2026, 6, 31, 12),
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.mensajes).toHaveLength(1);
  });

  it('devuelve vacío sin mensajes', () => {
    expect(agruparPorDia([])).toEqual([]);
  });
});

describe('etiquetaDeDia', () => {
  const ahora = new Date(2026, 6, 31, 12);

  it('dice Hoy y Ayer en vez de una fecha', () => {
    expect(etiquetaDeDia(new Date(2026, 6, 31, 8), ahora)).toBe('Hoy');
    expect(etiquetaDeDia(new Date(2026, 6, 30, 8), ahora)).toBe('Ayer');
  });

  it('usa la fecha corta más atrás', () => {
    expect(etiquetaDeDia(new Date(2026, 6, 3, 8), ahora)).toBe('3 jul');
  });

  it('cruza el cambio de mes sin decir "Ayer" de más', () => {
    const primeroDeAgosto = new Date(2026, 7, 1, 10);
    expect(etiquetaDeDia(new Date(2026, 6, 31, 22), primeroDeAgosto)).toBe('Ayer');
    expect(etiquetaDeDia(new Date(2026, 6, 30, 22), primeroDeAgosto)).toBe('30 jul');
  });
});

describe('diaLocal', () => {
  it('rellena mes y día con cero', () => {
    expect(diaLocal(new Date(2026, 0, 5, 10))).toBe('2026-01-05');
  });
});

describe('horaCorta', () => {
  it('usa 24 h con dos dígitos', () => {
    expect(horaCorta(enLocal(2026, 7, 31, 9, 5))).toBe('09:05');
    expect(horaCorta(enLocal(2026, 7, 31, 14, 30))).toBe('14:30');
  });

  it('devuelve vacío ante una fecha ilegible', () => {
    expect(horaCorta('no-es-fecha')).toBe('');
  });
});

describe('mensajeOptimista', () => {
  it('se marca como pendiente y como del paciente', () => {
    const optimista = mensajeOptimista('Hola');

    expect(optimista.pendiente).toBe(true);
    expect(optimista.emisor).toBe('PATIENT');
    expect(optimista.texto).toBe('Hola');
    expect(esOptimista(optimista)).toBe(true);
  });

  it('no se confunde con un id del servidor', () => {
    expect(esOptimista(mensaje('a2f1-real', enLocal(2026, 7, 31)))).toBe(false);
  });
});

describe('agregarOptimista', () => {
  const respuesta: RespuestaMensajes = {
    data: [mensaje('a', enLocal(2026, 7, 31, 9))],
    meta: { page: 1, per_page: 1, total: 1, sin_leer: 2 },
  };

  it('suma la burbuja sin tocar `sin_leer`', () => {
    // `sin_leer` cuenta mensajes **del nutriólogo**: escribir uno propio no
    // cambia ese número, y tocarlo apagaría el indicador por error.
    const nueva = agregarOptimista(respuesta, mensajeOptimista('Hola'));

    expect(nueva.data).toHaveLength(2);
    expect(nueva.meta.sin_leer).toBe(2);
    expect(nueva.meta.total).toBe(2);
  });

  it('no muta el sobre cacheado', () => {
    agregarOptimista(respuesta, mensajeOptimista('Hola'));

    expect(respuesta.data).toHaveLength(1);
  });
});

describe('sinLeerDe', () => {
  const sobre = (sinLeer: unknown): RespuestaMensajes =>
    ({ data: [], meta: { page: 1, per_page: 0, total: 0, sin_leer: sinLeer } }) as RespuestaMensajes;

  it('lee el conteo del meta', () => {
    expect(sinLeerDe(sobre(3))).toBe(3);
  });

  it('devuelve 0 sin datos todavía', () => {
    expect(sinLeerDe(undefined)).toBe(0);
  });

  it('no deja pasar un conteo absurdo al indicador', () => {
    expect(sinLeerDe(sobre(-1))).toBe(0);
    expect(sinLeerDe(sobre('tres'))).toBe(0);
  });
});
