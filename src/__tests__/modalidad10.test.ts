import {
  buildM10ContributionPeriod,
  calculateM10MonthlyBreakdown,
  calculateM10MonthlyCost,
  calculateM10PlannedWeeks,
  clampM10Salary,
  estimateM10Months,
  getM10StartDate,
  m10CesantiaPct,
  m10SalaryFromUMAs,
  m10SalaryInUMAs,
  m10SalaryRange,
  resolveM10CesantiaBand,
} from '../utils/modalidad10';
import type { M10MonthlyCostParams } from '../utils/modalidad10';

const UMA = 113.14;
const SMG = 278.8;

describe('Modalidad 10 por fechas', () => {
  test('cuenta desde el próximo mes hasta el mes de retiro inclusive', () => {
    const referenceDate = new Date(2025, 5, 1);
    const retirementDate = new Date(2025, 6, 15);

    expect(estimateM10Months(referenceDate, retirementDate)).toBe(1);
    expect(calculateM10PlannedWeeks(referenceDate, retirementDate)).toBe(4);
  });

  test('no proyecta meses ni semanas si el retiro ocurre antes del mes siguiente', () => {
    const referenceDate = new Date(2025, 5, 30);
    const retirementDate = new Date(2025, 5, 30);

    expect(estimateM10Months(referenceDate, retirementDate)).toBe(0);
    expect(calculateM10PlannedWeeks(referenceDate, retirementDate)).toBe(0);
  });

  test('cuenta el mes contractual completo aunque el retiro sea el día 1', () => {
    const referenceDate = new Date(2025, 5, 30);
    const retirementDate = new Date(2025, 6, 1);

    expect(estimateM10Months(referenceDate, retirementDate)).toBe(1);
    expect(calculateM10PlannedWeeks(referenceDate, retirementDate)).toBe(4);
  });

  test('limita meses y semanas planeadas al fin del mes 600', () => {
    const referenceDate = new Date(2025, 5, 1);
    const retirementDate = new Date(2080, 0, 15);

    expect(estimateM10Months(referenceDate, retirementDate)).toBe(600);
    expect(calculateM10PlannedWeeks(referenceDate, retirementDate)).toBe(2609);
  });

  test('el primer día cotizable es el 1º del mes siguiente a la referencia', () => {
    expect(getM10StartDate(new Date(2025, 5, 1))).toEqual(new Date(2025, 6, 1));
    expect(getM10StartDate(new Date(2025, 5, 30))).toEqual(new Date(2025, 6, 1));
  });
});

describe('Modalidad 10 — SBC en UMAs', () => {
  test('convierte el SBC a UMAs y de vuelta', () => {
    expect(m10SalaryInUMAs(2262.8, UMA)).toBe(20);
    expect(m10SalaryFromUMAs(20, UMA)).toBe(2262.8);
  });

  test('el rango legal va del salario mínimo de la zona a 25 UMA', () => {
    const range = m10SalaryRange(UMA, SMG);

    expect(range.minimumDailySalary).toBe(SMG);
    expect(range.minimumUMAs).toBe(2.46);
    expect(range.maximumUMAs).toBe(25);
    expect(range.maximumDailySalary).toBe(2828.5);
  });

  test('acota un SBC fuera del rango legal', () => {
    expect(clampM10Salary(100, UMA, SMG)).toBe(SMG);
    expect(clampM10Salary(99999, UMA, SMG)).toBe(2828.5);
    expect(clampM10Salary(1000, UMA, SMG)).toBe(1000);
  });
});

describe('Modalidad 10 — periodo de cotización', () => {
  const referenceDate = new Date(2025, 5, 1);
  const retirementDate = new Date(2030, 5, 30);

  test('sin seguir trabajando el SBC del periodo es el de la Modalidad 10', () => {
    const period = buildM10ContributionPeriod({
      referenceDate,
      retirementDate,
      m10DailySalary: 2000,
      ordinaryDailySalary: 500,
      continuesWorking: false,
    });

    expect(period?.dailySalary).toBe(2000);
    expect(period?.months).toBe(60);
    expect(period?.startDate).toEqual(new Date(2025, 6, 1));
    expect(period?.endDate).toEqual(retirementDate);
  });

  test('si sigue trabajando, su último salario registrado se suma al de M10', () => {
    const period = buildM10ContributionPeriod({
      referenceDate,
      retirementDate,
      m10DailySalary: 2000,
      ordinaryDailySalary: 500,
      continuesWorking: true,
    });

    expect(period?.dailySalary).toBe(2500);
  });

  test('la suma de los salarios concurrentes NO se topa a 25 UMA', () => {
    // Art. 39 LSS 1973 / Art. 33 LSS vigente: para el goce de prestaciones el
    // asegurado se clasifica por la SUMA de los salarios percibidos. El tope
    // de 25 UMA aplica a los aportes y al promedio del SBC (lo aplica el
    // motor, en el paso 1), no a la suma que entra al promedio.
    const period = buildM10ContributionPeriod({
      referenceDate,
      retirementDate,
      m10DailySalary: 2800,
      ordinaryDailySalary: 500,
      continuesWorking: true,
    });

    expect(period?.dailySalary).toBe(3300);
  });

  test('sin un mes contractual por delante no hay periodo', () => {
    const period = buildM10ContributionPeriod({
      referenceDate: new Date(2025, 5, 30),
      retirementDate: new Date(2025, 5, 30),
      m10DailySalary: 2000,
      ordinaryDailySalary: 500,
      continuesWorking: true,
    });

    expect(period).toBeNull();
  });
});

describe('Modalidad 10 — cuota mensual', () => {
  const UMA_2026 = 117.31;
  const SMG_2026 = 315.04;

  /** 25 UMA de 2026: $2,932.75/día. */
  const MAX_UMAS_2026 = 2932.75;

  test('reproduce la estructura de financiamiento oficial del IMSS', () => {
    // Fórmula de la calculadora oficial del IMSS (Personas Trabajadoras
    // Independientes, marzo 2026) con UMA 2026 y clase III.
    const b = calculateM10MonthlyBreakdown({
      dailySalary: MAX_UMAS_2026,
      riskClass: 3,
      dailyUMA: UMA_2026,
      minimumDailySalary: SMG_2026,
      year: 2026,
    });

    expect(b.monthlySalary).toBe(89155.6);
    expect(b.semCuotaFija).toBe(727.51);
    expect(b.semCuotaExcedente).toBe(1176.85);
    expect(b.semPrestacionesDinero).toBe(846.98);
    expect(b.semGastosMedicosPensionados).toBe(1270.47);
    expect(b.riesgosTrabajo).toBe(2316.62);
    expect(b.invalidezVida).toBe(2117.45);
    expect(b.guarderiasPrestacionesSociales).toBe(891.56);
    expect(b.retiro).toBe(1783.11);
    expect(b.cesantiaVejez).toBe(7701.26);
    expect(b.total).toBe(18831.81);
    expect(b.effectivePct).toBe(0.2112);
    expect(b.cesantiaBandLabel).toBe('Más de 4 UMA');
    expect(b.cesantiaPct).toBe(7.513);
  });

  test('la cuota es la suma de sus ramas: no incluye INFONAVIT', () => {
    const b = calculateM10MonthlyBreakdown({
      dailySalary: MAX_UMAS_2026,
      riskClass: 3,
      dailyUMA: UMA_2026,
      minimumDailySalary: SMG_2026,
      year: 2026,
    });

    const sumaRamas =
      b.semCuotaFija +
      b.semCuotaExcedente +
      b.semPrestacionesDinero +
      b.semGastosMedicosPensionados +
      b.riesgosTrabajo +
      b.invalidezVida +
      b.guarderiasPrestacionesSociales +
      b.retiro +
      b.cesantiaVejez;

    expect(sumaRamas).toBeCloseTo(b.total, 2);
    // Con INFONAVIT (5 % del SBC) la cuota sería mayor.
    expect(b.total).toBeLessThan(b.monthlySalary * (b.effectivePct + 0.05));
  });

  test('la banda de cesantía y vejez depende del nivel salarial', () => {
    expect(resolveM10CesantiaBand(SMG_2026, UMA_2026, SMG_2026)).toBe(0);
    expect(resolveM10CesantiaBand(MAX_UMAS_2026, UMA_2026, SMG_2026)).toBe(7);
    expect(m10CesantiaPct(0, 2026)).toBe(3.15);
    expect(m10CesantiaPct(7, 2026)).toBe(7.513);
    // El valor de 2025 que publica el Cuadro A.3 del Anexo A.
    expect(m10CesantiaPct(7, 2025)).toBe(6.422);
    expect(m10CesantiaPct(1, 2025)).toBe(3.544);
  });

  test('la cuota es lineal en los días del periodo', () => {
    // Todos los componentes son proporcionales al número de días cotizados, así
    // que la cuota de un periodo de 30 días es la de 30.4 por 30/30.4.
    const base: M10MonthlyCostParams = {
      dailySalary: MAX_UMAS_2026,
      riskClass: 3,
      dailyUMA: UMA_2026,
      minimumDailySalary: SMG_2026,
      year: 2026,
    };

    const con30dias = calculateM10MonthlyCost(base) * (30 / 30.4);

    // Reproduce el costo real observado en la línea de captura de octubre de
    // 2026: $18,584 al mes con el SBC tope de 25 UMA y clase III.
    expect(con30dias).toBeCloseTo(18584.02, 1);
  });

  test('una clase de riesgo mayor cuesta más', () => {
    const base: Omit<M10MonthlyCostParams, 'riskClass'> = {
      dailySalary: MAX_UMAS_2026,
      dailyUMA: UMA_2026,
      minimumDailySalary: SMG_2026,
      year: 2026,
    };

    expect(
      calculateM10MonthlyCost({ ...base, riskClass: 5 }),
    ).toBeGreaterThan(calculateM10MonthlyCost({ ...base, riskClass: 1 }));
  });

  test('un SBC menor cuesta menos', () => {
    const base: Omit<M10MonthlyCostParams, 'riskClass' | 'dailySalary'> = {
      dailyUMA: UMA_2026,
      minimumDailySalary: SMG_2026,
      year: 2026,
    };

    expect(
      calculateM10MonthlyCost({ ...base, riskClass: 3, dailySalary: 586.55 }),
    ).toBeLessThan(
      calculateM10MonthlyCost({ ...base, riskClass: 3, dailySalary: MAX_UMAS_2026 }),
    );
  });
});
