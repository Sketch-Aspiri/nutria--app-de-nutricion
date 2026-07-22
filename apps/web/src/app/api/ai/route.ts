import { NextResponse } from 'next/server';

const MAX_PROMPT_CHARS = 8000;
const MAX_TOKENS_LIMITE = 2000;
const MODELO = 'claude-sonnet-5';

type AiRequestBody = { prompt?: unknown; max_tokens?: unknown };

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Proxy de IA del panel. La API key vive solo en el servidor (ANTHROPIC_API_KEY).
 * Los prompts pueden incluir datos de salud, por eso nunca se loggean.
 */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return errorResponse(
      503,
      'AI_NOT_CONFIGURED',
      'El asistente de IA no está configurado. Define ANTHROPIC_API_KEY en el servidor.',
    );
  }

  let body: AiRequestBody;
  try {
    body = (await request.json()) as AiRequestBody;
  } catch {
    return errorResponse(400, 'AI_INVALID_BODY', 'El cuerpo de la petición no es JSON válido.');
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return errorResponse(400, 'AI_PROMPT_REQUIRED', 'Falta el prompt a generar.');
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return errorResponse(400, 'AI_PROMPT_TOO_LONG', 'El prompt excede el tamaño permitido.');
  }
  const maxTokens = Math.min(
    typeof body.max_tokens === 'number' && body.max_tokens > 0 ? body.max_tokens : 1000,
    MAX_TOKENS_LIMITE,
  );

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      return errorResponse(
        502,
        'AI_UPSTREAM_ERROR',
        'El servicio de IA no está disponible en este momento. Intenta de nuevo.',
      );
    }

    const data = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    return NextResponse.json({ text });
  } catch {
    return errorResponse(
      502,
      'AI_UPSTREAM_ERROR',
      'No se pudo contactar al servicio de IA. Revisa tu conexión e intenta de nuevo.',
    );
  }
}
