/**
 * Seudonimización de los datos que salen hacia el proveedor de IA.
 *
 * La regla del repo prohíbe mandar identificadores directos: edad, sexo y
 * mediciones son necesarios para el cálculo clínico y sí viajan, pero nombre,
 * correo y teléfono se sustituyen por marcadores antes de armar el prompt.
 *
 * Se sustituye por dos vías: los identificadores conocidos del expediente y,
 * además, cualquier correo o teléfono que aparezca en texto libre — una nota de
 * consulta puede mencionar el teléfono de un familiar que no está en la ficha.
 */

export const MARCADOR = {
  nombre: '[PACIENTE]',
  email: '[CORREO]',
  telefono: '[TELEFONO]',
} as const;

export type IdentificadoresPaciente = {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
};

/** Nombres de una sola letra o de dos caracteres borrarían texto legítimo. */
const LARGO_MINIMO_TOKEN = 3;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/**
 * Teléfonos con 8 a 15 dígitos, tolerando espacios, guiones, puntos, paréntesis
 * y prefijo internacional. El mínimo de 8 evita comerse pesos, tallas o kcal.
 */
const TELEFONO = /(?<![\w.])\+?\d(?:[\s.\-()]?\d){7,14}(?!\w)/g;

function escaparRegExp(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cada palabra del nombre se reemplaza por separado: en el texto libre casi
 * nunca aparece el nombre completo ("Ana comenta que…"), y buscar solo la
 * cadena completa dejaría pasar el nombre de pila.
 */
function tokensDeNombre(nombre: string): string[] {
  return [nombre, ...nombre.split(/\s+/)]
    .map((token) => token.trim())
    .filter((token) => token.length >= LARGO_MINIMO_TOKEN)
    // Del más largo al más corto: si no, sustituir el nombre de pila dejaría
    // el apellido suelto y el nombre completo ya no coincidiría.
    .sort((a, b) => b.length - a.length);
}

/** Sustituye los identificadores directos de un texto por marcadores. */
export function seudonimizarTexto(
  texto: string,
  identificadores: IdentificadoresPaciente = {},
): string {
  let salida = texto;

  const nombre = identificadores.nombre?.trim();
  if (nombre) {
    for (const token of tokensDeNombre(nombre)) {
      salida = salida.replace(new RegExp(escaparRegExp(token), 'gi'), MARCADOR.nombre);
    }
  }

  for (const [valor, marcador] of [
    [identificadores.email, MARCADOR.email],
    [identificadores.telefono, MARCADOR.telefono],
  ] as const) {
    const limpio = valor?.trim();
    if (limpio) {
      salida = salida.replace(new RegExp(escaparRegExp(limpio), 'gi'), marcador);
    }
  }

  // El barrido genérico va al final para no romper los reemplazos anteriores.
  return salida.replace(EMAIL, MARCADOR.email).replace(TELEFONO, MARCADOR.telefono);
}

/** Aplica `seudonimizarTexto` a un valor opcional, conservando null/undefined. */
export function seudonimizarOpcional(
  texto: string | null | undefined,
  identificadores: IdentificadoresPaciente = {},
): string | null {
  const limpio = texto?.trim();
  return limpio ? seudonimizarTexto(limpio, identificadores) : null;
}

/**
 * Comprueba que un texto ya no contenga identificadores directos. Se usa como
 * red de seguridad antes de mandar el prompt: si algo se coló, es preferible
 * fallar que enviarlo.
 */
export function contieneIdentificadores(
  texto: string,
  identificadores: IdentificadoresPaciente = {},
): boolean {
  if (EMAIL.test(texto) || TELEFONO.test(texto)) {
    // `test` con /g avanza lastIndex; reiniciarlo evita falsos negativos.
    EMAIL.lastIndex = 0;
    TELEFONO.lastIndex = 0;
    return true;
  }
  EMAIL.lastIndex = 0;
  TELEFONO.lastIndex = 0;

  const nombre = identificadores.nombre?.trim();
  if (!nombre) return false;
  const enMinusculas = texto.toLowerCase();
  return tokensDeNombre(nombre).some((token) => enMinusculas.includes(token.toLowerCase()));
}
