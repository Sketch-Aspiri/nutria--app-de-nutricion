export const PRIVACY_NOTICE_VERSION = '2026-07-24';

export type PrivacyResponsible = {
  name: string;
  address: string;
  email: string;
};

/**
 * Identidad legal mostrada en el aviso integral.
 *
 * Los marcadores hacen visible una configuración incompleta en desarrollo; el
 * check de lanzamiento la bloquea en producción en vez de publicar identidad
 * o domicilio inventados.
 */
export function getPrivacyResponsible(): PrivacyResponsible {
  return {
    name:
      process.env.PRIVACY_RESPONSIBLE_NAME?.trim() ||
      '[Configura PRIVACY_RESPONSIBLE_NAME]',
    address:
      process.env.PRIVACY_RESPONSIBLE_ADDRESS?.trim() ||
      '[Configura PRIVACY_RESPONSIBLE_ADDRESS]',
    email:
      process.env.PRIVACY_CONTACT_EMAIL?.trim() ||
      '[Configura PRIVACY_CONTACT_EMAIL]',
  };
}
