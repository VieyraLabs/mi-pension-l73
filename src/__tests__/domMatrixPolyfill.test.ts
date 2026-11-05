/**
 * Pruebas del shim de DOMMatrix que pdf.js necesita en React Native.
 *
 * Para ejecutar: npm test
 */
import { DomMatrixPolyfill } from '../services/pdf/domMatrixPolyfill';

describe('DomMatrixPolyfill', () => {
  test('sin argumentos es la matriz identidad', () => {
    const m = new DomMatrixPolyfill();

    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([1, 0, 0, 1, 0, 0]);
    expect(m.isIdentity).toBe(true);
  });

  test('se construye desde un arreglo o desde otro objeto con a..f', () => {
    const fromArray = new DomMatrixPolyfill([2, 0, 0, 3, 10, 20]);
    const fromObject = new DomMatrixPolyfill({ a: 2, d: 3, e: 10, f: 20 });

    expect([fromArray.a, fromArray.d, fromArray.e, fromArray.f]).toEqual([2, 3, 10, 20]);
    expect([fromObject.a, fromObject.d, fromObject.e, fromObject.f]).toEqual([2, 3, 10, 20]);
  });

  test('multiplySelf compone en el orden de la especificación', () => {
    // `multiplySelf` post-multiplica (this = this × otro), como en CSSOM:
    // escalar y después trasladar deja la matriz [2, 0, 0, 1, 20, 0].
    const m = new DomMatrixPolyfill();

    m.scale(2, 1).translate(10, 0);

    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([2, 0, 0, 1, 20, 0]);
  });

  test('preMultiplySelf compone al revés', () => {
    const m = new DomMatrixPolyfill([2, 0, 0, 2, 0, 0]);

    m.preMultiplySelf([1, 0, 0, 1, 5, 5]);

    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([2, 0, 0, 2, 5, 5]);
  });

  test('invertSelf deshace la matriz', () => {
    const m = new DomMatrixPolyfill([2, 0, 0, 4, 10, 20]);

    m.invertSelf();

    expect(m.a).toBeCloseTo(0.5);
    expect(m.d).toBeCloseTo(0.25);
    expect(m.e).toBeCloseTo(-5);
    expect(m.f).toBeCloseTo(-5);
  });

  test('una matriz no invertible queda igual al invertirla', () => {
    const m = new DomMatrixPolyfill([0, 0, 0, 0, 7, 9]);

    m.invertSelf();

    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([0, 0, 0, 0, 7, 9]);
  });

  test('clone copia la matriz sin compartir estado', () => {
    const m = new DomMatrixPolyfill([2, 0, 0, 2, 0, 0]);

    const copy = m.clone();
    copy.translate(1, 1);

    // La traslación se compone con la escala: 2 * 1.
    expect(m.e).toBe(0);
    expect(copy.e).toBe(2);
  });

  test('el shim se instala como globalThis.DOMMatrix', () => {
    expect(typeof globalThis.DOMMatrix).toBe('function');
  });
});
