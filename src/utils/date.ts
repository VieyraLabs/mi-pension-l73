/**
 * Utilidades de manejo de fechas para la aplicación.
 */

/** Calcula la edad en años completos a partir de la fecha de nacimiento. */
export function calculateAge(birthDate: Date, reference?: Date): number {
  const ref = reference ?? new Date();
  let age = ref.getFullYear() - birthDate.getFullYear();
  const month = ref.getMonth() - birthDate.getMonth();
  if (month < 0 || (month === 0 && ref.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calcula la fecha estimada de retiro dado el año de nacimiento y la edad de retiro.
 *
 * La edad puede traer fracción de medio año (60.5): en ese caso se suman los
 * meses correspondientes a la fracción. Con edades enteras el resultado es el
 * cumpleaños del año en que se cumple la edad.
 */
export function calculateRetirementDate(birthDate: Date, retirementAge: number): Date {
  const years = Math.floor(retirementAge);
  const months = Math.round((retirementAge - years) * 12);

  const date = new Date(birthDate);
  date.setFullYear(date.getFullYear() + years);
  if (months === 0) return date;

  // La fracción de la edad se cuenta en meses (medio año = 6 meses). Si el día
  // no existe en el mes destino, se usa el último día de ese mes.
  const targetMonth = date.getMonth() + months;
  const day = date.getDate();
  const daysInTargetMonth = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  date.setMonth(targetMonth, Math.min(day, daysInTargetMonth));
  return date;
}

/**
 * Edad LEGAL para el cálculo de la cuantía (Art. 171 LSS 1973).
 * "Se aumentará un año a los cumplidos cuando la edad los exceda en seis meses."
 * La interfaz presenta la edad en fracciones de medio año, así que el umbral
 * operativo es la fracción de medio año o más.
 */
export function calculateLegalAge(ageInYears: number): number {
  const years = Math.floor(ageInYears);
  return ageInYears - years >= 0.5 ? years + 1 : years;
}

/** Obtiene el año actual. */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/** Convierte una fecha a string ISO (YYYY-MM-DD). */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/** Parsea un string ISO (YYYY-MM-DD) a Date. */
export function fromISODate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

/** Agrega meses a una fecha. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
