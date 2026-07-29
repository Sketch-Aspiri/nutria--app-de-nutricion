import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluarAuditoria } from './auditoria-npm-core.mjs';

const HOY = '2026-07-29';
const ADVISORY_PERMITIDO = {
  source: 1,
  url: 'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
};

function reporteCon(vulnerabilities) {
  return { auditReportVersion: 2, vulnerabilities };
}

function vulnerabilidad(via, severity = 'high') {
  return { severity, via };
}

describe('evaluarAuditoria', () => {
  it('acepta el advisory permitido y sus dependencias transitivas', () => {
    const reporte = reporteCon({
      'brace-expansion': vulnerabilidad([ADVISORY_PERMITIDO]),
      minimatch: vulnerabilidad(['brace-expansion']),
    });

    assert.equal(evaluarAuditoria({ reporte, status: 1, hoy: HOY }).ok, true);
  });

  it('rechaza la excepción después de su vencimiento', () => {
    const reporte = reporteCon({
      'brace-expansion': vulnerabilidad([ADVISORY_PERMITIDO]),
    });

    const resultado = evaluarAuditoria({
      reporte,
      status: 1,
      hoy: '2026-10-01',
    });

    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, /excepción vencida/);
  });

  it('rechaza un advisory nuevo', () => {
    const reporte = reporteCon({
      paquete: vulnerabilidad([
        {
          source: 2,
          url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
        },
      ]),
    });

    const resultado = evaluarAuditoria({ reporte, status: 1, hoy: HOY });

    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, /GHSA-xxxx-yyyy-zzzz/);
  });

  it('rechaza una mezcla del advisory permitido con una causa no identificable', () => {
    const reporte = reporteCon({
      paquete: vulnerabilidad([
        ADVISORY_PERMITIDO,
        { source: 999, url: 'https://registry.example.test/advisory/999' },
      ]),
    });

    const resultado = evaluarAuditoria({ reporte, status: 1, hoy: HOY });

    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, /999/);
  });

  it('rechaza un esquema JSON incompleto aunque npm termine con código 1', () => {
    const resultado = evaluarAuditoria({
      reporte: { auditReportVersion: 2 },
      status: 1,
      hoy: HOY,
    });

    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, /esquema JSON/);
  });

  it('rechaza código 1 sin vulnerabilidades altas auditables', () => {
    const resultado = evaluarAuditoria({
      reporte: reporteCon({ paquete: vulnerabilidad([], 'low') }),
      status: 1,
      hoy: HOY,
    });

    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, /terminó con error/);
  });

  it('trata una severidad heredada o desconocida como bloqueante', () => {
    const reporte = reporteCon({
      paquete: vulnerabilidad([ADVISORY_PERMITIDO], 'toString'),
    });

    const resultado = evaluarAuditoria({ reporte, status: 0, hoy: HOY });

    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, /código exitoso/);
  });

  it('usa detalle cuando npm devuelve un resumen vacío', () => {
    const resultado = evaluarAuditoria({
      reporte: {
        error: { summary: '', detail: 'registro no disponible' },
      },
      status: 1,
      hoy: HOY,
    });

    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, /registro no disponible/);
  });
});
