import { z } from 'zod';

import { passwordSchema } from './password';

/**
 * Entrada de `POST /api/v1/auth/activate` (app del paciente).
 *
 * `acepta_privacidad` es un booleano obligatorio en `true`, no una casilla
 * decorativa: `activarCuentaPaciente` sella `privacy_notice_accepted_at` y la
 * versión del aviso en la fila del usuario, y esa marca tiene que corresponder
 * a un acto real del paciente. Un default en el servidor firmaría por él.
 */
export const activarCuentaSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Falta el token de activación.')
    .max(200, 'El token de activación no es válido.'),
  password: passwordSchema,
  acepta_privacidad: z.literal(true, {
    message: 'Necesitas aceptar el aviso de privacidad para crear tu cuenta.',
  }),
});

export type ActivarCuentaInput = z.infer<typeof activarCuentaSchema>;
