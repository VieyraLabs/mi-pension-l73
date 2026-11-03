import { calculateProjectedSBC } from '../services/pension/history/projectedSBC';
import type { SBCPeriodSegment } from '../services/pension/history/types';
import { buildM10ContributionPeriod, getM10StartDate } from '../utils/modalidad10';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REFERENCE_DATE = new Date(2025, 0, 1);

function segment(startDate: Date, endDate: Date, sbc: number): SBCPeriodSegment {
  return {
    startDate,
    endDate,
    sbc,
    employerNames: [],
    employers: [],
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function historicalSegments(): SBCPeriodSegment[] {
  return [
    segment(addDays(REFERENCE_DATE, -300 * 7 + 1), addDays(REFERENCE_DATE, -50 * 7), 100),
    segment(addDays(REFERENCE_DATE, -50 * 7 + 1), REFERENCE_DATE, 300),
  ];
}

/**
 * Fecha de retiro alineada con la rejilla semanal del historial: el último día
 * del periodo de Modalidad 10 cae en el cierre de una semana.
 */
function alignedRetirementDate(weeks: number): Date {
  const m10Start = getM10StartDate(REFERENCE_DATE);
  return addDays(m10Start, weeks * 7 - 1);
}

function m10Period(params: {
  weeks: number;
  m10DailySalary: number;
  ordinaryDailySalary: number;
  continuesWorking: boolean;
}) {
  return buildM10ContributionPeriod({
    referenceDate: REFERENCE_DATE,
    retirementDate: alignedRetirementDate(params.weeks),
    m10DailySalary: params.m10DailySalary,
    ordinaryDailySalary: params.ordinaryDailySalary,
    continuesWorking: params.continuesWorking,
  });
}

describe('calculateProjectedSBC', () => {
  test('mezcla semanas históricas que siguen en la ventana con semanas futuras', () => {
    const retirementDate = addDays(REFERENCE_DATE, 100 * 7);

    // De las 250 semanas: 100 futuras a $300, 50 históricas a $300 y 100 a $100.
    const result = calculateProjectedSBC({
      segments: historicalSegments(),
      currentSBC: 250,
      retirementDate,
      referenceDate: REFERENCE_DATE,
    });

    expect(result.averageDailySalary).toBe(220);
    expect(result.breakdown.m10Weeks).toBe(0);
    expect(result.breakdown.ordinaryWeeks).toBe(250);
  });

  test('con al menos 250 semanas futuras usa completamente el último SBC', () => {
    const retirementDate = addDays(REFERENCE_DATE, 260 * 7);

    const result = calculateProjectedSBC({
      segments: historicalSegments(),
      currentSBC: 250,
      retirementDate,
      referenceDate: REFERENCE_DATE,
    });

    expect(result.averageDailySalary).toBe(300);
  });

  test('sin historial detallado conserva el SBC actual, no un último importe aislado', () => {
    const result = calculateProjectedSBC({
      segments: [],
      currentSBC: 250,
      retirementDate: addDays(REFERENCE_DATE, 300),
      referenceDate: REFERENCE_DATE,
    });

    expect(result.averageDailySalary).toBe(250);
  });

  test('extiende el SBC agregado de patrones concurrentes, sin volver a sumarlo', () => {
    const periods = [
      segment(addDays(REFERENCE_DATE, -300 * 7 + 1), REFERENCE_DATE, 900),
    ];
    const retirementDate = addDays(REFERENCE_DATE, 260 * 7);

    const result = calculateProjectedSBC({
      segments: periods,
      currentSBC: 250,
      retirementDate,
      referenceDate: REFERENCE_DATE,
    });

    expect(result.averageDailySalary).toBe(900);
  });

  test('el límite entre historial y futuro no deja huecos ni duplica el día de referencia', () => {
    const periods = [segment(REFERENCE_DATE, REFERENCE_DATE, 100)];
    const retirementDate = addDays(REFERENCE_DATE, 6);

    // El día actual cuenta una vez y los días siguientes continúan al último SBC ($100).
    const result = calculateProjectedSBC({
      segments: periods,
      currentSBC: 250,
      retirementDate,
      referenceDate: REFERENCE_DATE,
    });

    expect(result.averageDailySalary).toBe(100);
  });
});

describe('calculateProjectedSBC con Modalidad 10', () => {
  test('los meses de M10 se cotizan al salario declarado y entran al promedio', () => {
    // 26 semanas de M10 a $600 y 224 semanas ordinarias a $250.
    const result = calculateProjectedSBC({
      segments: [],
      currentSBC: 250,
      retirementDate: alignedRetirementDate(26),
      referenceDate: REFERENCE_DATE,
      m10Period: m10Period({
        weeks: 26,
        m10DailySalary: 600,
        ordinaryDailySalary: 250,
        continuesWorking: false,
      }),
    });

    expect(result.breakdown.m10Weeks).toBe(26);
    expect(result.breakdown.ordinaryWeeks).toBe(224);
    expect(result.breakdown.m10DailySalary).toBe(600);
    expect(result.averageDailySalary).toBe(286.4);
  });

  test('si la persona sigue trabajando, su último salario se suma al de M10', () => {
    // 26 semanas a $850 (250 + 600) y 224 semanas ordinarias a $250.
    const result = calculateProjectedSBC({
      segments: [],
      currentSBC: 250,
      retirementDate: alignedRetirementDate(26),
      referenceDate: REFERENCE_DATE,
      m10Period: m10Period({
        weeks: 26,
        m10DailySalary: 600,
        ordinaryDailySalary: 250,
        continuesWorking: true,
      }),
    });

    expect(result.breakdown.m10DailySalary).toBe(850);
    expect(result.averageDailySalary).toBe(312.4);
  });

  test('con un horizonte largo el promedio converge al salario de M10', () => {
    const result = calculateProjectedSBC({
      segments: [],
      currentSBC: 250,
      retirementDate: alignedRetirementDate(300),
      referenceDate: REFERENCE_DATE,
      m10Period: m10Period({
        weeks: 300,
        m10DailySalary: 600,
        ordinaryDailySalary: 250,
        continuesWorking: false,
      }),
    });

    expect(result.breakdown.m10Weeks).toBe(250);
    expect(result.breakdown.ordinaryWeeks).toBe(0);
    expect(result.averageDailySalary).toBe(600);
  });

  test('con historial importado, el SBC de M10 se combina con el último registrado si sigue trabajando', () => {
    const result = calculateProjectedSBC({
      segments: historicalSegments(),
      currentSBC: 250,
      retirementDate: alignedRetirementDate(26),
      referenceDate: REFERENCE_DATE,
      m10Period: m10Period({
        weeks: 26,
        m10DailySalary: 600,
        ordinaryDailySalary: 300,
        continuesWorking: true,
      }),
    });

    // El último tramo del historial cotiza a $300: es el salario registrado.
    expect(result.breakdown.m10DailySalary).toBe(900);
    expect(result.breakdown.m10Weeks).toBe(26);
    expect(result.breakdown.ordinaryWeeks).toBe(224);
  });

  test('con historial importado y sin seguir trabajando, el SBC de M10 va solo', () => {
    const result = calculateProjectedSBC({
      segments: historicalSegments(),
      currentSBC: 250,
      retirementDate: alignedRetirementDate(26),
      referenceDate: REFERENCE_DATE,
      m10Period: m10Period({
        weeks: 26,
        m10DailySalary: 600,
        ordinaryDailySalary: 300,
        continuesWorking: false,
      }),
    });

    expect(result.breakdown.m10DailySalary).toBe(600);
    expect(result.breakdown.m10Weeks).toBe(26);
  });

  test('un tramo sin SBC válido no entra al promedio', () => {
    const result = calculateProjectedSBC({
      segments: [segment(addDays(REFERENCE_DATE, -60), REFERENCE_DATE, 0)],
      currentSBC: 250,
      retirementDate: addDays(REFERENCE_DATE, 100 * 7),
      referenceDate: REFERENCE_DATE,
    });

    expect(result.averageDailySalary).toBe(250);
    expect(result.breakdown.totalWeeks).toBe(0);
  });
});
