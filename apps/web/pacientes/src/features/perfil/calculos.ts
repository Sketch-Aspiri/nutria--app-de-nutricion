import type { Objetivo, PerfilPaciente } from './api';

/**
 * Textos derivados del perfil.
 *
 * Puros y aparte porque son las decisiones que tienen borde: qué decir cuando
 * el objetivo es `OTRO` y la nutrióloga no escribió el detalle, o cuando el
 * paciente aún no tiene plan y por lo tanto no tiene metas.
 */

const OBJETIVOS: Record<Objetivo, string> = {
  PERDIDA_DE_GRASA: 'Pérdida de grasa',
  GANANCIA_MUSCULAR: 'Ganancia muscular',
  MANTENIMIENTO: 'Mantenimiento',
  CONTROL_DE_DIABETES: 'Control de diabetes',
  MEJORA_DEPORTIVA: 'Mejora deportiva',
  OTRO: 'Otro',
};

/**
 * Objetivo en palabras.
 *
 * Con `OTRO` manda el texto libre que escribió la profesional; si lo dejó
 * vacío, se dice "Otro" y no se inventa una meta. `null` cuando el expediente
 * todavía no registra objetivo: eso lo define ella en consulta, no la app.
 */
export function descripcionDeObjetivo(perfil: PerfilPaciente): string | null {
  if (!perfil.objetivo) return null;
  if (perfil.objetivo === 'OTRO') {
    const detalle = perfil.objetivo_otro?.trim();
    return detalle || OBJETIVOS.OTRO;
  }
  return OBJETIVOS[perfil.objetivo] ?? null;
}

/** Iniciales para el avatar, sin reventar con un nombre vacío. */
export function inicialesDe(nombre: string | null | undefined): string {
  return (nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
}

/**
 * Fortaleza mínima exigida por el servidor (`passwordSchema`, NIST 800-63B:
 * longitud sobre reglas de composición). Se repite aquí para avisar antes de
 * gastar un viaje, no para sustituir la validación del servidor.
 */
export const PASSWORD_MIN = 10;

export type ProblemaPassword = 'corta' | 'igual' | 'sin_confirmar' | null;

/** Qué le falta al formulario de contraseña, o `null` si está listo. */
export function validarPassword(
  actual: string,
  nueva: string,
  confirmacion: string,
): ProblemaPassword {
  if (nueva.length < PASSWORD_MIN) return 'corta';
  if (actual === nueva) return 'igual';
  if (nueva !== confirmacion) return 'sin_confirmar';
  return null;
}

export const MENSAJE_PASSWORD: Record<Exclude<ProblemaPassword, null>, string> = {
  corta: `Tu nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  igual: 'Tu nueva contraseña tiene que ser distinta de la actual.',
  sin_confirmar: 'Las dos contraseñas nuevas no coinciden.',
};
