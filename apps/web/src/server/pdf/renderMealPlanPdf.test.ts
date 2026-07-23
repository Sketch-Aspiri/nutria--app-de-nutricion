/**
 * @jest-environment node
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

describe('renderMealPlanPdf', () => {
  it('genera un PDF real, multipágina y cerrado correctamente', async () => {
    /*
     * @react-pdf/renderer se distribuye como ESM puro. El Jest histórico de
     * esta app ejecuta CommonJS, así que el probe corre en un proceso tsx real
     * en vez de falsear el renderer con un mock.
     */
    const ejecutar = promisify(execFile);
    const tsx = require.resolve('tsx/cli');
    const probe = path.join(__dirname, 'renderProbe.ts');
    const { stdout } = await ejecutar(process.execPath, [tsx, probe], {
      cwd: process.cwd(),
      timeout: 30_000,
    });
    const resultado = JSON.parse(stdout) as {
      inicio: string;
      final: string;
      bytes: number;
      paginas: number;
      textoLargo: {
        inicio: string;
        final: string;
        bytes: number;
        paginas: number;
      };
    };

    expect(resultado.inicio).toMatch(/^%PDF-1\.[0-9]/);
    expect(resultado.bytes).toBeGreaterThan(5_000);
    expect(resultado.final).toContain('%%EOF');
    expect(resultado.paginas).toBe(2);
    expect(resultado.textoLargo.inicio).toMatch(/^%PDF-1\.[0-9]/);
    expect(resultado.textoLargo.bytes).toBeGreaterThan(5_000);
    expect(resultado.textoLargo.final).toContain('%%EOF');
    expect(resultado.textoLargo.paginas).toBe(3);
    // El probe arranca tsx en frío y renderiza dos PDF reales; el default de
    // 5 s de Jest se queda corto bajo la carga paralela de toda la suite.
  }, 30_000);
});
