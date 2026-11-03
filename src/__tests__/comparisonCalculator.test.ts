import { calculatePension } from '../services/pension/PensionCalculator';
import {
  buildComparisonSeries,
  buildEarlyRetirementInput,
  calculateComparison,
  getDefaultHorizonYears,
  getMaxHorizonYears,
  COMPARISON_MAX_AGE,
} from '../services/pension/comparison/comparisonCalculator';
import type { PensionInput, PensionResult } from '../models';

const REFERENCE = new Date(2025, 5, 1); // 1 de junio de 2025

/** Resultado real con Modalidad 10 activa, retiro a los 65 (edad actual 55). */
function buildM10Result(): PensionResult {
  const input: PensionInput = {
    personalData: {
      name: 'Persona de prueba',
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
      m10DailySalary: 1200,
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
      contributionSalary: 1200,
      contributionSalaryInUMAs: 10.61,
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

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(REFERENCE);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('comparisonCalculator', () => {
  test('produce dos series acumuladas de igual longitud que arrancan en 0', () => {
    const result = buildM10Result();
    const comparison = calculateComparison(result, 20);

    expect(comparison.earlyScenario.series).toHaveLength(comparison.horizonMonths + 1);
    expect(comparison.m10Scenario.series).toHaveLength(comparison.horizonMonths + 1);
    expect(comparison.earlyScenario.series[0]!.cumulativeNet).toBe(0);
    expect(comparison.m10Scenario.series[0]!.cumulativeNet).toBe(0);

    // Durante el periodo de pago, M10 descuenta y queda por debajo de «antes».
    const paymentMonth = 10;
    expect(comparison.m10Scenario.series[paymentMonth]!.cumulativeNet).toBeLessThan(
      comparison.earlyScenario.series[paymentMonth]!.cumulativeNet,
    );
  });

  test('buildEarlyRetirementInput produce un input sin M10 a los 60', () => {
    const result = buildM10Result();
    const early = buildEarlyRetirementInput(result);

    expect(early.modalidad10.active).toBe(false);
    expect(early.personalData.retirementAge).toBe(60);
    // La base es escenario-independiente: usa el SBC promedio DECLARADO de la
    // persona, no el «sobrante ordinario» de la simulación (que varía con M10).
    expect(early.projectedAverageDailySalary).toBe(result.input.averageSalary.dailySalary);
    expect(early.projectedAverageBreakdown).toBeUndefined();
  });

  test('la base «pensionarse lo antes posible» es común entre simulaciones de la misma persona', () => {
    const resultA = buildM10Result();
    // Dos simulaciones de la misma persona: mismo SBC declarado, pero el
    // «sobrante ordinario» del desglose difiere. Con una M10 larga la ventana
    // queda sin semanas ordinarias (ordinaryDailySalary = 0); con una corta
    // queda un sobrante. Antes esto producía montos base distintos.
    const resultB: PensionResult = {
      ...resultA,
      input: {
        ...resultA.input,
        projectedAverageBreakdown: {
          ...resultA.input.projectedAverageBreakdown!,
          m10Weeks: 250,
          ordinaryWeeks: 0,
          ordinaryDailySalary: 0,
          totalWeeks: 250,
        },
      },
    };

    const baseA = buildEarlyRetirementInput(resultA);
    const baseB = buildEarlyRetirementInput(resultB);

    expect(baseA.projectedAverageDailySalary).toBe(resultA.input.averageSalary.dailySalary);
    expect(baseB.projectedAverageDailySalary).toBe(resultB.input.averageSalary.dailySalary);
    expect(calculatePension(baseA).monthlyPension).toBe(calculatePension(baseB).monthlyPension);
  });

  test('si ya tiene 60+, se pensiona el mes siguiente', () => {
    const result = buildM10Result();
    const aged: PensionResult = {
      ...result,
      input: {
        ...result.input,
        personalData: { ...result.input.personalData, age: 62 },
      },
    };
    const early = buildEarlyRetirementInput(aged);
    const expected = new Date(REFERENCE.getFullYear(), REFERENCE.getMonth() + 1, 1);

    expect(early.personalData.estimatedRetirementDate).toEqual(expected);
    expect(early.personalData.retirementAge).toBe(62);
  });

  test('aplica el incremento anual post-retiro por inflación cada febrero', () => {
    const series = buildComparisonSeries({
      initialMonthlyPension: 1000,
      retirementDate: new Date(2025, 0, 15),
      monthlyCost: 0,
      payUntilMonth: -1,
      horizonMonths: 14,
      referenceDate: new Date(2025, 0, 15),
      birthDate: new Date(1965, 0, 1),
    });

    // Antes del primer febrero la pensión es la inicial.
    expect(series[0]!.monthlyPension).toBe(1000);
    // Febrero 2025: +5.55%.
    expect(series[1]!.monthlyPension).toBeCloseTo(1000 * 1.0555, 2);
    // Febrero 2026: efecto compuesto.
    const feb2026 = series.find(
      (p) => p.date.getFullYear() === 2026 && p.date.getMonth() === 1,
    )!;
    expect(feb2026.monthlyPension).toBeCloseTo(1000 * 1.0555 * 1.0555, 2);
  });

  test('calcula el punto de equilibrio cuando M10 alcanza a «antes»', () => {
    const result = buildM10Result();
    const comparison = calculateComparison(result, 40);

    expect(comparison.breakEven).not.toBeNull();
    expect(comparison.breakEven!.monthIndex).toBeGreaterThan(0);
    expect(comparison.breakEven!.monthsAfterEarlyRetirement).toBeGreaterThanOrEqual(0);
    expect(comparison.breakEven!.year).toBeGreaterThan(REFERENCE.getFullYear());
    expect(comparison.totalM10Cost).toBeGreaterThan(0);
  });

  test('no devuelve punto de equilibrio si no se alcanza dentro del horizonte', () => {
    const result = buildM10Result();
    const comparison = calculateComparison(result, 8);

    expect(comparison.breakEven).toBeNull();
  });

  test('el horizonte máximo se acota a los 90 años y el default es ese máximo', () => {
    const result = buildM10Result();
    const maxYears = getMaxHorizonYears(result);

    expect(maxYears).toBe(COMPARISON_MAX_AGE - 55);
    expect(getDefaultHorizonYears(result)).toBe(maxYears);
  });

  test('sin punto de equilibrio, el default sigue siendo el máximo del rango', () => {
    const base = buildM10Result();
    // Retiro a los 60 (igual que el escenario «antes») y sin M10: ambas curvas
    // coinciden, por lo que nunca se cruzan y no hay punto de equilibrio.
    const noBreakEven: PensionResult = {
      ...base,
      input: {
        ...base.input,
        personalData: {
          ...base.input.personalData,
          retirementAge: 60,
          estimatedRetirementDate: new Date(2030, 0, 1),
        },
        modalidad10: { active: false },
        projectedAverageDailySalary: base.input.projectedAverageBreakdown!.ordinaryDailySalary,
      },
    };

    expect(calculateComparison(noBreakEven, getMaxHorizonYears(noBreakEven)).breakEven).toBeNull();
    expect(getDefaultHorizonYears(noBreakEven)).toBe(getMaxHorizonYears(noBreakEven));
  });

  test('tolera fechas serializadas (ISO) en un resultado guardado', () => {
    const result = buildM10Result();
    const serialized: PensionResult = {
      ...result,
      input: {
        ...result.input,
        personalData: {
          ...result.input.personalData,
          birthDate: result.input.personalData.birthDate.toISOString() as unknown as Date,
          estimatedRetirementDate: result.input.personalData.estimatedRetirementDate.toISOString() as unknown as Date,
        },
      },
    };

    const comparison = calculateComparison(serialized, 20);
    expect(comparison.m10Scenario.series).toHaveLength(comparison.horizonMonths + 1);
    expect(comparison.earlyScenario.series).toHaveLength(comparison.horizonMonths + 1);
  });

  test('sin desglose, el escenario antes usa el salario promedio declarado', () => {
    const result = buildM10Result();
    const withoutBreakdown: PensionResult = {
      ...result,
      input: { ...result.input, projectedAverageBreakdown: undefined },
    };

    const early = buildEarlyRetirementInput(withoutBreakdown);
    expect(early.projectedAverageDailySalary).toBe(result.input.averageSalary.dailySalary);
    expect(early.projectedAverageBreakdown).toBeUndefined();
  });

  test('sin Modalidad 10 activa, el costo M10 es 0 y no descuenta', () => {
    const result = buildM10Result();
    const withoutM10: PensionResult = {
      ...result,
      input: { ...result.input, modalidad10: { active: false } },
    };

    const comparison = calculateComparison(withoutM10, 20);
    expect(comparison.totalM10Cost).toBe(0);
    expect(comparison.m10Scenario.series[1]!.cumulativeNet).toBe(0);
  });

  test('con Modalidad 10 activa pero sin SBC declarado, el costo M10 es 0', () => {
    const result = buildM10Result();
    const withoutSalary: PensionResult = {
      ...result,
      input: {
        ...result.input,
        modalidad10: { ...result.input.modalidad10, contributionSalary: undefined },
      },
    };

    const comparison = calculateComparison(withoutSalary, 20);
    expect(comparison.totalM10Cost).toBe(0);
  });
});
