/**
 * Cálculo del SBC promedio de las ÚLTIMAS 250 SEMANAS COTIZADAS
 * (Art. 167 LSS 1973).
 *
 * REGLA LEGAL CENTRAL: son las últimas 250 semanas **cotizadas**, no las
 * últimas 250 semanas **calendario**. Si el asegurado dejó de trabajar por
 * un tiempo, esas semanas sin cotización no cuentan ni entran al promedio:
 * el recorrido sigue hacia atrás en el historial hasta reunir 250 semanas
 * con cotización registrada. Suponer "250 semanas = ~4.8 años calendario"
 * es incorrecto en cuanto existe cualquier hueco laboral.
 *
 * La Modalidad 10 no se pondera "por encima" del promedio: sus meses se
 * cotizan al salario declarado y entran a la línea temporal como un tramo
 * más, de modo que el promedio que se muestra y el que alimenta el cálculo
 * son el mismo número (Art. 167 LSS 1973).
 *
 * Funciones puras: no tocan UI, navegación ni formularios.
 */
import { SBC_AVERAGE_WEEKS } from '../../../constants/ley73';
import { round2 } from '../../../utils/format';
import type { M10ContributionPeriod } from '../../../utils/modalidad10';
import {
  buildContributionHistory,
  getLastContributionWeeks,
} from './contributionHistory';
import type {
  ContributionHistory,
  ProjectedAverageBreakdown,
  SBCPeriod,
  SBCPeriodSegment,
  WeeklyContribution,
} from './types';

const DAYS_PER_WEEK = 7;
const MS_PER_WEEK = DAYS_PER_WEEK * 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** SBC promedio proyectado al retiro, con el reparto de semanas que lo compone. */
export interface ProjectedSBCResult {
  /** SBC diario promedio de las últimas 250 semanas cotizadas al retiro. */
  averageDailySalary: number;
  /** Reparto de las semanas del promedio (ordinarias y de Modalidad 10). */
  breakdown: ProjectedAverageBreakdown;
}

function emptyBreakdown(dailySalary: number): ProjectedAverageBreakdown {
  return {
    totalWeeks: 0,
    m10Weeks: 0,
    ordinaryWeeks: 0,
    m10DailySalary: 0,
    ordinaryDailySalary: round2(dailySalary),
  };
}

/** Promedio simple del SBC de las semanas dadas. */
function averageOf(weeks: readonly WeeklyContribution[]): number {
  if (weeks.length === 0) return 0;
  const total = weeks.reduce(
    (sum, week) => sum + (week.salaryBaseContribution ?? 0),
    0,
  );
  return round2(total / weeks.length);
}

/**
 * ¿La semana cae COMPLETA dentro del periodo de Modalidad 10?
 *
 * La semana que cruza el primer día cotizable queda en la parte ordinaria:
 * su SBC es un promedio ponderado de los dos tramos y no de un solo salario.
 */
function isWeekInsideM10(week: WeeklyContribution, period: M10ContributionPeriod): boolean {
  const start = week.date.getTime();
  const periodStart = period.startDate.getTime();
  const periodEndExclusive = addLocalDays(period.endDate, 1).getTime();
  return start >= periodStart && start + MS_PER_WEEK <= periodEndExclusive;
}

/**
 * Proyecta el promedio de las últimas semanas cotizadas al retiro.
 *
 * Sin Modalidad 10, la línea temporal es el historial más un tramo de
 * proyección con el último SBC vigente. Con Modalidad 10, el tramo de
 * proyección es el periodo de la Modalidad 10 (al salario declarado, combinado
 * con el salario ordinario si la persona sigue trabajando).
 *
 * @param segments Tramos históricos del SBC (pueden venir vacíos).
 * @param currentSBC SBC capturado por la persona (promedio que declara).
 * @param m10Period Periodo de Modalidad 10; si es `null`, no hay Modalidad 10.
 */
export function calculateProjectedSBC(params: {
  segments: readonly SBCPeriodSegment[];
  currentSBC: number;
  retirementDate: Date;
  referenceDate?: Date;
  count?: number;
  m10Period?: M10ContributionPeriod | null;
}): ProjectedSBCResult {
  const referenceDay = startOfLocalDay(params.referenceDate ?? new Date());
  const retirementDay = startOfLocalDay(params.retirementDate);
  const count = params.count ?? SBC_AVERAGE_WEEKS;
  const m10Period = params.m10Period ?? null;
  const historyEnd =
    retirementDay.getTime() < referenceDay.getTime() ? retirementDay : referenceDay;

  const historicalPeriods: SBCPeriod[] = params.segments.flatMap((segment) => {
    if (!Number.isFinite(segment.sbc) || segment.sbc <= 0) return [];
    const startDate = startOfLocalDay(segment.startDate);
    const endDate = new Date(
      Math.min(startOfLocalDay(segment.endDate).getTime(), historyEnd.getTime()),
    );
    return startDate.getTime() <= endDate.getTime()
      ? [{ startDate, endDate, sbc: segment.sbc }]
      : [];
  });

  const lastHistoricalPeriod =
    historicalPeriods.length > 0
      ? historicalPeriods.reduce((latest, period) =>
          period.endDate.getTime() > latest.endDate.getTime() ? period : latest,
        )
      : undefined;

  const periods: SBCPeriod[] = [...historicalPeriods];

  if (m10Period) {
    if (!lastHistoricalPeriod) {
      // Sin historial importado, el SBC capturado representa el promedio
      // histórico: se sintetiza un tramo plano para que la ventana de 250
      // semanas tenga un pasado (aproximación declarada como estimación).
      periods.push({
        startDate: addLocalDays(m10Period.startDate, -count * DAYS_PER_WEEK),
        endDate: addLocalDays(m10Period.startDate, -1),
        sbc: params.currentSBC,
      });
    } else if (m10Period.continuesWorking) {
      // Mientras sigue trabajando, los días entre la fecha de referencia y el
      // primer mes cotizable de la Modalidad 10 mantienen su SBC ordinario.
      periods.push({
        startDate: addLocalDays(referenceDay, 1),
        endDate: addLocalDays(m10Period.startDate, -1),
        sbc: lastHistoricalPeriod.sbc,
      });
    }
    periods.push({
      startDate: m10Period.startDate,
      endDate: m10Period.endDate,
      sbc: m10Period.dailySalary,
    });
  } else if (retirementDay.getTime() > referenceDay.getTime() && lastHistoricalPeriod) {
    // Proyección ordinaria: del día siguiente a la referencia hasta el retiro,
    // con el último SBC vigente.
    periods.push({
      startDate: addLocalDays(referenceDay, 1),
      endDate: retirementDay,
      sbc: lastHistoricalPeriod.sbc,
    });
  }

  // Contribution history treats its reference as the exclusive end of its
  // final week; add one calendar day to include the retirement date itself.
  const history: ContributionHistory = buildContributionHistory(
    periods,
    addLocalDays(retirementDay, 1),
  );
  const usedWeeks = getLastContributionWeeks(history, count);
  const totalWeeks = usedWeeks.length;

  if (totalWeeks === 0) {
    return {
      averageDailySalary: params.currentSBC,
      breakdown: emptyBreakdown(params.currentSBC),
    };
  }

  const m10Weeks = m10Period
    ? usedWeeks.filter((week) => isWeekInsideM10(week, m10Period))
    : [];
  const ordinaryWeeks = usedWeeks.filter(
    (week) => !m10Period || !isWeekInsideM10(week, m10Period),
  );

  const m10DailySalary = averageOf(m10Weeks);
  const ordinaryDailySalary = averageOf(ordinaryWeeks);

  // El promedio se calcula con las MISMAS cifras que se narran: las dos
  // partes redondeadas ponderadas por sus semanas.
  const averageDailySalary = round2(
    (m10DailySalary * m10Weeks.length +
      ordinaryDailySalary * ordinaryWeeks.length) /
      totalWeeks,
  );

  return {
    averageDailySalary,
    breakdown: {
      totalWeeks,
      m10Weeks: m10Weeks.length,
      ordinaryWeeks: ordinaryWeeks.length,
      m10DailySalary,
      ordinaryDailySalary,
    },
  };
}
