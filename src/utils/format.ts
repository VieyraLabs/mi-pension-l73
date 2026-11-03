/**
 * Utilidades de formateo de moneda, números y fechas para la aplicación.
 * Usa Intl para formateo correcto en español mexicano (es-MX).
 */
import { AVERAGE_DAYS_PER_MONTH } from '../constants/ley73';
import { describeWeeksProjection } from './weeksProjection';
import type { WeeksProjection } from './weeksProjection';

const LOCALE = 'es-MX';

const CURRENCY_FORMATTER = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INTEGER_FORMATTER = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const PERCENT_FORMATTER = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un número como moneda MXN. Ej: $1,234.56 */
export function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value);
}

/**
 * Formatea moneda de forma COMPACTA para ejes y espacios reducidos.
 * Ej: 1234567 → "$1.2M", 12345 → "$12.3k", 999 → "$999.00".
 *
 * La usan los ejes de gráficas (react-native-chart-kit), donde el formato
 * completo ($1,234,567.89) no cabe sin recortarse. El valor exacto sigue
 * disponible en la tabla y en el detalle del punto seleccionado.
 */
export function formatCompactCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

/** Formatea un número con 2 decimales. Ej: 1,234.56 */
export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

/** Formatea un número sin decimales. Ej: 1,234 */
export function formatInteger(value: number): string {
  return INTEGER_FORMATTER.format(Math.round(value));
}

/**
 * Formatea un número de UMAs: sin decimales cuando es entero y con dos
 * decimales cuando tiene fracción (el SBC declarado no siempre es múltiplo
 * exacto de la UMA). Ej: 25 → "25", 21.24 → "21.24".
 */
export function formatUMAs(value: number): string {
  return Number.isInteger(value) ? formatInteger(value) : formatNumber(value);
}

/**
 * Formatea una edad que puede traer fracción de medio año. Ej: 60 → "60",
 * 60.5 → "60.5". Redondea al medio año más cercano para que el ruido de coma
 * flotante no llegue a la pantalla ("60.50000000000001").
 */
export function formatAge(age: number): string {
  const redondeada = Math.round(age * 2) / 2;
  return Number.isInteger(redondeada) ? String(redondeada) : redondeada.toFixed(1);
}

/** Formatea una fecha en formato largo. Ej: 1 de enero de 2024 */
export function formatDateLong(date: Date): string {
  if (isNaN(date.getTime())) return 'Fecha no disponible';
  return DATE_FORMATTER.format(date);
}

/** Formatea una fecha en formato corto. Ej: 01/01/2024 */
export function formatDateShort(date: Date): string {
  if (isNaN(date.getTime())) return 'Fecha no disponible';
  return DATE_SHORT_FORMATTER.format(date);
}

/**
 * Formatea la hora en formato de 24 horas (HH:mm) en la zona horaria local.
 * Ej: 14:05. Se forma manualmente para garantizar el formato exacto pedido
 * por la UI (el `Intl` con es-MX no siempre entrega HH:mm fijo).
 */
export function formatTime(date: Date): string {
  if (isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Formatea una cantidad de meses como «N años M meses». Ej: 73 → «6 años 1 mes»,
 * 60 → «5 años». La comparten las pantallas de comparación (punto de equilibrio).
 */
export function formatYearsMonths(monthIndex: number): string {
  const years = Math.floor(monthIndex / 12);
  const months = monthIndex % 12;
  const yearsText = years === 1 ? '1 año' : `${years} años`;
  if (months === 0) return yearsText;
  const monthsText = months === 1 ? '1 mes' : `${months} meses`;
  return `${yearsText} ${monthsText}`;
}

/** Formatea un porcentaje. Ej: 75.50% */
export function formatPercent(value: number): string {
  return PERCENT_FORMATTER.format(value / 100);
}

/**
 * Formatea con separador de miles las cifras numéricas de un texto narrado.
 * Ej: "600 cotizadas + 1040 proyectadas" → "600 cotizadas + 1,040 proyectadas".
 *
 * Sirve para que las semanas que narra el motor (ver `weeksProjection`) se
 * muestren en la app y en el PDF con el MISMO formato, sin recalcular nada.
 */
export function formatNumbersInText(text: string): string {
  return text.replace(/\d+/g, (digits) => INTEGER_FORMATTER.format(Number(digits)));
}

export const WEEKS_TARGET_LABEL = 'Semanas estimadas al pensionarte';
export const WEEKS_RECORDED_LABEL = 'Semanas cotizadas registradas';

/** Elige una etiqueta que no presente semanas registradas como proyección. */
export function getWeeksLabel(projection?: WeeksProjection): string {
  return projection ? WEEKS_TARGET_LABEL : WEEKS_RECORDED_LABEL;
}

/**
 * Texto de las semanas con las que se jubila el asegurado:
 * "1,640 sem. (600 cotizadas + 1,040 proyectadas hasta la fecha de retiro)".
 *
 * Consume la proyección que produce el motor (`weeksProjection`): la UI no
 * recalcula ni las semanas ni su desglose, solo las formatea.
 */
export function formatWeeksTargetText(
  projection: WeeksProjection,
  retirementAge?: number,
): string {
  const { parts } = describeWeeksProjection(projection, retirementAge);
  if (parts.length <= 1) {
    return `${formatInteger(projection.targetWeeks)} sem.`;
  }

  const dateHorizon = retirementAge !== undefined
    ? `proyectadas hasta los ${formatAge(retirementAge)} años`
    : 'proyectadas hasta la edad de retiro';
  const formattedParts = parts.map((part) =>
    formatNumbersInText(part.replace(dateHorizon, 'proyectadas hasta la fecha de retiro')),
  );
  return `${formatInteger(projection.targetWeeks)} sem. (${formattedParts.join(' + ')})`;
}

/** Formatea un decimal como porcentaje (0.75 → 75.00%) */
export function formatDecimalAsPercent(value: number): string {
  return PERCENT_FORMATTER.format(value);
}

/** Convierte salario mensual a diario (÷ 30.4 según IMSS) */
export function monthlyToDaily(monthlySalary: number): number {
  return parseFloat((monthlySalary / AVERAGE_DAYS_PER_MONTH).toFixed(4));
}

/** Convierte salario diario a mensual (× 30.4 según IMSS) */
export function dailyToMonthly(dailySalary: number): number {
  return parseFloat((dailySalary * AVERAGE_DAYS_PER_MONTH).toFixed(2));
}

/** Redondea a 2 decimales para moneda */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Redondea a 4 decimales para porcentajes */
export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
