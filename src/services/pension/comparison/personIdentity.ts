/**
 * Identidad de persona para agrupar simulaciones del historial (DEC-018).
 *
 * Dos simulaciones son de la MISMA persona cuando coinciden en `birthDate`
 * (año, mes y día) y comparten al menos una *palabra* del nombre. La
 * comparación de nombres ignora mayúsculas/minúsculas y acentos, descarta las
 * palabras de 1–2 caracteres (iniciales, «de», «la») y compara por palabra
 * completa, nunca por subcadena: «Ana» no coincide con «Mariana».
 *
 * Si alguna de las dos simulaciones no trae nombre (las guardadas antes de
 * DEC-017) la identidad se decide solo con `birthDate`.
 *
 * Es una función pura: no usa red, estado global ni formato de presentación.
 */
import { normalizeLocalCalendarDate } from '../../../utils/weeksProjection';

/** Lo mínimo para decidir si dos simulaciones son de la misma persona. */
export interface PersonIdentity {
  /** Nombre completo; opcional porque las simulaciones antiguas no lo traen. */
  name?: string;
  /** Fecha de nacimiento; puede venir como `Date` o como string ISO del storage. */
  birthDate: Date | string;
}

/** Longitud mínima de una palabra del nombre para contar como señal. */
const MIN_SIGNIFICANT_WORD_LENGTH = 3;

/** Revive las fechas serializadas (ISO) que devuelve AsyncStorage. */
function coerceDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** ¿Mismo día calendario local (año, mes y día)? */
function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Palabras significativas de un nombre: minúsculas, sin acentos, de 3+
 * caracteres y separadas por cualquier cosa que no sea letra ni dígito
 * (espacios, guiones, puntos). El resultado se compara por palabra completa.
 */
export function getSignificantWords(name?: string): string[] {
  const normalized = (name ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  return normalized
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((word) => word.length >= MIN_SIGNIFICANT_WORD_LENGTH);
}

/**
 * ¿Las dos simulaciones son de la misma persona? (DEC-018)
 *
 * - `birthDate` distinto → `false`, sin importar el nombre.
 * - Mismo `birthDate` y ambas con nombre → `true` si comparten al menos una
 *   palabra significativa.
 * - Mismo `birthDate` y alguna sin nombre → `true` (fallback a `birthDate`).
 */
export function isSamePerson(a: PersonIdentity, b: PersonIdentity): boolean {
  const birthDateA = normalizeLocalCalendarDate(coerceDate(a.birthDate));
  const birthDateB = normalizeLocalCalendarDate(coerceDate(b.birthDate));

  if (!isSameCalendarDay(birthDateA, birthDateB)) return false;

  const wordsA = getSignificantWords(a.name);
  const wordsB = getSignificantWords(b.name);

  // Sin nombre (o sin palabras significativas: «Ana» es una sola palabra corta)
  // no hay señal onomástica: manda la fecha de nacimiento.
  if (wordsA.length === 0 || wordsB.length === 0) return true;

  const wordsOfB = new Set(wordsB);
  return wordsA.some((word) => wordsOfB.has(word));
}
