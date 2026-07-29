const SEVERIDAD = new Map([
  ['info', 0],
  ['low', 1],
  ['moderate', 2],
  ['high', 3],
  ['critical', 4],
]);

export const ADVISORIES_PERMITIDOS = new Map([
  [
    'GHSA-mh99-v99m-4gvg',
    {
      vence: '2026-09-30',
      motivo: 'Jest 29 depende de brace-expansion sin una actualización compatible con ts-jest 29.',
    },
  ],
]);

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function causasDeAdvisory(nombre, vulnerabilidades, ruta = new Set()) {
  const ids = new Set();
  const noResueltas = new Set();

  if (ruta.has(nombre)) {
    noResueltas.add(`${nombre} (referencia circular)`);
    return { ids, noResueltas };
  }

  const vulnerabilidad = vulnerabilidades[nombre];
  if (!esObjeto(vulnerabilidad)) {
    noResueltas.add(`${nombre} (referencia inexistente)`);
    return { ids, noResueltas };
  }
  if (!Array.isArray(vulnerabilidad.via) || vulnerabilidad.via.length === 0) {
    noResueltas.add(`${nombre} (sin causas auditables)`);
    return { ids, noResueltas };
  }

  const siguienteRuta = new Set(ruta).add(nombre);
  for (const causa of vulnerabilidad.via) {
    if (typeof causa === 'string') {
      const resultado = causasDeAdvisory(causa, vulnerabilidades, siguienteRuta);
      for (const id of resultado.ids) ids.add(id);
      for (const pendiente of resultado.noResueltas) noResueltas.add(pendiente);
      continue;
    }

    if (!esObjeto(causa)) {
      noResueltas.add(`${nombre} (causa con formato inválido)`);
      continue;
    }

    const coincidencia = String(causa.url ?? '').match(/GHSA-[A-Za-z0-9-]+/i);
    if (coincidencia) {
      ids.add(coincidencia[0]);
    } else {
      const identificador = causa.source ?? causa.url ?? 'sin identificador';
      noResueltas.add(`${nombre} (${identificador})`);
    }
  }

  return { ids, noResueltas };
}

export function evaluarAuditoria({
  reporte,
  status,
  hoy,
  advisoriesPermitidos = ADVISORIES_PERMITIDOS,
}) {
  if (!esObjeto(reporte)) {
    return { ok: false, mensaje: 'npm audit no devolvió un objeto JSON.' };
  }
  if (reporte.error) {
    const detalle =
      reporte.error.summary || reporte.error.detail || reporte.error.code || 'error sin detalle';
    return { ok: false, mensaje: `npm audit falló: ${detalle}` };
  }
  if (reporte.auditReportVersion !== 2 || !esObjeto(reporte.vulnerabilities)) {
    return {
      ok: false,
      mensaje: 'npm audit devolvió un esquema JSON desconocido o incompleto.',
    };
  }
  if (status !== 0 && status !== 1) {
    return {
      ok: false,
      mensaje: `npm audit terminó con el código inesperado ${status}.`,
    };
  }

  const vulnerabilidades = reporte.vulnerabilities;
  const bloqueantes = Object.entries(vulnerabilidades).filter(([, vulnerabilidad]) => {
    if (!esObjeto(vulnerabilidad)) return true;
    const nivel = SEVERIDAD.get(vulnerabilidad.severity) ?? Number.POSITIVE_INFINITY;
    return nivel >= SEVERIDAD.get('high');
  });

  if (bloqueantes.length === 0) {
    return status === 0
      ? {
          ok: true,
          mensaje: 'npm audit completo: 0 vulnerabilidades altas o críticas.',
        }
      : {
          ok: false,
          mensaje: 'npm audit terminó con error sin reportar vulnerabilidades altas auditables.',
        };
  }
  if (status === 0) {
    return {
      ok: false,
      mensaje: 'npm audit reportó vulnerabilidades altas pero terminó con código exitoso.',
    };
  }

  const noPermitidas = new Set();
  const idsPermitidos = new Set();
  for (const [nombre] of bloqueantes) {
    const { ids, noResueltas } = causasDeAdvisory(nombre, vulnerabilidades);
    for (const pendiente of noResueltas) noPermitidas.add(pendiente);

    if (ids.size === 0) {
      noPermitidas.add(`${nombre} (sin advisory identificable)`);
    }
    for (const id of ids) {
      const permiso = advisoriesPermitidos.get(id);
      if (!permiso) {
        noPermitidas.add(`${nombre} (${id})`);
      } else if (hoy > permiso.vence) {
        noPermitidas.add(`${nombre} (${id}, excepción vencida ${permiso.vence})`);
      } else {
        idsPermitidos.add(id);
      }
    }
  }

  if (noPermitidas.size > 0) {
    return {
      ok: false,
      mensaje: `npm audit encontró vulnerabilidades no permitidas: ${[...noPermitidas].join(', ')}`,
    };
  }

  return {
    ok: true,
    mensaje:
      `npm audit completo: ${bloqueantes.length} dependencias afectadas únicamente por ` +
      `${[...idsPermitidos].join(', ')}; excepción temporal vigente.`,
  };
}
