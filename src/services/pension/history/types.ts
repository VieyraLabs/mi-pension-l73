/**
 * Modelos del historial de cotización semanal.
 *
 * Base para el cálculo del promedio de las ÚLTIMAS 250 SEMANAS COTIZADAS
 * conforme al Art. 167 de la Ley del Seguro Social de 1973 — semanas
 * efectivamente cotizadas, no semanas calendario.
 */

/**
 * Periodo continuo durante el cual estuvo vigente un mismo SBC diario con
 * un patrón. Es la forma en la que se reconstruye el historial a partir de
 * la Constancia de Semanas Cotizadas del IMSS.
 */
export interface SBCPeriod {
  startDate: Date;
  /** Fin del periodo (inclusive). Si el empleo sigue vigente, usar la fecha de referencia. */
  endDate: Date;
  /** Salario Base de Cotización diario vigente durante este periodo. */
  sbc: number;
  /** Nombre del patrón al que pertenece este periodo (opcional). */
  employerName?: string;
}

/**
 * Tramo del historial en el que coexisten uno o más patrones, con el SBC efectivo del tramo.
 *
 * Un TRAMO es un intervalo en el que el conjunto de patrones concurrentes es el
 * mismo: el SBC efectivo del tramo es la SUMA de los SBC de esos patrones
 * (integración de salarios por empleo simultáneo) y las semanas siguen
 * contando UNA sola vez.
 */
export interface SBCPeriodSegment {
  startDate: Date;
  /** Fin del tramo (inclusive). */
  endDate: Date;
  /** SBC diario efectivo del tramo: la suma de los SBC de los patrones concurrentes. */
  sbc: number;
  /** Patrones que concurren en el tramo (pueden ser varios). */
  employerNames: string[];
  /** SBC diario individual por patrón, ordenado por nombre. */
  employers: { employerName: string; sbc: number }[];
}

/**
 * Una semana del historial laboral. Las semanas sin cotización se conservan
 * en el historial (para análisis, conservación de derechos y reportes al
 * usuario) pero nunca entran al promedio salarial.
 */
export interface WeeklyContribution {
  /** Inicio de la semana (inclusive). */
  date: Date;
  /** Si hubo cotización registrada durante la semana. */
  contributed: boolean;
  /**
   * SBC diario de la semana. Solo presente cuando `contributed` es true.
   * Con más de un patrón simultáneo es la suma de sus SBC; con cambios de
   * salario a mitad de semana, el promedio ponderado por días cubiertos.
   */
  salaryBaseContribution?: number;
}

/** Historial completo, en orden cronológico ascendente (más antigua primero). */
export interface ContributionHistory {
  weeks: WeeklyContribution[];
}

/**
 * Reparto de las semanas que entran al SBC promedio proyectado.
 *
 * Sirve para que el motor narre los MISMOS números que se usaron para el
 * promedio: las semanas de Modalidad 10 (cotizadas al salario declarado) y las
 * semanas ordinarias. El promedio siempre se obtiene ponderando estas dos
 * partes, de modo que la fórmula que ve la persona usuaria reproduce la cifra.
 */
export interface ProjectedAverageBreakdown {
  /** Semanas cotizadas que entran al promedio (máximo 250). */
  totalWeeks: number;
  /** Semanas del promedio que caen dentro del periodo de Modalidad 10. */
  m10Weeks: number;
  /** Semanas del promedio que son cotizaciones ordinarias. */
  ordinaryWeeks: number;
  /** SBC diario efectivo promedio de las semanas de Modalidad 10. */
  m10DailySalary: number;
  /** SBC diario efectivo promedio de las semanas ordinarias. */
  ordinaryDailySalary: number;
}

/** Desglose del cálculo, para poder mostrarle al usuario cómo se obtuvo. */
export interface ContributionSummary {
  /** Semanas totales del historial, cotizadas o no. */
  totalWeeksInHistory: number;
  /** Semanas del historial con cotización válida. */
  contributedWeeks: number;
  /** Semanas sin cotización entre la primera y última semana usadas en el promedio. */
  skippedWeeks: number;
  /** Semanas que entraron al promedio (250, o menos si el historial no alcanza). */
  selectedWeeks: number;
  /** SBC diario promedio de las semanas seleccionadas. */
  averageSalary: number;
  /** Inicio de la semana cotizada más antigua usada en el promedio. */
  firstWeekUsed: Date;
  /** Inicio de la semana cotizada más reciente usada en el promedio. */
  lastWeekUsed: Date;
  /** Si se reunieron las 250 semanas cotizadas completas. */
  isComplete: boolean;
}
