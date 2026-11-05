/**
 * Clon estructurado para los mensajes que pdf.js manda a su worker.
 *
 * La app no necesita un `structuredClone` completo: pdf.js solo clona el
 * sobre de cada mensaje (`{ sourceName, targetName, data }`) y los datos que
 * viajan en él — texto, números, objetos planos, arreglos y binarios.
 *
 * Existe porque el `structuredClone` que instala Expo (`@ungap/structured-clone`)
 * revienta cuando se le pasa `null` en las opciones, que es exactamente lo que
 * hace pdf.js cuando no hay transferencias.
 */

export function deepClone<T>(value: T, memory = new Map<object, unknown>()): T {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol') {
      throw new TypeError('structuredClone: no se puede clonar una función o un símbolo.');
    }
    return value;
  }

  const source = value as unknown as object;
  const alreadyCloned = memory.get(source);
  if (alreadyCloned !== undefined) return alreadyCloned as T;

  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;

  if (value instanceof ArrayBuffer) return value.slice(0) as unknown as T;

  if (ArrayBuffer.isView(value)) {
    const view = value as unknown as { buffer: ArrayBuffer; constructor: new (b: ArrayBuffer) => unknown };
    return new view.constructor(view.buffer.slice(0)) as unknown as T;
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    memory.set(source, copy);
    for (const item of value) copy.push(deepClone(item, memory));
    return copy as unknown as T;
  }

  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    memory.set(source, copy);
    for (const [key, item] of value) copy.set(deepClone(key, memory), deepClone(item, memory));
    return copy as unknown as T;
  }

  if (value instanceof Set) {
    const copy = new Set<unknown>();
    memory.set(source, copy);
    for (const item of value) copy.add(deepClone(item, memory));
    return copy as unknown as T;
  }

  const copy: Record<string, unknown> = {};
  memory.set(source, copy);
  for (const key of Object.keys(value)) {
    copy[key] = deepClone((value as unknown as Record<string, unknown>)[key], memory);
  }
  return copy as unknown as T;
}
