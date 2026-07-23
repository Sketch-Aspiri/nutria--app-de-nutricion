type ConfiguracionE2E = {
  e2eDatabaseUrl?: string;
  databaseUrl?: string;
  directUrl?: string;
  permiteMutaciones: boolean;
  databaseIdPermitida?: string;
};

type ValidacionE2E =
  | { ok: true; databaseUrl: string; databaseId: string }
  | { ok: false; motivo: string };

const MARCADOR_BASE_PRUEBAS = /(^|[-_.])(test|preview|branch)([-_.]|$)/i;

function identidadBase(raw: string): {
  id: string;
  tieneMarcadorPruebas: boolean;
} | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return null;

    const nombre = decodeURIComponent(url.pathname.replace(/^\/+/, '')).toLowerCase();
    if (!url.hostname || !nombre) return null;
    const host = url.hostname.toLowerCase();
    const puerto = url.port || '5432';
    return {
      id: `${host}:${puerto}/${nombre}`,
      tieneMarcadorPruebas:
        MARCADOR_BASE_PRUEBAS.test(host) || MARCADOR_BASE_PRUEBAS.test(nombre),
    };
  } catch {
    return null;
  }
}

/**
 * Fail-closed: una ejecución destructiva necesita opt-in y una base que sea
 * inequívocamente de pruebas, sin coincidir con las conexiones de la app.
 */
export function validarBaseE2E(config: ConfiguracionE2E): ValidacionE2E {
  if (!config.e2eDatabaseUrl || !config.permiteMutaciones) {
    return {
      ok: false,
      motivo:
        'Define E2E_DATABASE_URL y E2E_ALLOW_DB_MUTATION=true para habilitar los E2E.',
    };
  }

  const e2e = identidadBase(config.e2eDatabaseUrl);
  if (!e2e) {
    return {
      ok: false,
      motivo: 'E2E_DATABASE_URL debe ser una URL PostgreSQL válida con nombre de base.',
    };
  }

  const conexionesAplicacion = [config.databaseUrl, config.directUrl]
    .filter((url): url is string => Boolean(url))
    .map(identidadBase)
    .filter((identidad): identidad is NonNullable<typeof identidad> =>
      Boolean(identidad),
    );
  if (conexionesAplicacion.some(({ id }) => id === e2e.id)) {
    return {
      ok: false,
      motivo:
        'E2E_DATABASE_URL coincide con DATABASE_URL o DIRECT_URL; usa una base aislada.',
    };
  }

  const permitidaPorId =
    Boolean(config.databaseIdPermitida) && config.databaseIdPermitida === e2e.id;
  if (!e2e.tieneMarcadorPruebas && !permitidaPorId) {
    return {
      ok: false,
      motivo:
        'La base E2E debe incluir test, preview o branch en host/nombre, o coincidir con E2E_DATABASE_ID.',
    };
  }

  return { ok: true, databaseUrl: config.e2eDatabaseUrl, databaseId: e2e.id };
}

