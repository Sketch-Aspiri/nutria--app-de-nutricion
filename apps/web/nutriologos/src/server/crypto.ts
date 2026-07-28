import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const FORMAT_VERSION = 'v1';
const PREFIX = `enc:${FORMAT_VERSION}:`;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export const ENCRYPTION_CONTEXT = {
  medicalAntecedentes: 'medical_records.antecedentes',
  medicalMedicamentos: 'medical_records.medicamentos',
  messageText: 'messages.texto',
  consultationMotivo: 'consultation_notes.motivo',
  consultationHallazgos: 'consultation_notes.hallazgos',
  consultationPlan: 'consultation_notes.plan',
  consultationSeguimiento: 'consultation_notes.seguimiento',
} as const;

export class EncryptionConfigError extends Error {
  readonly code = 'ENCRYPTION_CONFIG';

  constructor(message: string) {
    super(message);
    this.name = 'EncryptionConfigError';
  }
}

export class EncryptionIntegrityError extends Error {
  readonly code = 'ENCRYPTION_INTEGRITY';

  constructor() {
    super('El dato cifrado no supera la verificación de integridad.');
    this.name = 'EncryptionIntegrityError';
  }
}

type Keyring = {
  activeId: string;
  keys: Map<string, Buffer>;
};

function decodeKey(raw: string, variable: string): Buffer {
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new EncryptionConfigError(
      `${variable} debe contener exactamente ${KEY_BYTES} bytes codificados en base64.`,
    );
  }
  return key;
}

/**
 * Carga la llave activa y las anteriores en cada operación para permitir
 * rotación sin reiniciar procesos ni fijar secretos al importar el módulo.
 */
function loadKeyring(): Keyring {
  const activeRaw = process.env.ENCRYPTION_KEY?.trim();
  if (!activeRaw) {
    throw new EncryptionConfigError('ENCRYPTION_KEY no está configurada.');
  }

  const activeId = process.env.ENCRYPTION_KEY_ID?.trim() || 'primary';
  if (!KEY_ID_PATTERN.test(activeId)) {
    throw new EncryptionConfigError('ENCRYPTION_KEY_ID tiene un formato inválido.');
  }

  const keys = new Map<string, Buffer>([
    [activeId, decodeKey(activeRaw, 'ENCRYPTION_KEY')],
  ]);

  for (const entry of (process.env.ENCRYPTION_PREVIOUS_KEYS ?? '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf(':');
    const id = trimmed.slice(0, separator);
    const raw = trimmed.slice(separator + 1);
    if (separator < 1 || !KEY_ID_PATTERN.test(id) || !raw) {
      throw new EncryptionConfigError(
        'ENCRYPTION_PREVIOUS_KEYS debe usar pares key_id:base64 separados por coma.',
      );
    }
    if (keys.has(id)) {
      throw new EncryptionConfigError(`La llave "${id}" está declarada más de una vez.`);
    }
    keys.set(id, decodeKey(raw, `ENCRYPTION_PREVIOUS_KEYS (${id})`));
  }

  return { activeId, keys };
}

function additionalData(keyId: string, context: string): Buffer {
  return Buffer.from(`nutria|${FORMAT_VERSION}|${keyId}|${context}`, 'utf8');
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptedKeyId(value: string | null | undefined): string | null {
  if (!isEncrypted(value)) return null;
  const segments = (value as string).split(':');
  return segments.length === 6 && segments[1] === FORMAT_VERSION
    ? (segments[2] ?? null)
    : null;
}

/** Detecta texto legado y sobres de una llave anterior para un backfill reanudable. */
export function needsEncryptionRefresh(
  value: string | null | undefined,
): boolean {
  if (value === null || value === undefined) return false;
  return encryptedKeyId(value) !== loadKeyring().activeId;
}

/**
 * Cifra texto clínico con AES-256-GCM y AAD ligada a su columna.
 *
 * El IV aleatorio hace que dos valores iguales produzcan sobres distintos; el
 * tag GCM detecta cambios y la AAD impide mover un sobre válido a otra columna.
 */
export function encryptText(value: string | null, context: string): string | null {
  if (value === null) return null;

  const { activeId, keys } = loadKeyring();
  const key = keys.get(activeId);
  if (!key) throw new EncryptionConfigError('No se encontró la llave activa.');

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(additionalData(activeId, context));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'enc',
    FORMAT_VERSION,
    activeId,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

/**
 * Descifra un sobre. El texto legado sin prefijo se devuelve temporalmente tal
 * cual para permitir el despliegue expand-contract y el backfill por lotes.
 */
export function decryptText(value: string | null, context: string): string | null {
  if (value === null || !isEncrypted(value)) return value;

  const segments = value.split(':');
  if (segments.length !== 6 || segments[1] !== FORMAT_VERSION) {
    throw new EncryptionIntegrityError();
  }

  const keyId = segments[2] as string;
  const ivRaw = segments[3] as string;
  const tagRaw = segments[4] as string;
  const ciphertextRaw = segments[5] as string;
  const key = loadKeyring().keys.get(keyId);
  if (!key) {
    throw new EncryptionConfigError(`No está disponible la llave "${keyId}" del dato cifrado.`);
  }

  try {
    const iv = Buffer.from(ivRaw, 'base64url');
    const tag = Buffer.from(tagRaw, 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== 16) throw new EncryptionIntegrityError();

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(additionalData(keyId, context));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error: unknown) {
    if (error instanceof EncryptionConfigError) throw error;
    throw new EncryptionIntegrityError();
  }
}

/** Comparación constante para confirmaciones de operaciones sensibles. */
export function secureEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}
