/** Contrato compartido por el selector de marca, la API y el renderer PDF. */
export const MAX_BRAND_LOGO_BYTES = 512 * 1024;
export const MAX_BRAND_LOGO_DATA_URL_CHARS =
  'data:image/jpeg;base64,'.length + Math.ceil(MAX_BRAND_LOGO_BYTES / 3) * 4;

