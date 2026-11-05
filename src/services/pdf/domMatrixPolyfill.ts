/**
 * Shim de `DOMMatrix` para React Native.
 *
 * Hermes no implementa `DOMMatrix` y pdf.js lo usa AL CARGAR el módulo (no
 * solo al renderizar): sin este shim, importar pdf.js en la app revienta al
 * arrancar con "DOMMatrix is not defined".
 *
 * Es la matriz afín 2D de la especificación CSSOM, con las operaciones que la
 * API de pdf.js usa: componer, invertir, trasladar y escalar. El renderizado
 * de páginas —lo único que usa la matriz a fondo— no ocurre en esta app: aquí
 * solo se extrae texto.
 *
 * El módulo se instala a sí mismo al importarse, y DEBE importarse antes que
 * pdf.js: el orden de evaluación de los imports es el orden del archivo.
 */

export interface DomMatrixInit {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
  f?: number;
}

type MatrixLike = DomMatrixInit | number[] | DomMatrixPolyfill;

function toComponents(init: MatrixLike | undefined): [number, number, number, number, number, number] {
  if (!init) return [1, 0, 0, 1, 0, 0];

  if (Array.isArray(init)) {
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = init;
    return [a, b, c, d, e, f];
  }

  const source = init as DomMatrixInit;
  return [
    source.a ?? 1,
    source.b ?? 0,
    source.c ?? 0,
    source.d ?? 1,
    source.e ?? 0,
    source.f ?? 0,
  ];
}

export class DomMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: MatrixLike) {
    const [a, b, c, d, e, f] = toComponents(init);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  get is2D(): boolean {
    return true;
  }

  get isIdentity(): boolean {
    return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
  }

  clone(): DomMatrixPolyfill {
    return new DomMatrixPolyfill(this);
  }

  /** Compone: this = this × other. */
  multiplySelf(other: MatrixLike): this {
    const [a2, b2, c2, d2, e2, f2] = toComponents(other);
    const { a, b, c, d, e, f } = this;

    this.a = a * a2 + c * b2;
    this.b = b * a2 + d * b2;
    this.c = a * c2 + c * d2;
    this.d = b * c2 + d * d2;
    this.e = a * e2 + c * f2 + e;
    this.f = b * e2 + d * f2 + f;
    return this;
  }

  /** Compone al revés: this = other × this. */
  preMultiplySelf(other: MatrixLike): this {
    const [a2, b2, c2, d2, e2, f2] = toComponents(other);
    const { a, b, c, d, e, f } = this;

    this.a = a2 * a + c2 * b;
    this.b = b2 * a + d2 * b;
    this.c = a2 * c + c2 * d;
    this.d = b2 * c + d2 * d;
    this.e = a2 * e + c2 * f + e2;
    this.f = b2 * e + d2 * f + f2;
    return this;
  }

  /**
   * Invierte la matriz. Si no es invertible (determinante 0) queda igual, como
   * manda la especificación.
   */
  invertSelf(): this {
    const determinant = this.a * this.d - this.b * this.c;
    if (determinant === 0) return this;

    const { a, b, c, d, e, f } = this;
    this.a = d / determinant;
    this.b = -b / determinant;
    this.c = -c / determinant;
    this.d = a / determinant;
    this.e = (c * f - d * e) / determinant;
    this.f = (b * e - a * f) / determinant;
    return this;
  }

  /** Traslada: this = this × translated. */
  translate(tx: number, ty: number): this {
    return this.multiplySelf([1, 0, 0, 1, tx, ty]);
  }

  /** Escala: this = this × scaled. */
  scale(sx: number, sy: number): this {
    return this.multiplySelf([sx, 0, 0, sy, 0, 0]);
  }

  toString(): string {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

const globalWithMatrix = globalThis as { DOMMatrix?: unknown };
if (!globalWithMatrix.DOMMatrix) {
  globalWithMatrix.DOMMatrix = DomMatrixPolyfill;
}
