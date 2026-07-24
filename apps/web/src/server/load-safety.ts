export function objetivoCargaPermitido(
  rawUrl: string,
  permitirRemoto: boolean,
): { permitido: boolean; motivo: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { permitido: false, motivo: 'LOAD_TEST_URL no es una URL válida.' };
  }

  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (local) return { permitido: true, motivo: 'destino local' };
  if (!permitirRemoto) {
    return {
      permitido: false,
      motivo: 'Un destino remoto requiere LOAD_TEST_ALLOW_REMOTE=true.',
    };
  }
  if (url.protocol !== 'https:') {
    return { permitido: false, motivo: 'Un destino remoto debe usar HTTPS.' };
  }
  return { permitido: true, motivo: 'destino remoto autorizado explícitamente' };
}
