import { extraerJSON } from './ia';

describe('extraerJSON', () => {
  it('parsea JSON plano', () => {
    expect(extraerJSON<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parsea JSON envuelto en fences de markdown', () => {
    expect(extraerJSON<{ ok: boolean }>('```json\n{"ok": true}\n```')).toEqual({ ok: true });
  });

  it('lanza SyntaxError si la respuesta no es JSON', () => {
    expect(() => extraerJSON('esto no es json')).toThrow(SyntaxError);
  });
});
