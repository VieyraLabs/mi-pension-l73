/**
 * Motor de comparativa «contratar Modalidad 10 vs pensionarse lo antes
 * posible». Es 100% función pura: no usa red ni estado global, y delega el
 * cálculo de la pensión en el pipeline existente (`calculatePension`).
 *
 * La comparativa es en pesos nominales (DEC-009): no se descuenta inflación.
 * Ambas curvas incorporan el incremento anual post-retiro por inflación
 * (DEC-012/DEC-013) cada febrero.
 */
import type { PensionInput, PensionResult } from '../../../models';
import { ANNUAL_POST_RETIREMENT_INCREMENT } from '../../../constants/ley73';
import { calculatePension } from '../PensionCalculator';
import { calculateM10MonthlyBreakdown, estimateM10Months } from '../../../utils/modalidad10';
import { getMinimumDailySalary } from '../../../constants/uma';
import {
  getLocalReferenceDate,
  normalizeLocalCalendarDate,
} from '../../../utils/weeksProjection';
import { addMonths, calculateRetirementDate } from '../../../utils/date';
import { formatUMAs, round2 } from '../../../utils/format';
import type {
  BreakEvenPoint,
  ComparisonResult,
  ComparisonSeriesConfig,
  ComparisonSeriesPoint,
  MultiComparisonEntry,
  MultiComparisonInput,
  MultiComparisonMetrics,
  MultiComparisonResult,
} from './types';

/** Edad a la que la persona puede pensionarse «lo antes posible» (DEC-011). */
export const COMPARISON_EARLY_AGE = 60;
/** Edad máxima de la persona para acotar el horizonte (DEC-010). */
export const COMPARISON_MAX_AGE = 90;
/** Años que se proyectan más allá del punto de equilibrio (DEC-010). */
export const COMPARISON_POST_BREAKEVEN_YEARS = 3;

const MILLISECONDS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Convierte un valor que puede venir serializado (ISO) o como Date a Date. */
function coerceDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

/** Edad fraccionaria (años) de una persona en una fecha dada. */
function ageAt(birthDate: Date, date: Date): number {
  return (date.getTime() - birthDate.getTime()) / MILLISECONDS_PER_YEAR;
}

/** Índice de mes de una fecha relativo a la fecha de referencia (0 = mismo mes). */
function monthIndexOf(date: Date, referenceDate: Date): number {
  return (
    (date.getFullYear() - referenceDate.getFullYear()) * 12 +
    (date.getMonth() - referenceDate.getMonth())
  );
}

/** Horizonte máximo de la gráfica en años: hasta los 90 años de edad. */
export function getMaxHorizonYears(result: PensionResult): number {
  const currentAge = result.input.personalData.age;
  return Math.max(1, Math.floor(COMPARISON_MAX_AGE - currentAge));
}

/**
 * Horizonte por defecto: el máximo del rango (hasta los 90 años de edad).
 * El recorte visual hasta 3 años después del punto de equilibrio se resuelve
 * en la pantalla (ventana de zoom por defecto), no en el horizonte de cálculo.
 */
export function getDefaultHorizonYears(result: PensionResult): number {
  return getMaxHorizonYears(result);
}

/**
 * Construye el input «sin Modalidad 10, pensionarse a los 60» a partir del
 * resultado actual.
 *
 * La base es ESCENARIO-INDEPENDIENTE (DEC-014): usa el SBC promedio declarado
 * de la persona (`averageSalary.dailySalary`) —su salario ordinario de
 * referencia— y NO el «sobrante ordinario» del desglose de la simulación
 * (`projectedAverageBreakdown.ordinaryDailySalary`). Ese sobrante depende de
 * cuántas semanas de M10 entren en la ventana de 250 semanas: con un horizonte
 * largo de M10 puede ser 0, y por eso dos simulaciones de la MISMA persona
 * daban montos base distintos. Con el salario declarado, todas las simulaciones
 * de una persona comparten el mismo monto «pensionarse lo antes posible».
 */
export function buildEarlyRetirementInput(result: PensionResult): PensionInput {
  const input = result.input;
  const referenceDate = getLocalReferenceDate();
  const birthDate = coerceDate(input.personalData.birthDate);
  const currentAge = input.personalData.age;

  let earlyRetirementDate: Date;
  let earlyRetirementAge: number;

  if (currentAge < COMPARISON_EARLY_AGE) {
    // Aún no cumple 60: se pensiona en su cumpleaños 60.
    earlyRetirementDate = calculateRetirementDate(birthDate, COMPARISON_EARLY_AGE);
    earlyRetirementAge = COMPARISON_EARLY_AGE;
  } else {
    // Ya tiene 60+: se pensiona el mes siguiente.
    earlyRetirementDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      1,
    );
    earlyRetirementAge = currentAge;
  }

  return {
    ...input,
    personalData: {
      ...input.personalData,
      retirementAge: earlyRetirementAge,
      estimatedRetirementDate: earlyRetirementDate,
    },
    modalidad10: { active: false },
    projectedAverageDailySalary: input.averageSalary.dailySalary,
    projectedAverageBreakdown: undefined,
  };
}

/**
 * Construye la serie de flujo neto acumulado de un escenario, mes a mes.
 *
 * - Mientras el escenario paga (meses 1..`payUntilMonth`), descuenta
 *   `monthlyCost`.
 * - Desde `retirementDate`, suma la pensión mensual vigente.
 * - Cada febrero, la pensión mensual vigente se multiplica por
 *   `(1 + ANNUAL_POST_RETIREMENT_INCREMENT)`.
 */
export function buildComparisonSeries(config: ComparisonSeriesConfig): ComparisonSeriesPoint[] {
  const { initialMonthlyPension, retirementDate, monthlyCost, payUntilMonth } = config;
  const { horizonMonths, referenceDate, birthDate } = config;

  const startReceiveMonth = Math.max(0, monthIndexOf(retirementDate, referenceDate));
  const points: ComparisonSeriesPoint[] = [];
  let monthlyPension = initialMonthlyPension;
  let cumulative = 0;
  let lastIncrementYear: number | null = null;

  for (let i = 0; i <= horizonMonths; i += 1) {
    const date = addMonths(referenceDate, i);
    const receiving = i >= startReceiveMonth;
    const paying = monthlyCost > 0 && i >= 1 && i <= payUntilMonth;

    // Incremento anual post-retiro: primer febrero en que ya percibe pensión.
    if (receiving && date.getMonth() === 1 && date.getFullYear() !== lastIncrementYear) {
      monthlyPension = round2(monthlyPension * (1 + ANNUAL_POST_RETIREMENT_INCREMENT));
      lastIncrementYear = date.getFullYear();
    }

    if (paying) {
      cumulative -= monthlyCost;
    }
    if (receiving) {
      cumulative += monthlyPension;
    }

    points.push({
      monthIndex: i,
      date,
      age: ageAt(birthDate, date),
      monthlyPension,
      cumulativeNet: round2(cumulative),
    });
  }

  return points;
}

/** Costo mensual de la Modalidad 10 (0 si no está activa o sin SBC declarado). */
function getM10MonthlyCost(result: PensionResult): number {
  const m10 = result.input.modalidad10;
  if (!m10.active || m10.contributionSalary == null) return 0;

  return calculateM10MonthlyBreakdown({
    dailySalary: m10.contributionSalary,
    riskClass: m10.riskClass ?? 1,
    dailyUMA: result.input.uma.dailyUMA,
    minimumDailySalary: getMinimumDailySalary(result.input.uma, m10.salaryZone),
    year: result.input.uma.year,
  }).total;
}

/** Busca el primer mes en que M10 iguala a «antes» tras haber estado por debajo. */
function findBreakEven(
  earlySeries: ComparisonSeriesPoint[],
  m10Series: ComparisonSeriesPoint[],
  earlyRetirementMonthIndex: number,
): BreakEvenPoint | null {
  for (let t = 1; t < m10Series.length; t += 1) {
    const m10Prev = m10Series[t - 1]!.cumulativeNet;
    const earlyPrev = earlySeries[t - 1]!.cumulativeNet;
    const m10Cur = m10Series[t]!.cumulativeNet;
    const earlyCur = earlySeries[t]!.cumulativeNet;

    if (m10Prev < earlyPrev && m10Cur >= earlyCur) {
      const point = m10Series[t]!;
      return {
        monthIndex: point.monthIndex,
        monthsAfterEarlyRetirement: point.monthIndex - earlyRetirementMonthIndex,
        date: point.date,
        age: point.age,
        year: point.date.getFullYear(),
        cumulativeNet: point.cumulativeNet,
      };
    }
  }
  return null;
}

/**
 * Calcula la comparativa completa entre «contratar Modalidad 10» y
 * «pensionarse lo antes posible» para un horizonte dado (años).
 */
export function calculateComparison(result: PensionResult, horizonYears: number): ComparisonResult {
  const referenceDate = getLocalReferenceDate();
  const horizonMonths = Math.max(1, Math.round(horizonYears * 12));
  const birthDate = coerceDate(result.input.personalData.birthDate);

  // Escenario «antes» (sin M10, a los 60 o el mes siguiente).
  const earlyInput = buildEarlyRetirementInput(result);
  const earlyResult = calculatePension(earlyInput);
  const earlyMonthlyPension = earlyResult.monthlyPension;
  const earlyRetirementDate = normalizeLocalCalendarDate(earlyInput.personalData.estimatedRetirementDate);
  const earlyRetirementMonthIndex = Math.max(0, monthIndexOf(earlyRetirementDate, referenceDate));

  // Escenario M10 (la pensión del resultado actual, que ya incorpora M10).
  const m10MonthlyPension = result.monthlyPension;
  const m10RetirementDate = normalizeLocalCalendarDate(
    coerceDate(result.input.personalData.estimatedRetirementDate),
  );
  const monthlyCost = getM10MonthlyCost(result);
  const payUntilMonth =
    monthlyCost > 0 ? estimateM10Months(referenceDate, m10RetirementDate) : -1;

  const earlySeries = buildComparisonSeries({
    initialMonthlyPension: earlyMonthlyPension,
    retirementDate: earlyRetirementDate,
    monthlyCost: 0,
    payUntilMonth: -1,
    horizonMonths,
    referenceDate,
    birthDate,
  });
  const m10Series = buildComparisonSeries({
    initialMonthlyPension: m10MonthlyPension,
    retirementDate: m10RetirementDate,
    monthlyCost,
    payUntilMonth,
    horizonMonths,
    referenceDate,
    birthDate,
  });

  const breakEven = findBreakEven(earlySeries, m10Series, earlyRetirementMonthIndex);

  // Pensión dejada de percibir: lo que «antes» ya habría cobrado antes de que
  // el escenario M10 empiece a percibir su pensión.
  const m10StartMonth = Math.max(0, monthIndexOf(m10RetirementDate, referenceDate));
  const forgoneIndex = Math.max(0, Math.min(m10StartMonth - 1, horizonMonths));
  const forgonePension = round2(Math.max(0, earlySeries[forgoneIndex]!.cumulativeNet));

  const totalM10Cost = round2(monthlyCost * Math.max(0, payUntilMonth));

  return {
    referenceDate,
    horizonMonths,
    earlyScenario: {
      id: 'early',
      label: 'Pensionarse lo antes posible',
      initialMonthlyPension: earlyMonthlyPension,
      series: earlySeries,
    },
    m10Scenario: {
      id: 'm10',
      label: 'Contratar Modalidad 10',
      initialMonthlyPension: m10MonthlyPension,
      series: m10Series,
    },
    breakEven,
    totalM10Cost,
    forgonePension,
    earlyMonthlyPension,
    m10MonthlyPension,
  };
}

/**
 * Horizonte común de una comparación múltiple: el mayor horizonte individual
 * (hasta los 90 años de edad), para que todas las columnas compartan el mismo
 * eje temporal (DEC-015).
 */
export function getMultiComparisonHorizonYears(results: PensionResult[]): number {
  return results.reduce((max, result) => Math.max(max, getMaxHorizonYears(result)), 0);
}

/**
 * Etiqueta identificadora de una simulación según su Modalidad 10: «M10 con
 * X UMAs» (el SBC declarado en UMAs), «M10» si está activa pero sin UMA
 * declarada, o «Sin Modalidad 10» si no está activa (DEC-015).
 */
export function getM10Label(input: PensionInput): string {
  const m10 = input.modalidad10;
  if (!m10.active) return 'Sin Modalidad 10';
  if (m10.contributionSalaryInUMAs != null) {
    return `M10 con ${formatUMAs(m10.contributionSalaryInUMAs)} UMAs`;
  }
  return 'M10';
}

/**
 * Métricas del resumen de una simulación, derivadas de su comparación y de su
 * propio input (DEC-015). La UI no recalcula ninguna de estas cifras.
 */
export function getMultiComparisonMetrics(
  result: PensionResult,
  comparison: ComparisonResult,
): MultiComparisonMetrics {
  const input = result.input;
  return {
    m10Label: getM10Label(input),
    monthlyPension: result.monthlyPension,
    retirementDate: normalizeLocalCalendarDate(
      coerceDate(input.personalData.estimatedRetirementDate),
    ),
    retirementAge: input.personalData.retirementAge,
    totalWeeks: result.weeksProjection?.targetWeeks ?? input.workHistory.totalWeeks,
    projectedDailySalary:
      input.projectedAverageDailySalary ?? input.averageSalary.dailySalary,
    totalM10Cost: comparison.totalM10Cost,
    forgonePension: comparison.forgonePension,
    realM10Cost: round2(comparison.totalM10Cost + comparison.forgonePension),
    earlyMonthlyPension: comparison.earlyMonthlyPension,
    breakEven: comparison.breakEven,
  };
}

/**
 * Compara N simulaciones del historial contra la MISMA base «pensionarse lo
 * antes posible», cada una con su propio punto de equilibrio (DEC-014) y con
 * un horizonte temporal común (DEC-015).
 *
 * Es una función pura: reutiliza `calculateComparison` por simulación (y con
 * ella el break-even existente) y no usa red ni estado global.
 */
export function calculateMultiComparison(
  simulations: MultiComparisonInput[],
  horizonYears: number,
): MultiComparisonResult {
  const entries: MultiComparisonEntry[] = simulations.map((simulation) => {
    const comparison = calculateComparison(simulation.result, horizonYears);
    return {
      simulationId: simulation.simulationId,
      name: simulation.name,
      birthDate: normalizeLocalCalendarDate(
        coerceDate(simulation.result.input.personalData.birthDate),
      ),
      comparison,
      metrics: getMultiComparisonMetrics(simulation.result, comparison),
    };
  });

  return {
    // Todas las comparaciones se calcularon con la misma fecha de referencia.
    referenceDate: entries[0]?.comparison.referenceDate ?? getLocalReferenceDate(),
    horizonYears,
    horizonMonths: Math.max(1, Math.round(horizonYears * 12)),
    entries,
  };
}
