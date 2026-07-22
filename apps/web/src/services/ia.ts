import { extraerJSON } from '@nutria/shared';

export type ErrorApi = { code: string; message: string };

/**
 * Llama al endpoint interno de IA (/api/ai), que a su vez habla con el proveedor
 * desde el servidor. El cliente nunca conoce la API key.
 * Lanza Error con el mensaje human-readable del backend.
 */
export async function generarTexto(prompt: string, maxTokens = 1000): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: maxTokens }),
  });
  const body: unknown = await res.json();
  if (!res.ok) {
    const mensaje =
      typeof body === 'object' && body !== null && 'error' in body
        ? ((body as { error: ErrorApi }).error.message ?? 'Error del servicio de IA')
        : 'Error del servicio de IA';
    throw new Error(mensaje);
  }
  return (body as { text: string }).text;
}

/** Igual que generarTexto, pero espera JSON (con o sin fences de markdown). */
export async function generarJSON<T>(prompt: string, maxTokens = 1000): Promise<T> {
  const texto = await generarTexto(prompt, maxTokens);
  return extraerJSON<T>(texto);
}
