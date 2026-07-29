import { spawnSync } from 'node:child_process';

import { evaluarAuditoria } from './auditoria-npm-core.mjs';

function terminarConError(mensaje) {
  console.error(`::error::${mensaje}`);
  process.exit(1);
}

const esWindows = process.platform === 'win32';
const comandoNpm = esWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
const argumentosNpm = esWindows
  ? ['/d', '/s', '/c', 'npm.cmd audit --audit-level=high --json']
  : ['audit', '--audit-level=high', '--json'];
const auditoria = spawnSync(comandoNpm, argumentosNpm, {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (auditoria.error) {
  terminarConError(`No se pudo ejecutar npm audit: ${auditoria.error.message}`);
}

let reporte;
try {
  reporte = JSON.parse(auditoria.stdout);
} catch {
  const detalle = auditoria.stderr.trim();
  terminarConError(`npm audit no devolvió un reporte JSON válido${detalle ? `: ${detalle}` : '.'}`);
}

const resultado = evaluarAuditoria({
  reporte,
  status: auditoria.status,
  hoy: new Date().toISOString().slice(0, 10),
});
if (!resultado.ok) terminarConError(resultado.mensaje);

console.warn(resultado.mensaje);
