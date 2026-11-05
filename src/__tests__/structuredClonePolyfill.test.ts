/**
 * Pruebas del clon estructurado que usa pdf.js para los mensajes de su worker.
 *
 * Para ejecutar: npm test
 */
import { deepClone } from '../services/pdf/structuredClonePolyfill';

describe('deepClone', () => {
  test('copia objetos planos y arreglos sin compartir estado', () => {
    const original = { nombre: 'JUAN', montos: [1, 2, 3], anidado: { ok: true } };

    const copy = deepClone(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.montos).not.toBe(original.montos);
    expect(copy.anidado).not.toBe(original.anidado);
  });

  test('copia binarios sin compartir el buffer', () => {
    const original = { data: new Uint8Array([1, 2, 3]) };

    const copy = deepClone(original);

    expect(Array.from(copy.data)).toEqual([1, 2, 3]);
    expect(copy.data.buffer).not.toBe(original.data.buffer);
  });

  test('conserva fechas, Map y Set', () => {
    const original = {
      fecha: new Date('2026-01-01T00:00:00Z'),
      mapa: new Map([['a', 1]]),
      conjunto: new Set([1, 2]),
    };

    const copy = deepClone(original);

    expect(copy.fecha.getTime()).toBe(original.fecha.getTime());
    expect(copy.mapa.get('a')).toBe(1);
    expect(Array.from(copy.conjunto)).toEqual([1, 2]);
  });

  test('no entra en bucle con referencias circulares', () => {
    const original: Record<string, unknown> = { nombre: 'x' };
    original['self'] = original;

    const copy = deepClone(original);

    expect(copy['self']).toBe(copy);
  });

  test('deja pasar los valores primitivos', () => {
    expect(deepClone('texto')).toBe('texto');
    expect(deepClone(42)).toBe(42);
    expect(deepClone(null)).toBeNull();
    expect(deepClone(undefined)).toBeUndefined();
  });

  test('rechaza funciones y símbolos', () => {
    expect(() => deepClone(() => undefined)).toThrow(TypeError);
    expect(() => deepClone(Symbol('x'))).toThrow(TypeError);
  });
});
