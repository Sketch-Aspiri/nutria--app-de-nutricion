import { z } from 'zod';

import { MAX_BRAND_LOGO_DATA_URL_CHARS } from '@/config/brandLogo';
import { logoSeguro } from '@/server/profile/logoSafety';
import { esUrlLogoBlobSegura } from '@/server/profile/logoStorage';

const colorHex = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'El color debe tener formato hexadecimal, por ejemplo #065f46.');

const logo = z
  .string()
  .max(MAX_BRAND_LOGO_DATA_URL_CHARS, 'El logo no puede superar 512 KB.')
  .refine(
    (value) => logoSeguro(value) !== null || esUrlLogoBlobSegura(value),
    'El logo debe ser una imagen PNG o JPG válida de hasta 512 KB.',
  );

/** Campos editables del perfil y la marca blanca del nutriólogo. */
export const actualizarPerfilSchema = z
  .object({
    nombre_completo: z.string().trim().min(2).max(120).optional(),
    cedula_profesional: z.string().trim().max(40).nullable().optional(),
    telefono: z.string().trim().max(30).nullable().optional(),
    especialidad: z.string().trim().max(100).nullable().optional(),
    marca_nombre: z.string().trim().min(2).max(100).nullable().optional(),
    marca_color: colorHex.optional(),
    marca_logo_url: logo.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Incluye al menos un campo para actualizar.',
  });

export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;
