/**
 * Motor de la comparación multi-simulación (SCN-005 / US-016).
 *
 * Cada simulación se contrasta contra SU PROPIA base «pensionarse lo antes
 * posible» (DEC-014), con un horizonte temporal común (DEC-015) y su punto de
 * equilibrio reutilizando el cálculo existente.
 *
 * Para ejecutar: npm test
 */
import { calculatePension } from '../services/pension/PensionCalculator';
import {
  calculateComparison,
  calculateMultiComparison,
  getMaxHorizonYears,
  getMultiComparisonHorizonYears,
} from '../services/pension/comparison/comparisonCalculator';
import type { MultiComparisonInput } from '../services/pension/comparison/types';
import type { PensionInput, PensionResult } from '../models';

const REFERENCE = new Date(2025, 5, 1); // 1 de junio de 2025

/** Resultado de una persona de 55 años con la Modalidad 10 en un SBC dado. */
function buildResult(contributionSalary: number): PensionResult {
  const input: PensionInput = {
    personalData: {
      name: 'María López',
      birthDate: new Date(1970, 0, 1),
      age: 55,
      estimatedRetirementDate: new Date(2035, 0, 1),
      retirementAge: 65,
    },
    workHistory: { totalWeeks: 1500, employmentRelations: [] },
    averageSalary: { dailySalary: 500, monthlySalary: 15200, isManual: false },
    projectedAverageDailySalary: 800,
    projectedAverageBreakdown: {
      totalWeeks: 250,
      m10Weeks: 100,
      ordinaryWeeks: 150,
      m10DailySalary: contributionSalary,
      ordinaryDailySalary: 533.33,
    },
    uma: {
      dailyUMA: 113.14,
      monthlyUMA: 3439.46,
      annualUMA: 41296.1,
      year: 2025,
      isCustom: false,
    },
    modalidad10: {
      active: true,
      contributionSalary,
      contributionSalaryInUMAs: Number((contributionSalary / 113.14).toFixed(2)),
      continuesWorkingWhileContributing: false,
      expectedMonths: 120,
      riskClass: 3,
      salaryZone: 'general',
    },
    beneficiaries: {
      hasSpouse: false,
      hasMinorChildren: false,
      numberOfMinorChildren: 0,
      hasDependentParents: false,
      numberOfDependentParents: 0,
    },
  };
  return calculatePension(input);
}

/** Una segunda simulación sin Modalidad 10 y sin equilibrio posible. */
function buildNoM10Result(): PensionResult {
  const base = buildResult(1200);
  return {
    ...base,
    input: {
      ...base.input,
      personalData: {
        ...base.input.personalData,
        retirementAge: 60,
        estimatedRetirementDate: new Date(2030, 0, 1),
      },
      modalidad10: { active: false },
      projectedAverageDailySalary: 533.33,
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(REFERENCE);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('calculateMultiComparison', () => {
  test('produce una entrada por simulación, con horizonte común (SCN-005)', () => {
    const low = buildResult(900);
    const high = buildResult(1600);
    const simulations: MultiComparisonInput[] = [
      { simulationId: 'sim-low', name: 'María · escenario A', result: low },
      { simulationId: 'sim-high', name: 'María · escenario B', result: high },
    ];

    const horizon = getMultiComparisonHorizonYears([low, high]);
    const multi = calculateMultiComparison(simulations, horizon);

    expect(multi.entries).toHaveLength(2);
    expect(multi.horizonYears).toBe(horizon);
    expect(multi.horizonMonths).toBe(horizon * 12);
    expect(multi.referenceDate).toEqual(REFERENCE);

    // Mismo eje temporal en todas las columnas y con la fecha de referencia común.
    for (const entry of multi.entries) {
      expect(entry.comparison.horizonMonths).toBe(multi.horizonMonths);
      expect(entry.comparison.m10Scenario.series).toHaveLength(multi.horizonMonths + 1);
      expect(entry.comparison.referenceDate).toEqual(multi.referenceDate);
    }

    expect(multi.entries.map((entry) => entry.simulationId)).toEqual(['sim-low', 'sim-high']);
    expect(multi.entries.map((entry) => entry.name)).toEqual([
      'María · escenario A',
      'María · escenario B',
    ]);
    expect(multi.entries[0]!.birthDate).toEqual(new Date(1970, 0, 1));
    // El horizonte común es el máximo de los individuales (hasta los 90 años).
    expect(horizon).toBe(getMaxHorizonYears(low));
  });

  test('cada simulación tiene su propio punto de equilibrio contra su base (SCN-005)', () => {
    const low = buildResult(900);
    const high = buildResult(1600);
    const horizon = getMultiComparisonHorizonYears([low, high]);

    const multi = calculateMultiComparison(
      [
        { simulationId: 'sim-low', result: low },
        { simulationId: 'sim-high', result: high },
      ],
      horizon,
    );

    for (const entry of multi.entries) {
      // La base se recalcula por simulación (DEC-014): coincide con el motor
      // de comparación individual, sin duplicar la lógica de break-even.
      const individual = calculateComparison(
        entry.simulationId === 'sim-low' ? low : high,
        horizon,
      );
      expect(entry.comparison.breakEven).toEqual(individual.breakEven);
      expect(entry.comparison.earlyMonthlyPension).toBe(individual.earlyMonthlyPension);
      expect(entry.metrics.breakEven).toEqual(individual.breakEven);
    }

    // Un SBC declarado más alto paga cuotas más caras: el punto de equilibrio
    // de esa simulación llega más tarde que el de la simulación barata.
    const lowEntry = multi.entries.find((entry) => entry.simulationId === 'sim-low')!;
    const highEntry = multi.entries.find((entry) => entry.simulationId === 'sim-high')!;
    expect(lowEntry.metrics.totalM10Cost).toBeGreaterThan(0);
    expect(highEntry.metrics.totalM10Cost).toBeGreaterThan(lowEntry.metrics.totalM10Cost);
    expect(highEntry.metrics.breakEven!.monthIndex).toBeGreaterThan(
      lowEntry.metrics.breakEven!.monthIndex,
    );
  });

  test('expone las métricas del resumen por simulación (SCN-005)', () => {
    const result = buildResult(1200);
    const horizon = getMaxHorizonYears(result);
    const multi = calculateMultiComparison([{ simulationId: 'sim-1', result }], horizon);
    const { metrics } = multi.entries[0]!;

    expect(metrics.monthlyPension).toBe(result.monthlyPension);
    expect(metrics.retirementAge).toBe(65);
    expect(metrics.retirementDate).toEqual(new Date(2035, 0, 1));
    expect(metrics.totalWeeks).toBe(
      result.weeksProjection?.targetWeeks ?? result.input.workHistory.totalWeeks,
    );
    expect(metrics.projectedDailySalary).toBe(800);
    expect(metrics.m10Label).toBe('M10 con 10.61 UMAs');
    expect(metrics.earlyMonthlyPension).toBe(multi.entries[0]!.comparison.earlyMonthlyPension);
    expect(metrics.realM10Cost).toBeCloseTo(metrics.totalM10Cost + metrics.forgonePension, 2);
  });

  test('sin punto de equilibrio en el horizonte devuelve null, no lanza', () => {
    const noM10 = buildNoM10Result();
    const multi = calculateMultiComparison([{ simulationId: 'sim-1', result: noM10 }], 3);

    expect(multi.entries[0]!.comparison.breakEven).toBeNull();
    expect(multi.entries[0]!.metrics.breakEven).toBeNull();
    expect(multi.entries[0]!.metrics.m10Label).toBe('Sin Modalidad 10');
    expect(multi.horizonMonths).toBe(36);
  });

  test('tolera resultados con fechas serializadas (ISO) del almacenamiento', () => {
    const result = buildResult(1200);
    const serialized: PensionResult = {
      ...result,
      input: {
        ...result.input,
        personalData: {
          ...result.input.personalData,
          birthDate: result.input.personalData.birthDate.toISOString() as unknown as Date,
          estimatedRetirementDate:
            result.input.personalData.estimatedRetirementDate.toISOString() as unknown as Date,
        },
      },
    };

    const multi = calculateMultiComparison([{ simulationId: 'sim-1', result: serialized }], 20);
    expect(multi.entries).toHaveLength(1);
    expect(multi.entries[0]!.birthDate).toEqual(new Date(1970, 0, 1));
    expect(multi.entries[0]!.metrics.retirementDate).toEqual(new Date(2035, 0, 1));
    expect(multi.entries[0]!.comparison.m10Scenario.series).toHaveLength(20 * 12 + 1);
  });

  test('sin simulaciones devuelve una comparación vacía', () => {
    const multi = calculateMultiComparison([], 10);

    expect(multi.entries).toEqual([]);
    expect(multi.horizonMonths).toBe(120);
    expect(multi.referenceDate).toEqual(REFERENCE);
  });
});
