/**
 * Pruebas unitarias del motor de cálculo de pensión Ley 73.
 * Validan los escenarios principales y casos límite.
 *
 * Para ejecutar: npm test
 */
import {
  calculatePension,
  validateInput,
} from '../services/pension/PensionCalculator';
import type { PensionInput } from '../models';
import {
  DAYS_PER_YEAR_UMA,
  AVERAGE_DAYS_PER_MONTH,
  MONTHS_PER_YEAR,
} from '../constants/ley73';

// ─────────────────────────────────────────────
// Helpers para construir inputs de prueba
// ─────────────────────────────────────────────

const UMA_2025 = 113.14;
const SMG_2025 = 278.8;

function withReferenceDate<T>(referenceDate: Date, operation: () => T): T {
  jest.useFakeTimers().setSystemTime(referenceDate);
  try {
    return operation();
  } finally {
    jest.useRealTimers();
  }
}

function buildInput(overrides: Partial<{
  semanas: number;
  salarioDiario: number;
  edadActual: number;
  edadRetiro: number;
  fechaNacimiento: Date;
  tieneConyuge: boolean;
  tieneHijosMenores: boolean;
  numeroHijos: number;
  tienePadres: boolean;
  modalidad10Activa: boolean;
  M10Salario: number;
  M10Meses: number;
  umaDiaria: number;
  smgCdmx: number;
  fechaRetiro: Date;
}>): PensionInput {
  const {
    semanas = 500,
    salarioDiario = 200,
    edadRetiro = 65,
    // Por defecto el asegurado ya está en la edad de retiro: sin proyección
    // a futuro, el comportamiento histórico se mantiene intacto.
    // La edad ACTUAL es siempre un entero (así la exige el esquema): si la
    // edad de retiro trae fracción (60.5), la edad actual es su parte entera.
    edadActual = Math.floor(edadRetiro),
    fechaNacimiento = new Date(1960, 0, 1),
    tieneConyuge = false,
    tieneHijosMenores = false,
    numeroHijos = 0,
    tienePadres = false,
    modalidad10Activa = false,
    M10Salario = 0,
    M10Meses = 0,
    umaDiaria = UMA_2025,
    smgCdmx = SMG_2025,
    fechaRetiro = new Date(2025, 0, 1),
  } = overrides;

  return {
    personalData: {
      name: 'Persona de prueba',
      birthDate: fechaNacimiento,
      age: edadActual,
      estimatedRetirementDate: fechaRetiro,
      retirementAge: edadRetiro,
    },
    workHistory: {
      totalWeeks: semanas,
      employmentRelations: [],
    },
    averageSalary: {
      dailySalary: salarioDiario,
      monthlySalary: parseFloat((salarioDiario * AVERAGE_DAYS_PER_MONTH).toFixed(2)),
      isManual: true,
    },
    uma: {
      dailyUMA: umaDiaria,
      monthlyUMA: parseFloat((umaDiaria * AVERAGE_DAYS_PER_MONTH).toFixed(2)),
      annualUMA: parseFloat((umaDiaria * DAYS_PER_YEAR_UMA).toFixed(2)),
      smgCdmx,
      year: 2025,
      isCustom: false,
    },
    modalidad10: {
      active: modalidad10Activa,
      contributionSalary: M10Salario || undefined,
      expectedMonths: M10Meses || undefined,
    },
    beneficiaries: {
      hasSpouse: tieneConyuge,
      hasMinorChildren: tieneHijosMenores,
      numberOfMinorChildren: numeroHijos,
      hasDependentParents: tienePadres,
      numberOfDependentParents: tienePadres ? 1 : 0,
    },
  };
}

// ─────────────────────────────────────────────
// Validaciones de entrada
// ─────────────────────────────────────────────

describe('validateInput', () => {
  test('rechaza semanas menores a 500 si el asegurado ya está en la edad de retiro', () => {
    // Sin horizonte por delante (edad actual = edad de retiro) no hay
    // semanas proyectadas que puedan completar el mínimo legal.
    const input = buildInput({ semanas: 499 });
    const result = validateInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('500'))).toBe(true);
  });

  test('acepta pocas semanas si la proyección por fecha exacta alcanza las 500', () => {
    withReferenceDate(new Date(2025, 5, 1), () => {
      const input = buildInput({
        semanas: 100,
        edadActual: 30,
        edadRetiro: 65,
        fechaRetiro: new Date(2060, 5, 1),
      });
      expect(validateInput(input).valid).toBe(true);
    });
  });

  test('acepta exactamente 500 semanas', () => {
    const input = buildInput({ semanas: 500 });
    const result = validateInput(input);
    expect(result.valid).toBe(true);
  });

  test('rechaza edad de retiro menor a 60', () => {
    const input = buildInput({ edadRetiro: 59 });
    const result = validateInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('60'))).toBe(true);
  });

  test('acepta edad de retiro 60 (Cesantía)', () => {
    const input = buildInput({ edadRetiro: 60 });
    const result = validateInput(input);
    expect(result.valid).toBe(true);
  });

  test('rechaza salario cero', () => {
    const input = buildInput({ salarioDiario: 0 });
    const result = validateInput(input);
    expect(result.valid).toBe(false);
  });

  test('genera advertencia con semanas entre 500 y 519', () => {
    const input = buildInput({ semanas: 510 });
    const result = validateInput(input);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('rechaza semanas menores a 500 aunque falte poco, si Modalidad 10 no está activa', () => {
    // El asegurado ya está en la edad de retiro: ni la proyección ni la M10
    // pueden completar el mínimo de 500 semanas.
    const input = buildInput({ semanas: 480 });
    const result = validateInput(input);
    expect(result.valid).toBe(false);
  });

  test('acepta semanas menores a 500 cuando M10 por fechas completa el mínimo', () => {
    withReferenceDate(new Date(2025, 4, 30), () => {
      const input = buildInput({
        semanas: 496,
        modalidad10Activa: true,
        M10Salario: 300,
        M10Meses: 24,
        fechaRetiro: new Date(2025, 5, 15),
      });
      expect(validateInput(input).valid).toBe(true);
    });
  });

  test('rechaza semanas menores a 500 cuando la M10 por fechas no completa el mínimo', () => {
    withReferenceDate(new Date(2025, 4, 30), () => {
      const input = buildInput({
        semanas: 400,
        modalidad10Activa: true,
        M10Salario: 300,
        M10Meses: 6,
        fechaRetiro: new Date(2025, 5, 15),
      });
      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('planeadas en Modalidad 10'))).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────
// Modalidad 10 — semanas proyectadas
// ─────────────────────────────────────────────
//
// Los meses de Modalidad 10 que el usuario planea contratar a futuro
// (`expectedMonths`) no están incluidos en `workHistory.totalWeeks` — deben
// sumarse al total de semanas usado para el mínimo de 500 y los incrementos
// anuales, no solo usarse para el promedio ponderado del SBC.

describe('calculatePension — Modalidad 10 (semanas proyectadas)', () => {
  test('la proyección M10 dentro del horizonte no duplica las semanas estimadas', () => {
    withReferenceDate(new Date(2025, 5, 1), () => {
      const fechaRetiro = new Date(2026, 5, 30);
      const sinM10 = calculatePension(
        buildInput({ semanas: 500, fechaRetiro }),
      );
      const conM10 = calculatePension(
        buildInput({
          semanas: 500,
          fechaRetiro,
          modalidad10Activa: true,
          M10Salario: 200,
          M10Meses: 12,
        }),
      );

      expect(sinM10.weeksProjection?.projectedWeeks).toBe(56);
      expect(conM10.weeksProjection?.projectedWeeks).toBe(56);
      expect(conM10.weeksProjection?.targetWeeks).toBe(556);
      expect(conM10.weeksProjection?.targetWeeks).toBe(sinM10.weeksProjection?.targetWeeks);
    });
  });

  test('sin Modalidad 10 activa, las semanas proyectadas no se suman', () => {
    const input = buildInput({ semanas: 500, modalidad10Activa: false, M10Meses: 12 });
    const result = calculatePension(input);
    const paso = result.steps.find((p) => p.id === 'incrementos_anuales');
    expect(paso?.description).not.toMatch(/Modalidad 10/i);
  });

  test('los meses de M10 que llegan más allá del horizonte se narran aparte', () => {
    // El retiro cae a principios del mes: M10 alcanza el fin del mes de
    // retiro y aporta semanas que la proyección por días no cubre.
    withReferenceDate(new Date(2025, 11, 20), () => {
      const result = calculatePension(
        buildInput({
          semanas: 500,
          edadActual: 30,
          edadRetiro: 65,
          modalidad10Activa: true,
          M10Salario: 300,
          M10Meses: 1,
          fechaRetiro: new Date(2026, 0, 5),
        }),
      );
      const paso = result.steps.find((p) => p.id === 'incrementos_anuales');

      expect(paso?.assumption).toContain('meses de Modalidad 10');
    });
  });

  test('AverageSalaryStep narra el reparto de semanas de M10 del SBC proyectado', () => {
    const result = calculatePension({
      ...buildInput({ semanas: 500, salarioDiario: 200 }),
      projectedAverageDailySalary: 212.4,
      projectedAverageBreakdown: {
        totalWeeks: 250,
        m10Weeks: 31,
        ordinaryWeeks: 219,
        m10DailySalary: 300,
        ordinaryDailySalary: 200,
      },
    });
    const averageStep = result.steps.find((step) => step.id === 'salario_promedio');

    expect(averageStep?.description).toContain(
      '219 sem. ordinarias ($200.00/día) + 31 sem. M10 ($300.00/día) = $212.40/día',
    );
    expect(averageStep?.formula).toContain('÷ 250');
    expect(averageStep?.isEstimate).toBe(true);
  });

  test('avisa cuando la M10 está activa pero el SBC proyectado no incluye sus meses', () => {
    const result = calculatePension(
      buildInput({ semanas: 500, modalidad10Activa: true, M10Salario: 300, M10Meses: 7 }),
    );

    expect(
      result.warnings.some((w) =>
        w.includes('el SBC promedio proyectado no incluye sus meses'),
      ),
    ).toBe(true);
  });

  test('la proyección de semanas conserva su forma pública', () => {
    withReferenceDate(new Date(2025, 5, 1), () => {
      const result = calculatePension(
        buildInput({
          semanas: 500,
          fechaRetiro: new Date(2026, 0, 31),
        }),
      );
      const projectionKeys = [
        'currentWeeks',
        'projectedWeeks',
        'targetWeeks',
        'yearsToRetirement',
      ];
      expect(Object.keys(result.weeksProjection!).sort()).toEqual(projectionKeys.sort());
      const serializedProjection = JSON.parse(JSON.stringify(result)).weeksProjection;
      expect(Object.keys(serializedProjection).sort()).toEqual(projectionKeys.sort());
    });
  });
});

// ─────────────────────────────────────────────
// Proyección de semanas hasta la edad de retiro
// ─────────────────────────────────────────────
//
// Un asegurado que todavía no llega a la edad de retiro seguirá cotizando
// (en el supuesto de la app). Esas semanas proyectadas alimentan el mínimo
// de 500 semanas y los incrementos anuales del Art. 167 LSS 1973.

describe('calculatePension — Proyección de semanas al jubilarse', () => {
  test('las semanas hasta la fecha exacta de retiro alimentan los incrementos del Art. 167', () => {
    withReferenceDate(new Date(2025, 5, 1), () => {
      const input = buildInput({
        semanas: 100,
        edadActual: 30,
        edadRetiro: 65,
        salarioDiario: UMA_2025,
        fechaRetiro: new Date(2060, 5, 1),
      });
      const result = calculatePension(input);

      const paso = result.steps.find((p) => p.id === 'incrementos_anuales');
      expect(result.annualIncrements).toBeGreaterThan(0);
      expect(paso?.description).toMatch(/1826/);
      expect(paso?.description).toMatch(/1926/);
      expect(paso?.isEstimate).toBe(true);
      expect(paso?.assumption).toMatch(/proyectadas/i);
    });
  });

  test('el resultado expone las cifras coherentes de la proyección por fechas', () => {
    withReferenceDate(new Date(2025, 5, 1), () => {
      const input = buildInput({
        semanas: 100,
        edadActual: 30,
        edadRetiro: 65,
        fechaRetiro: new Date(2060, 5, 1),
      });
      const result = calculatePension(input);

      expect(result.weeksProjection).toBeDefined();
      expect(result.weeksProjection?.currentWeeks).toBe(100);
      expect(result.weeksProjection?.projectedWeeks).toBe(1826);
      expect(result.weeksProjection?.targetWeeks).toBe(1926);
      expect(result.weeksProjection?.yearsToRetirement).toBe(35);
    });
  });

  test('sin horizonte a futuro la proyección es cero y el total son las semanas cotizadas', () => {
    const input = buildInput({ semanas: 800, edadActual: 65, edadRetiro: 65 });
    const result = calculatePension(input);

    expect(result.weeksProjection?.projectedWeeks).toBe(0);
    expect(result.weeksProjection?.targetWeeks).toBe(800);
    expect(result.weeksProjection?.yearsToRetirement).toBe(0);
  });

  test('las semanas de Modalidad 10 dentro del horizonte no se cuentan dos veces', () => {
    // 35 años proyectados (1820 semanas) con 12 meses de M10 (52 semanas):
    // la M10 cae dentro del horizonte, así que el total NO es 1920 + 52.
    withReferenceDate(new Date(2025, 5, 1), () => {
      const input = buildInput({
        semanas: 100,
        edadActual: 30,
        edadRetiro: 65,
        modalidad10Activa: true,
        M10Salario: 200,
        M10Meses: 12,
        fechaRetiro: new Date(2060, 5, 1),
      });
      const result = calculatePension(input);

      expect(result.weeksProjection?.targetWeeks).toBe(100 + 1826);
    });
  });

  test('conserva como calculationDate el instante capturado al inicio de la operación', () => {
    const calculationStart = new Date(2025, 4, 31, 23, 59);
    const laterInstant = new Date(2025, 5, 1, 0, 1);
    jest.useFakeTimers().setSystemTime(calculationStart);
    const input = buildInput({
      semanas: 100,
      edadActual: 30,
      edadRetiro: 65,
      fechaRetiro: new Date(2026, 5, 30),
    });
    const personalData = input.personalData;
    Object.defineProperty(input, 'personalData', {
      get() {
        jest.setSystemTime(laterInstant);
        return personalData;
      },
    });

    let result: ReturnType<typeof calculatePension>;
    try {
      result = calculatePension(input);
    } finally {
      jest.useRealTimers();
    }

    expect(result!.calculationDate).toBe(calculationStart.toISOString());
  });

  test('el motor es determinista para una fecha de referencia fija', () => {
    withReferenceDate(new Date(2025, 5, 1), () => {
      const input = buildInput({
        semanas: 100,
        edadActual: 30,
        edadRetiro: 65,
        fechaRetiro: new Date(2060, 5, 1),
      });
      const primero = calculatePension(input);
      const segundo = calculatePension(input);

      expect(segundo.weeksProjection).toEqual(primero.weeksProjection);
      expect(segundo.monthlyPension).toBe(primero.monthlyPension);
    });
  });

  test('la weeksProjection coincide con las cifras que narra el motor', () => {
    withReferenceDate(new Date(2025, 5, 1), () => {
      const input = buildInput({
        semanas: 100,
        edadActual: 30,
        edadRetiro: 65,
        fechaRetiro: new Date(2060, 5, 1),
      });
      const result = calculatePension(input);

      const paso = result.steps.find((p) => p.id === 'incrementos_anuales');
      expect(paso?.description).toMatch(/100 cotizadas/);
      expect(paso?.description).toMatch(/1826 proyectadas hasta la edad de retiro/);
      expect(paso?.description).toMatch(/1926/);
      expect(result.weeksProjection?.currentWeeks).toBe(100);
      expect(result.weeksProjection?.projectedWeeks).toBe(1826);
      expect(result.weeksProjection?.targetWeeks).toBe(1926);
    });
  });
});

// ─────────────────────────────────────────────
// Cálculo de pensión — Casos principales
// ─────────────────────────────────────────────

describe('calculatePension — Pensión de Vejez (65 años)', () => {
  test('calcula pensión básica con 500 semanas y salario bajo (≤1 UMA)', () => {
    // Salario = 1 UMA diaria → cuantía básica 80% (Art. 167 LSS 1973)
    const input = buildInput({
      semanas: 500,
      salarioDiario: UMA_2025, // exactamente 1 UMA
      edadRetiro: 65,
    });
    const result = calculatePension(input);

    expect(result.pensionType).toBe('vejez');
    expect(result.ageFactor).toBe(1.0);
    expect(result.monthlyPension).toBeGreaterThan(0);
    // Fórmula: Cuantía Básica Anual = Salario Diario × 365 × Porcentaje
    // Cuantía Básica Mensual = Cuantía Básica Anual / 12
    const esperado = (UMA_2025 * 365 * 0.8) / 12; // 80% del SBC anual / 12
    expect(result.basicAmount).toBeCloseTo(esperado, 0);
    expect(result.annualIncrements).toBe(0); // sin excedentes
    expect(result.isEstimate).toBe(true);
  });

  test('cuantía básica correcta con salario en el hueco entre rangos (1.005x UMA)', () => {
    // vecesSMG = 1.005 cae entre rangoMax 1.0 y rangoMin 1.01 de la tabla original.
    // Con el matcher antiguo (find con rangoMax) se asignaba el último rango (37.5%).
    // Con el fix debe asignarse el rango 1.01–1.25 (77.11%).
    const salario1005UMA = UMA_2025 * 1.005;
    const input = buildInput({
      semanas: 500,
      salarioDiario: salario1005UMA,
      edadRetiro: 65,
    });
    const result = calculatePension(input);

    // 77.11% del SBC anual / 12 (rango 1.01–1.25), NO 13% (último rango)
    const esperado7711 = (salario1005UMA * 365 * 0.7711) / 12;
    const incorrecto13 = (salario1005UMA * 365 * 0.13) / 12;
    expect(result.basicAmount).toBeCloseTo(esperado7711, 0);
    expect(result.basicAmount).not.toBeCloseTo(incorrecto13, 0);
  });

  test('calcula incrementos anuales correctamente', () => {
    // 552 semanas = 500 + 52 → 1 año adicional
    const input = buildInput({
      semanas: 552,
      salarioDiario: UMA_2025,
      edadRetiro: 65,
    });
    const result = calculatePension(input);

    expect(result.annualIncrements).toBeGreaterThan(0);
    // 1 año excedente = 0.563% del SBC anual / 12 (primer rango)
    const incrementoEsperado = (UMA_2025 * 365 * 0.00563) / 12;
    expect(result.annualIncrements).toBeCloseTo(incrementoEsperado, 0);
  });

  test('mayor cantidad de semanas produce pensión mayor', () => {
    const input500 = buildInput({ semanas: 500, salarioDiario: UMA_2025 * 10, edadRetiro: 65 });
    const input1000 = buildInput({ semanas: 1000, salarioDiario: UMA_2025 * 10, edadRetiro: 65 });

    const result500 = calculatePension(input500);
    const result1000 = calculatePension(input1000);

    expect(result1000.annualIncrements).toBeGreaterThan(result500.annualIncrements);
    expect(result1000.monthlyPension).toBeGreaterThan(result500.monthlyPension);
  });

  test('usa el SBC proyectado opcional y conserva el SBC actual como entrada independiente', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 200, edadRetiro: 65 });
    const actual = calculatePension(input);
    const projected = calculatePension({ ...input, projectedAverageDailySalary: 300 });

    expect(projected.basicAmount).toBeGreaterThan(actual.basicAmount);
    expect(projected.steps.find((step) => step.id === 'salario_promedio')?.value).toBeGreaterThan(
      actual.steps.find((step) => step.id === 'salario_promedio')?.value ?? 0,
    );
    expect(projected.input.averageSalary.dailySalary).toBe(200);
    expect(projected.input.projectedAverageDailySalary).toBe(300);
    expect(projected.steps.find((step) => step.id === 'salario_promedio')?.description).toContain('$300.00/día');
  });

  test('mayor salario produce pensión mayor (mismo número de semanas)', () => {
    const inputBajo = buildInput({ semanas: 1200, salarioDiario: UMA_2025 * 5, edadRetiro: 65 });
    const inputAlto = buildInput({ semanas: 1200, salarioDiario: UMA_2025 * 10, edadRetiro: 65 });

    const resultBajo = calculatePension(inputBajo);
    const resultAlto = calculatePension(inputAlto);

    expect(resultAlto.pmgApplied).toBe(false);
    expect(resultBajo.pmgApplied).toBe(false);
    expect(resultAlto.monthlyPension).toBeGreaterThan(resultBajo.monthlyPension);
  });

  test('la pensión anual es 12 veces la mensual', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);

    expect(result.annualPension).toBeCloseTo(result.monthlyPension * MONTHS_PER_YEAR, 1);
  });

  test('el monto diario es la mensual / días promedio del mes', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);

    expect(result.dailyAmount).toBeCloseTo(result.monthlyPension / AVERAGE_DAYS_PER_MONTH, 1);
  });
});

// ─────────────────────────────────────────────
// Cesantía en Edad Avanzada — factores de edad
// ─────────────────────────────────────────────

describe('calculatePension — Cesantía en Edad Avanzada', () => {
  test('retiro a 60 años aplica factor 75%', () => {
    const inputVejez = buildInput({ semanas: 1200, salarioDiario: UMA_2025 * 10, edadRetiro: 65 });
    const inputCesantia60 = buildInput({ semanas: 1200, salarioDiario: UMA_2025 * 10, edadRetiro: 60 });

    const resultVejez = calculatePension(inputVejez);
    const resultCesantia60 = calculatePension(inputCesantia60);

    expect(resultCesantia60.pensionType).toBe('cesantia_edad_avanzada');
    expect(resultCesantia60.ageFactor).toBe(0.75);
    // La pensión a 60 debe ser ~75% de la de 65 (antes de asignaciones/límites)
    expect(resultCesantia60.monthlyPension).toBeLessThan(resultVejez.monthlyPension);
  });

  test('retiro a 65 años aplica factor 100%', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);

    expect(result.pensionType).toBe('vejez');
    expect(result.ageFactor).toBe(1.0);
  });

  test('factores de edad de 60 a 65 aumentan progresivamente', () => {
    const factoresEsperados = [0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
    factoresEsperados.forEach((factor, i) => {
      const edad = 60 + i;
      const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: edad });
      const result = calculatePension(input);
      expect(result.ageFactor).toBe(factor);
    });
  });
});

// ─────────────────────────────────────────────
// Regla del Art. 171 LSS 1973 — edad legal
// "Se aumentan un año a los cumplidos cuando la edad los exceda en seis meses."
// ─────────────────────────────────────────────

describe('calculatePension — Art. 171 LSS 1973 (edad legal por seis meses)', () => {
  test('60 años cumplidos exactos: cesantía con factor 75 %', () => {
    const result = calculatePension(
      buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 60 }),
    );

    expect(result.pensionType).toBe('cesantia_edad_avanzada');
    expect(result.ageFactor).toBe(0.75);

    const paso = result.steps.find((p) => p.id === 'factor_edad');
    expect(paso?.description).toMatch(/60 años/);
    // La edad declarada coincide con la legal: no hay paréntesis que aclare.
    expect(paso?.description).not.toMatch(/edad legal;/);
    expect(paso?.legalBasis).toMatch(/Art\. 171 LSS 1973/);
  });

  test('60 años y 6 meses: la edad legal es 61 → cesantía con factor 80 %', () => {
    const result = calculatePension(
      buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 60.5 }),
    );

    expect(result.pensionType).toBe('cesantia_edad_avanzada');
    expect(result.ageFactor).toBe(0.8);

    // El desglose narra la EDAD LEGAL y deja auditable el salto del Art. 171.
    const paso = result.steps.find((p) => p.id === 'factor_edad');
    expect(paso?.description).toMatch(/61 años/);
    expect(paso?.description).toMatch(/60\.5 años cumplidos/);
    expect(paso?.description).toMatch(/Art\. 171/);
    expect(paso?.legalBasis).toMatch(/Art\. 171 LSS 1973/);

    const advertencia = result.warnings.find((w) => w.includes('Cesantía'));
    expect(advertencia).toBeDefined();
    expect(advertencia).toMatch(/61 años/);
    expect(advertencia).toMatch(/60\.5 años cumplidos/);
    expect(advertencia).toMatch(/Art\. 171/);
  });

  test('64 años y 6 meses: la edad legal es 65 → vejez sin reducción', () => {
    const result = calculatePension(
      buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 64.5 }),
    );

    expect(result.pensionType).toBe('vejez');
    expect(result.ageFactor).toBe(1.0);

    const paso = result.steps.find((p) => p.id === 'factor_edad');
    expect(paso?.description).toMatch(/65 años/);
    expect(paso?.description).toMatch(/64\.5 años cumplidos/);
    expect(paso?.legalBasis).toMatch(/Art\. 138 LSS 1973/);
  });

  test('60 años y 3 meses: la edad legal sigue en 60 → cesantía con factor 75 %', () => {
    const result = calculatePension(
      buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 60.25 }),
    );

    expect(result.pensionType).toBe('cesantia_edad_avanzada');
    expect(result.ageFactor).toBe(0.75);

    const paso = result.steps.find((p) => p.id === 'factor_edad');
    expect(paso?.description).toMatch(/60 años/);
    // La edad declarada (60.25) NO coincide con la legal (60): se audita.
    expect(paso?.description).toMatch(/60\.25 años cumplidos/);
    expect(paso?.description).toMatch(/Art\. 171/);
  });
});

// ─────────────────────────────────────────────
// Asignaciones familiares
// ─────────────────────────────────────────────

describe('calculatePension — Asignaciones familiares', () => {
  test('sin beneficiarios aplica ayuda asistencial 15%', () => {
    const input = buildInput({
      semanas: 800,
      salarioDiario: 300,
      edadRetiro: 65,
      tieneConyuge: false,
      tieneHijosMenores: false,
    });
    const result = calculatePension(input);

    expect(result.familyAllowances).toBe(0);
    expect(result.assistanceAid).toBeGreaterThan(0);
    // 15% de la cuantía con factor (básica + incrementos + decreto 11%) según Art. 165 LSS 1973
    const cuantiaConFactor =
      (result.basicAmount + result.annualIncrements + result.decree11Increment) * result.ageFactor;
    expect(result.assistanceAid).toBeCloseTo(cuantiaConFactor * 0.15, 0);
  });

  test('con cónyuge suma 15% de asignación familiar', () => {
    const inputSin = buildInput({ semanas: 1200, salarioDiario: UMA_2025 * 10, edadRetiro: 65, tieneConyuge: false });
    const inputCon = buildInput({ semanas: 1200, salarioDiario: UMA_2025 * 10, edadRetiro: 65, tieneConyuge: true });

    const resultSin = calculatePension(inputSin);
    const resultCon = calculatePension(inputCon);

    expect(resultCon.familyAllowances).toBeGreaterThan(0);
    expect(resultCon.monthlyPension).toBeGreaterThan(resultSin.monthlyPension);
  });

  test('cada hijo suma 10% de asignación familiar', () => {
    const input1hijo = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65, tieneHijosMenores: true, numeroHijos: 1 });
    const input2hijos = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65, tieneHijosMenores: true, numeroHijos: 2 });

    const result1 = calculatePension(input1hijo);
    const result2 = calculatePension(input2hijos);

    expect(result2.familyAllowances).toBeGreaterThan(result1.familyAllowances);
    // La diferencia debe ser ~10% de la cuantía con factor (básica + incrementos + decreto 11%) según Art. 164 LSS 1973
    const diff = result2.familyAllowances - result1.familyAllowances;
    const cuantiaConFactor1 =
      (result1.basicAmount + result1.annualIncrements + result1.decree11Increment) * result1.ageFactor;
    expect(diff).toBeCloseTo(cuantiaConFactor1 * 0.1, 0);
  });
});

// ─────────────────────────────────────────────
// Tope de 25 UMA
// ─────────────────────────────────────────────

describe('calculatePension — Tope 25 UMA', () => {
  test('SBC mayor a 25 UMA se topa', () => {
    const salarioExcesivo = UMA_2025 * 30; // 30 UMA — superior al tope
    const input = buildInput({
      semanas: 800,
      salarioDiario: salarioExcesivo,
      edadRetiro: 65,
    });
    const result = calculatePension(input);

    expect(result.capApplied).toBe(true);
  });

  test('SBC igual a 25 UMA NO se topa', () => {
    const salario25UMA = UMA_2025 * 25; // exactamente el tope
    const input = buildInput({
      semanas: 800,
      salarioDiario: salario25UMA,
      edadRetiro: 65,
    });
    const result = calculatePension(input);

    // No se topa (está en el límite exacto)
    expect(result.capApplied).toBe(false);
  });

  test('SBC menor a 25 UMA no se topa', () => {
    const input = buildInput({
      semanas: 800,
      salarioDiario: 200, // menor a 25 UMA
      edadRetiro: 65,
    });
    const result = calculatePension(input);

    expect(result.capApplied).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Pensión Mínima Garantizada
// ─────────────────────────────────────────────

describe('calculatePension — Pensión Mínima Garantizada', () => {
  test('salario muy bajo activa la PMG', () => {
    const input = buildInput({
      semanas: 500,
      salarioDiario: 1, // salario irreal
      edadRetiro: 65,
    });
    const result = calculatePension(input);

    expect(result.pmgApplied).toBe(true);
    expect(result.monthlyPension).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// Desglose de pasos
// ─────────────────────────────────────────────

describe('calculatePension — Desglose', () => {
  test('el desglose contiene los pasos esperados', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);

    const ids = result.steps.map((p) => p.id);
    expect(ids).toContain('salario_promedio');
    expect(ids).toContain('cuantia_basica');
    expect(ids).toContain('incrementos_anuales');
    expect(ids).toContain('incremento_decreto_11');
    expect(ids).toContain('factor_edad');
    expect(ids).toContain('resultado_final');
  });

  test('todas las advertencias son strings no vacíos', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);

    result.warnings.forEach((adv) => {
      expect(typeof adv).toBe('string');
      expect(adv.length).toBeGreaterThan(0);
    });
  });

  test('la fecha exacta cambia semanas sin modificar edad de retiro ni factor de edad', () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 5, 1));
    try {
      const inputEarlier = buildInput({ semanas: 500, edadActual: 64, edadRetiro: 65 });
      inputEarlier.personalData.estimatedRetirementDate = new Date(2025, 5, 11);
      const inputLater = {
        ...inputEarlier,
        personalData: {
          ...inputEarlier.personalData,
          estimatedRetirementDate: new Date(2025, 5, 12),
        },
      };

      const earlier = calculatePension(inputEarlier);
      const later = calculatePension(inputLater);
      const today = calculatePension({
        ...inputEarlier,
        personalData: { ...inputEarlier.personalData, estimatedRetirementDate: new Date(2025, 5, 1) },
      });
      const past = calculatePension({
        ...inputEarlier,
        personalData: { ...inputEarlier.personalData, estimatedRetirementDate: new Date(2025, 4, 31) },
      });

      expect(earlier.weeksProjection?.projectedWeeks).toBe(1);
      expect(later.weeksProjection?.projectedWeeks).toBe(2);
      expect(earlier.weeksProjection?.yearsToRetirement).toBe(1);
      expect(later.weeksProjection?.yearsToRetirement).toBe(1);
      expect(earlier.ageFactor).toBe(later.ageFactor);
      expect(today.weeksProjection?.projectedWeeks).toBe(0);
      expect(past.weeksProjection?.projectedWeeks).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('el resultado siempre marca esEstimacion: true', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);
    expect(result.isEstimate).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Incremento del 11% (Decreto DOF 2001/2004)
// ─────────────────────────────────────────────

describe('calculatePension — Incremento del 11% (Decreto DOF 2001/2004)', () => {
  test('el incremento equivale al 11% de cuantía básica + incrementos anuales', () => {
    const input = buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);

    const cuantiaAntesDecreto = result.basicAmount + result.annualIncrements;
    expect(result.decree11Increment).toBeCloseTo(cuantiaAntesDecreto * 0.11, 1);
  });

  test('con salario 0 el incremento es 0', () => {
    const input = buildInput({ semanas: 500, salarioDiario: 0, edadRetiro: 65 });
    const result = calculatePension(input);
    expect(result.decree11Increment).toBe(0);
  });

  test('el incremento se refleja en la pensión final (comparado sin el paso)', () => {
    const input = buildInput({ semanas: 500, salarioDiario: 300, edadRetiro: 65 });
    const result = calculatePension(input);

    const cuantiaAntesDecreto = result.basicAmount + result.annualIncrements;
    const pensionSinDecretoAprox = cuantiaAntesDecreto * result.ageFactor;
    expect(result.monthlyPension).toBeGreaterThan(pensionSinDecretoAprox);
  });
});

// ─────────────────────────────────────────────
// Invariante de explicabilidad (RNF-006)
// CHG-20261024-002 / US-006: todo paso del desglose conserva fórmula,
// fundamento legal y marca de estimación. Si un step real viola este
// invariante, se corrige el step — no el test.
// ─────────────────────────────────────────────

describe('calculatePension — Invariante de explicabilidad del desglose', () => {
  const escenarios: Array<[string, ReturnType<typeof buildInput>]> = [
    ['vejez estándar', buildInput({ semanas: 800, salarioDiario: 300, edadRetiro: 65 })],
    [
      'cesantía a los 60 con factor reducido',
      buildInput({ semanas: 1200, salarioDiario: UMA_2025 * 10, edadRetiro: 60 }),
    ],
    [
      'salario alto que activa el tope de 25 UMA',
      buildInput({ semanas: 800, salarioDiario: UMA_2025 * 30, edadRetiro: 65 }),
    ],
    ['salario mínimo que activa la PMG', buildInput({ semanas: 500, salarioDiario: 1, edadRetiro: 65 })],
    [
      'con beneficiarios (asignaciones familiares)',
      buildInput({
        semanas: 800,
        salarioDiario: 300,
        edadRetiro: 65,
        tieneConyuge: true,
        tieneHijosMenores: true,
        numeroHijos: 2,
      }),
    ],
    [
      'con Modalidad 10 planeada',
      buildInput({ semanas: 500, salarioDiario: 200, modalidad10Activa: true, M10Salario: 300, M10Meses: 24 }),
    ],
  ];

  test.each(escenarios)(
    'cada paso conserva title/description, fórmula, fundamento legal y marca de estimación (%s)',
    (_nombre, input) => {
      const result = calculatePension(input);
      expect(result.steps.length).toBeGreaterThan(0);

      for (const step of result.steps) {
        expect(typeof step.title).toBe('string');
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(typeof step.description).toBe('string');
        expect(step.description.trim().length).toBeGreaterThan(0);
        expect(typeof step.formula).toBe('string');
        expect(step.formula!.trim().length).toBeGreaterThan(0);
        expect(typeof step.legalBasis).toBe('string');
        expect(step.legalBasis!.trim().length).toBeGreaterThan(0);
        expect(typeof step.isEstimate).toBe('boolean');
      }
    },
  );
});
