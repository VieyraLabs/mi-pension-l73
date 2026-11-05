/**
 * Ajustes que pdf.js necesita en React Native.
 *
 * Este módulo DEBE importarse antes que pdf.js: los shims se instalan al
 * importarse y pdf.js los necesita al CARGARSE (no al usarse).
 */

// Hermes no trae `DOMMatrix` y pdf.js hace `new DOMMatrix()` al importarse.
import './domMatrixPolyfill';
import { deepClone } from './structuredClonePolyfill';

interface StructuredCloneGlobal {
  structuredClone?: (value: unknown, options?: unknown) => unknown;
}

const globalWithClone = globalThis as unknown as StructuredCloneGlobal;

/**
 * ¿La implementación global se puede usar tal cual?
 *
 * pdf.js clona los mensajes que manda al worker con
 * `structuredClone(valor, null)` cuando no hay transferencias. El polyfill que
 * instala Expo (`@ungap/structured-clone`) no aguanta ese `null`, y su
 * variante "nativa" se llama a sí misma en bucle: por eso se prueba antes de
 * confiar en ella.
 */
function isUsable(fn: (value: unknown, options?: unknown) => unknown): boolean {
  try {
    fn({ probe: true }, undefined);
    return true;
  } catch {
    return false;
  }
}

const existingStructuredClone = globalWithClone.structuredClone;

if (typeof existingStructuredClone === 'function' && isUsable(existingStructuredClone)) {
  // Se normaliza `null` a `undefined`: es lo único que pdf.js rompe.
  globalWithClone.structuredClone = (value: unknown, options?: unknown) =>
    existingStructuredClone(value, options ?? undefined);
} else {
  globalWithClone.structuredClone = (value: unknown) => deepClone(value);
}
