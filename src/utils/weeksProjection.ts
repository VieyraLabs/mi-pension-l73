/**
 * Utilidades de proyección de semanas compartidas por el motor de cálculo,
 * el esquema de validación y el formulario.
 *
 * Una persona que aún no llega a la fecha de retiro puede seguir cotizando: el
 * horizonte de semanas se estima por días calendario desde mañana hasta la
 * fecha de retiro, con el supuesto de cotización futura continua.
 *
 * La edad actual se conserva únicamente para el metadato `yearsToRetirement`; no
 * participa en el cálculo de semanas.
 */
import { MONTHS_PER_YEAR } from '../constants/ley73';
import { formatAge } from './format';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Normaliza un instante al inicio de su día calendario local. */
export function normalizeLocalCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Captura la fecha de referencia local para una operación. */
export function getLocalReferenceDate(): Date {
  return normalizeLocalCalendarDate(new Date());
}

function getCalendarDayNumber(date: Date): number {
  const utcDate = new Date(0);
  utcDate.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return utcDate.getTime() / MILLISECONDS_PER_DAY;
}

/**
 * Cuenta las semanas estimadas entre dos fechas calendario, incluyendo ambos
 * extremos y redondeando solo si los días restantes exceden la mitad de semana.
 */
export function countCotizedWeeksInDateRange(startDate: Date, endDate: Date): number {
  const days = getCalendarDayNumber(endDate) - getCalendarDayNumber(startDate) + 1;
  if (days <= 0) return 0;

  const fullWeeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  return fullWeeks + (remainingDays > 3 ? 1 : 0);
}

export interface WeeksProjection {
  /** Semanas ya cotizadas a la fecha. */
  currentWeeks: number;
  /** Semanas proyectadas desde mañana hasta la fecha exacta de retiro. */
  projectedWeeks: number;
  /** Semanas con las que se calcula (currentWeeks + futuro). */
  targetWeeks: number;
  /** Años que faltan hasta la edad de retiro. */
  yearsToRetirement: number;
}

/** Desglose narrado de una proyección de semanas. */
export interface WeeksNarrative {
  /** Semanas ya cotizadas. */
  currentWeeks: number;
  /** Semanas proyectadas desde mañana hasta la fecha exacta de retiro. */
  projectedWeeks: number;
  /** Semanas de Modalidad 10 que exceden el horizonte (0 si no las hay). */
  m10ExtraWeeks: number;
  /** Semanas con las que se jubila el asegurado. */
  targetWeeks: number;
  /**
   * Partes del desglose, en el orden en que se narran:
   * "100 cotizadas", "1820 proyectadas hasta la edad de retiro", ...
   */
  parts: string[];
  /**
   * Desglose completo: "100 cotizadas + 1820 proyectadas hasta la edad de
   * retiro = 1920". Mismo texto para el motor y para la validación.
   */
  breakdown: string;
}

/**
 * Calcula la proyección de semanas por días calendario. La edad solo se conserva
 * como metadato de compatibilidad; no determina las semanas estimadas.
 *
 * La proyección base empieza mañana para no volver a contar el día reflejado en
 * `currentWeeks`. M10 puede cubrir hasta el fin del mes de retiro, por lo que
 * el objetivo toma el máximo de ambas proyecciones y nunca las suma.
 */
export function calculateWeeksProjection(params: {
  currentWeeks: number;
  age: number;
  retirementAge: number;
  referenceDate: Date;
  retirementDate: Date;
  m10PlannedWeeks: number;
}): WeeksProjection {
  const yearsToRetirement = Math.max(0, params.retirementAge - params.age);
  const startDate = new Date(
    params.referenceDate.getFullYear(),
    params.referenceDate.getMonth(),
    params.referenceDate.getDate() + 1,
  );
  const projectedWeeks = countCotizedWeeksInDateRange(startDate, params.retirementDate);
  const targetWeeks = params.currentWeeks + Math.max(projectedWeeks, params.m10PlannedWeeks);

  return {
    currentWeeks: params.currentWeeks,
    projectedWeeks,
    targetWeeks,
    yearsToRetirement,
  };
}

/**
 * Meses que faltan hasta la edad de retiro — horizonte sugerido para los
 * meses esperados de Modalidad 10.
 */
export function estimateMonthsToRetirement(age: number, retirementAge: number): number {
  return Math.max(0, retirementAge - age) * MONTHS_PER_YEAR;
}

/**
 * Narra una proyección de semanas con las MISMAS cifras que usa el motor.
 *
 * La comparten el paso de incrementos anuales (Art. 167 LSS 1973) y el
 * esquema de validación del mínimo de 500 semanas (Arts. 138 y 145 LSS 1973):
 * así el desglose que ve la persona usuaria y el error de validación no
 * pueden contradecirse.
 *
 * @param retirementAge Si se indica, el horizonte se nombra con la edad de
 * retiro ("proyectadas hasta los 65 años"); si no, se nombra en general
 * ("proyectadas hasta la edad de retiro").
 */
export function describeWeeksProjection(
  projection: WeeksProjection,
  retirementAge?: number,
): WeeksNarrative {
  const { currentWeeks, projectedWeeks, targetWeeks } = projection;

  // Las semanas de Modalidad 10 que exceden el horizonte hasta la edad de
  // retiro son el único horizonte que puede sumar semanas por encima de la
  // proyección (no se cuentan dos veces).
  const m10ExtraWeeks = Math.max(0, targetWeeks - (currentWeeks + projectedWeeks));

  const horizonte =
    retirementAge !== undefined
      ? `proyectadas hasta los ${formatAge(retirementAge)} años`
      : 'proyectadas hasta la edad de retiro';

  const parts: string[] = [`${currentWeeks} cotizadas`];
  if (projectedWeeks > 0) {
    parts.push(`${projectedWeeks} ${horizonte}`);
  }
  if (m10ExtraWeeks > 0) {
    parts.push(`${m10ExtraWeeks} planeadas en Modalidad 10`);
  }

  return {
    currentWeeks,
    projectedWeeks,
    m10ExtraWeeks,
    targetWeeks,
    parts,
    breakdown: `${parts.join(' + ')} = ${targetWeeks}`,
  };
}
