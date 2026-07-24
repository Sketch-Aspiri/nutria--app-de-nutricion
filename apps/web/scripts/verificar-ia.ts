/**
 * Comprobación de que la IA quedó lista: `npm run ai:check`.
 *
 * Hace una llamada mínima y sin datos clínicos a cada modelo configurado, para
 * separar "la llave está mal" de "el prompt está mal" antes de depurar la app.
 * No toca la base de datos ni consume cuota de ningún nutriólogo.
 */
import Anthropic from '@anthropic-ai/sdk';

import { CONFIGURACION, type TipoGeneracion } from '../src/server/ai/config';

const PROMPT = 'Responde únicamente con la palabra: listo';

function modelosConfigurados(): Array<{ modelo: string; usos: TipoGeneracion[] }> {
  const porModelo = new Map<string, TipoGeneracion[]>();
  for (const [tipo, config] of Object.entries(CONFIGURACION)) {
    const usos = porModelo.get(config.modelo) ?? [];
    porModelo.set(config.modelo, [...usos, tipo as TipoGeneracion]);
  }
  return [...porModelo].map(([modelo, usos]) => ({ modelo, usos }));
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('✗ Falta ANTHROPIC_API_KEY.');
    console.error('  Pega tu llave en apps/web/.env y vuelve a correr `npm run ai:check`.');
    console.error('  Se obtiene en https://console.anthropic.com/settings/keys');
    process.exit(1);
  }
  console.log(`Llave detectada (…${apiKey.slice(-4)}). Probando los modelos configurados:\n`);

  const cliente = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
  let hayFallos = false;

  for (const { modelo, usos } of modelosConfigurados()) {
    const inicio = Date.now();
    try {
      const respuesta = await cliente.messages.create({
        model: modelo,
        max_tokens: 16,
        messages: [{ role: 'user', content: PROMPT }],
      });
      const texto = respuesta.content
        .filter((bloque) => bloque.type === 'text')
        .map((bloque) => (bloque.type === 'text' ? bloque.text : ''))
        .join('')
        .trim();
      const { input_tokens: entrada, output_tokens: salida } = respuesta.usage;
      console.log(
        `✓ ${modelo} → "${texto}" (${Date.now() - inicio} ms, ${entrada} in / ${salida} out)`,
      );
      console.log(`  usado por: ${usos.join(', ')}\n`);
    } catch (error: unknown) {
      hayFallos = true;
      const detalle =
        error instanceof Anthropic.APIError
          ? `HTTP ${error.status} — ${error.message}`
          : String(error);
      console.error(`✗ ${modelo} falló: ${detalle}`);
      if (error instanceof Anthropic.AuthenticationError) {
        console.error('  La llave no es válida o fue revocada. Genera una nueva en la consola.\n');
      } else if (error instanceof Anthropic.NotFoundError) {
        console.error('  Tu cuenta no tiene acceso a ese modelo. Revisa el plan en la consola.\n');
      } else {
        console.error('');
      }
    }
  }

  if (hayFallos) process.exit(1);
  console.log('La IA está lista. Arranca la app con `npm run dev`.');
}

main().catch((error: unknown) => {
  console.error('Error inesperado al comprobar la IA:', error);
  process.exit(1);
});
