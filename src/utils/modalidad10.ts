/**
 * Utilidades de Modalidad 10 compartidas por el motor de cálculo, el
 * formulario y la validación.
 *
 * La Modalidad 10 es la incorporación voluntaria al régimen obligatorio
 * (capítulo IX de la LSS vigente, Arts. 222 a 233): la base de cotización son
 * los ingresos declarados por la persona asegurada, acotados por los límites
 * del Art. 28 —el salario mínimo del área geográfica como piso y 25 UMA como
 * techo— y la cuota se calcula con la estructura de financiamiento oficial
 * del IMSS y sin la aportación a INFONAVIT.
 *
 * Todo es función pura: aquí no hay UI ni estado.
 */
import {
  AVERAGE_DAYS_PER_MONTH,
  MODALIDAD_10_CAP_TIMES_UMA,
  MODALIDAD_10_RT_PRIMA,
} from '../constants/ley73';
import {
  M10_CESANTIA_BANDS,
  M10_CESANTIA_BAND_THRESHOLDS_UMAS,
  M10_CESANTIA_FIRST_YEAR,
  M10_CUOTA_RATES,
  M10_SEM_EXCEDENTE_UMAS,
} from '../constants/modalidad10Cuota';
import { getMinimumDailySalary } from '../constants/uma';
import type { RiskClass, SalaryZone } from '../models';
import { round2, round4 } from './format';
import { countCotizedWeeksInDateRange } from './weeksProjection';

/**
 * Máximo de meses contractuales que admite el esquema de validación.
 * Es el horizonte máximo que el IMSS admite para la continuación voluntaria.
 */
export const M10_MAX_MONTHS = 600;

/**
 * Meses contractuales de Modalidad 10 desde el mes siguiente a la fecha de
 * referencia hasta el mes de retiro inclusive.
 */
export function estimateM10Months(referenceDate: Date, retirementDate: Date): number {
  const firstM10Month = referenceDate.getFullYear() * 12 + referenceDate.getMonth() + 1;
  const retirementMonth = retirementDate.getFullYear() * 12 + retirementDate.getMonth();
  return Math.min(M10_MAX_MONTHS, Math.max(0, retirementMonth - firstM10Month + 1));
}

/**
 * Semanas estimadas del periodo contractual de Modalidad 10 (por días
 * calendario, del primer día cotizable al último día del mes de retiro).
 */
export function calculateM10PlannedWeeks(
  referenceDate: Date,
  retirementDate: Date,
): number {
  if (estimateM10Months(referenceDate, retirementDate) === 0) return 0;

  const startDate = getM10StartDate(referenceDate);
  const months = estimateM10Months(referenceDate, retirementDate);
  const endDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + months + 1,
    0,
  );
  return countCotizedWeeksInDateRange(startDate, endDate);
}

/**
 * Primer día cotizable de la Modalidad 10: el 1º del mes calendario
 * siguiente a la fecha de referencia. No hay meses retroactivos (Art. 224 de
 * la LSS vigente).
 */
export function getM10StartDate(referenceDate: Date): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
}

/** Equivalente en UMAs de un SBC diario. */
export function m10SalaryInUMAs(dailySalary: number, dailyUMA: number): number {
  if (!dailyUMA || dailyUMA <= 0) return 0;
  return round2(dailySalary / dailyUMA);
}

/** SBC diario que corresponde a un número de UMAs. */
export function m10SalaryFromUMAs(umas: number, dailyUMA: number): number {
  return round2(umas * dailyUMA);
}

/** Rango legal del SBC que se puede declarar en la Modalidad 10. */
export interface M10SalaryRange {
  /** Piso: salario mínimo general del área geográfica. */
  minimumDailySalary: number;
  /** Piso expresado en UMAs (puede ser fraccionario). */
  minimumUMAs: number;
  /** Techo: 25 UMA. */
  maximumUMAs: number;
  /** Techo expresado en pesos diarios. */
  maximumDailySalary: number;
}

/**
 * Rango legal del SBC declarado (Art. 28 LSS vigente): el piso es el salario
 * mínimo del área geográfica y el techo son 25 UMA.
 *
 * @param dailyUMA UMA diaria vigente.
 * @param minimumDailySalary Salario mínimo de referencia (Zona A / CDMX).
 */
export function m10SalaryRange(
  dailyUMA: number,
  minimumDailySalary: number,
): M10SalaryRange {
  return {
    minimumDailySalary: round2(minimumDailySalary),
    minimumUMAs: m10SalaryInUMAs(minimumDailySalary, dailyUMA),
    maximumUMAs: MODALIDAD_10_CAP_TIMES_UMA,
    maximumDailySalary: round2(MODALIDAD_10_CAP_TIMES_UMA * dailyUMA),
  };
}

/** Acota un SBC al rango legal de la Modalidad 10. */
export function clampM10Salary(
  dailySalary: number,
  dailyUMA: number,
  minimumDailySalary: number,
): number {
  const range = m10SalaryRange(dailyUMA, minimumDailySalary);
  return round2(
    Math.min(Math.max(dailySalary, range.minimumDailySalary), range.maximumDailySalary),
  );
}

/**
 * Periodo de cotización de la Modalidad 10 dentro de la línea temporal del
 * SBC promedio (Art. 167 LSS 1973).
 */
export interface M10ContributionPeriod {
  /** Primer día cotizable (1º del mes siguiente a la fecha de referencia). */
  startDate: Date;
  /** Último día cotizable (fecha de retiro). */
  endDate: Date;
  /** SBC diario efectivo del periodo (la suma de las cotizaciones que conviven). */
  dailySalary: number;
  /** SBC diario declarado en la Modalidad 10, sin combinar. */
  declaredDailySalary: number;
  /** SBC ordinario que se suma cuando la persona sigue trabajando. */
  ordinaryDailySalary: number;
  /** Si la persona sigue trabajando mientras cotiza en la Modalidad 10. */
  continuesWorking: boolean;
  /** Meses contractuales del periodo. */
  months: number;
}

/**
 * Construye el periodo de cotización de la Modalidad 10.
 *
 * El SBC efectivo del periodo es:
 * - `último salario registrado + salario de M10` si la persona sigue
 *   trabajando (las dos cotizaciones conviven en el mismo mes, como dos
 *   patrones simultáneos); o
 * - `salario de M10` solamente si ya no trabaja.
 *
 * **La suma NO se topa aquí.** El Art. 39 de la Ley 73 dice que para el goce
 * de las prestaciones en dinero el asegurado se clasifica "en el grupo
 * correspondiente a la suma de los salarios percibidos en los distintos
 * empleos" y que, cuando la suma alcanza el límite superior, los aportes se
 * cubren sobre el salario máximo de cotización (el Art. 33 de la LSS vigente
 * lo dice igual, con la salvedad de que la suma se toma "cuando ésta sea
 * menor al límite superior"). El tope de 25 UMA se aplica, por tanto, a los
 * aportes y al promedio del SBC, no a la suma que entra al promedio: ese
 * último lo aplica el motor (paso 1) y lo avisa cuando lo rebasa.
 *
 * Si se declara un incremento salarial anual esperado, se aplica como factor
 * de punto medio sobre el horizonte completo (aproximación declarada como
 * estimación).
 *
 * Devuelve `null` cuando no hay un mes contractual completo por delante.
 */
export function buildM10ContributionPeriod(params: {
  referenceDate: Date;
  retirementDate: Date;
  /** SBC diario declarado en la Modalidad 10. */
  m10DailySalary: number;
  /** SBC ordinario vigente (último registrado o el capturado). */
  ordinaryDailySalary: number;
  /** Si la persona sigue trabajando mientras cotiza en la Modalidad 10. */
  continuesWorking: boolean;
  /** Incremento salarial anual esperado (%). */
  annualSalaryIncreasePct?: number;
}): M10ContributionPeriod | null {
  const months = estimateM10Months(params.referenceDate, params.retirementDate);
  if (months === 0) return null;

  const startDate = getM10StartDate(params.referenceDate);
  const endDate = params.retirementDate;

  const combined =
    params.continuesWorking
      ? params.ordinaryDailySalary + params.m10DailySalary
      : params.m10DailySalary;

  let dailySalary = combined;
  const increasePct = params.annualSalaryIncreasePct ?? 0;
  if (increasePct > 0) {
    // El incremento se aplica en el punto medio del horizonte (aproximación).
    const years = months / 12;
    dailySalary = combined * (1 + (increasePct / 100) * (years / 2));
  }

  return {
    startDate,
    endDate,
    dailySalary: round2(dailySalary),
    declaredDailySalary: round2(params.m10DailySalary),
    ordinaryDailySalary: round2(params.ordinaryDailySalary),
    continuesWorking: params.continuesWorking,
    months,
  };
}

/**
 * Banda de la tasa de cesantía y vejez que corresponde a un SBC dado.
 *
 * Reproduce la selección de banda de la calculadora oficial del IMSS: la
 * banda 0 es el salario mínimo exacto de la zona y las siguientes se abren
 * por tramos de UMA (1.51, 2.01, 2.51, 3.01, 3.51 y 4.01 UMA).
 */
export function resolveM10CesantiaBand(
  dailySalary: number,
  dailyUMA: number,
  minimumDailySalary: number,
): number {
  if (round2(dailySalary) === round2(minimumDailySalary)) return 0;

  const thresholds = M10_CESANTIA_BAND_THRESHOLDS_UMAS.map((t) => round2(t * dailyUMA));

  if (dailySalary > minimumDailySalary && dailySalary < thresholds[0]!) return 1;

  for (let i = 0; i < thresholds.length; i += 1) {
    const lower = thresholds[i]!;
    const upper = thresholds[i + 1];
    if (upper === undefined) {
      if (dailySalary >= lower) return 7;
      continue;
    }
    if (dailySalary >= lower && dailySalary < upper) return i + 2;
  }

  return 7;
}

/**
 * Tasa de cesantía y vejez (%) de la banda y el año indicados.
 * Para los años anteriores a 2022 se usa la columna de 2022, la más antigua
 * publicada en la tabla.
 */
export function m10CesantiaPct(bandIndex: number, year: number): number {
  const band = M10_CESANTIA_BANDS[Math.min(Math.max(bandIndex, 0), M10_CESANTIA_BANDS.length - 1)]!;
  const column = Math.min(
    Math.max(year - M10_CESANTIA_FIRST_YEAR, 0),
    band.rates.length - 1,
  );
  return band.rates[column]!;
}

/** Datos de entrada para el cálculo de la cuota mensual de la Modalidad 10. */
export interface M10MonthlyCostParams {
  /** SBC diario declarado en la Modalidad 10. */
  dailySalary: number;
  /** Clase de riesgo laboral: fija la prima de Riesgos de Trabajo. */
  riskClass: RiskClass;
  /** UMA diaria vigente. */
  dailyUMA: number;
  /** Salario mínimo de la zona: piso del SBC y base de la banda 0. */
  minimumDailySalary: number;
  /** Año de la UMA vigente: fija la columna de la tabla de cesantía y vejez. */
  year: number;
}

/** Desglose del costo mensual de la Modalidad 10 para auditar el cálculo. */
export interface M10MonthlyCostBreakdown {
  /** SBC diario usado en el cálculo. */
  dailySalary: number;
  /** SBC mensual equivalente (diario × 30.4). */
  monthlySalary: number;
  /** Clase de riesgo laboral. */
  riskClass: RiskClass;
  /** Prima de Riesgos de Trabajo de la clase (fracción). */
  riskPrimaPct: number;
  /** Banda de cesantía y vejez aplicada. */
  cesantiaBandLabel: string;
  /** Tasa de cesantía y vejez aplicada (%). */
  cesantiaPct: number;
  /** SEM — cuota fija (20.40 % de la UMA). */
  semCuotaFija: number;
  /** SEM — cuota excedente (sobre el excedente de 3 UMA). */
  semCuotaExcedente: number;
  /** SEM — prestaciones en dinero. */
  semPrestacionesDinero: number;
  /** SEM — gastos médicos para pensionados. */
  semGastosMedicosPensionados: number;
  /** Prima de Riesgos de Trabajo. */
  riesgosTrabajo: number;
  /** Seguro de Invalidez y Vida. */
  invalidezVida: number;
  /** Seguro de Guarderías y Prestaciones Sociales. */
  guarderiasPrestacionesSociales: number;
  /** Seguro de Retiro. */
  retiro: number;
  /** Seguro de Cesantía y Vejez. */
  cesantiaVejez: number;
  /** Total de la cuota mensual, sin INFONAVIT. */
  total: number;
  /** Tasa efectiva total sobre el SBC mensual (fracción). */
  effectivePct: number;
}

/**
 * Desglose de la cuota mensual de la Modalidad 10, rama por rama.
 *
 * Reproduce la fórmula de la calculadora oficial del IMSS para Personas
 * Trabajadoras Independientes: la persona asegurada cotiza por sí misma y
 * paga las dos partes de cada ramo (patronal y obrera). **No** incluye el
 * 5 % de INFONAVIT, que es ahorro para vivienda y se paga aparte.
 */
export function calculateM10MonthlyBreakdown(
  params: M10MonthlyCostParams,
): M10MonthlyCostBreakdown {
  const rates = M10_CUOTA_RATES;
  const monthlySalary = round2(params.dailySalary * AVERAGE_DAYS_PER_MONTH);
  const riskPrimaPct = MODALIDAD_10_RT_PRIMA[params.riskClass];

  const bandIndex = resolveM10CesantiaBand(
    params.dailySalary,
    params.dailyUMA,
    params.minimumDailySalary,
  );
  const cesantiaPct = m10CesantiaPct(bandIndex, params.year);

  // Excedente sobre 3 UMA: base de la cuota excedente del SEM.
  const excedenteBase = Math.max(
    0,
    params.dailySalary - M10_SEM_EXCEDENTE_UMAS * params.dailyUMA,
  ) * AVERAGE_DAYS_PER_MONTH;

  const semCuotaFija = round2(params.dailyUMA * AVERAGE_DAYS_PER_MONTH * rates.semCuotaFijaUmaPct);
  const semCuotaExcedente = round2(
    excedenteBase * (rates.semCuotaExcedentePatronalPct + rates.semCuotaExcedenteObreraPct),
  );
  const semPrestacionesDinero = round2(
    monthlySalary * (rates.semPrestacionesDineroPatronalPct + rates.semPrestacionesDineroObreraPct),
  );
  const semGastosMedicosPensionados = round2(
    monthlySalary *
      (rates.semGastosMedicosPensionadosPatronalPct + rates.semGastosMedicosPensionadosObreraPct),
  );
  const riesgosTrabajo = round2(monthlySalary * riskPrimaPct);
  const invalidezVida = round2(
    monthlySalary * (rates.invalidezVidaPatronalPct + rates.invalidezVidaObreraPct),
  );
  const guarderiasPrestacionesSociales = round2(
    monthlySalary * rates.guarderiasPrestacionesSocialesPct,
  );
  const retiro = round2(monthlySalary * rates.retiroPct);
  const cesantiaVejez = round2(
    monthlySalary * (cesantiaPct / 100 + rates.cesantiaVejezObreraPct),
  );

  const total = round2(
    semCuotaFija +
      semCuotaExcedente +
      semPrestacionesDinero +
      semGastosMedicosPensionados +
      riesgosTrabajo +
      invalidezVida +
      guarderiasPrestacionesSociales +
      retiro +
      cesantiaVejez,
  );

  return {
    dailySalary: params.dailySalary,
    monthlySalary,
    riskClass: params.riskClass,
    riskPrimaPct,
    cesantiaBandLabel: M10_CESANTIA_BANDS[bandIndex]!.label,
    cesantiaPct,
    semCuotaFija,
    semCuotaExcedente,
    semPrestacionesDinero,
    semGastosMedicosPensionados,
    riesgosTrabajo,
    invalidezVida,
    guarderiasPrestacionesSociales,
    retiro,
    cesantiaVejez,
    total,
    effectivePct: monthlySalary > 0 ? round4(total / monthlySalary) : 0,
  };
}

/**
 * Cuota mensual de la Modalidad 10, SIN la aportación a INFONAVIT (que es un
 * ahorro para vivienda y no una prima de financiamiento; Art. 228 de la LSS
 * vigente).
 */
export function calculateM10MonthlyCost(params: M10MonthlyCostParams): number {
  return calculateM10MonthlyBreakdown(params).total;
}

/** Campos de la Modalidad 10 de una simulación que determinan su costo. */
export interface M10CostSource {
  /** SBC diario declarado en la Modalidad 10. */
  contributionSalary?: number;
  /** Clase de riesgo laboral de la ocupación (fija la prima de RT). */
  riskClass?: RiskClass;
  /** Zona de salario mínimo usada como piso del SBC declarado. */
  salaryZone?: SalaryZone;
}

/** Configuración de UMA de la simulación: valor diario, año y salarios mínimos. */
export interface M10CostUMAContext {
  dailyUMA: number;
  year: number;
  smgCdmx?: number;
  smgFronteraNorte?: number;
}

/**
 * Desglose del costo mensual de la Modalidad 10 de una simulación, con los
 * mismos parámetros con los que se capturó: SBC declarado, clase de riesgo,
 * UMA vigente y salario mínimo de la zona elegida.
 *
 * Es el punto único de verdad de la cifra: ResultScreen y el historial muestran
 * el mismo costo sin decidir los parámetros cada uno por su lado.
 */
export function m10MonthlyCostFromInput(
  modalidad10: M10CostSource,
  uma: M10CostUMAContext,
): M10MonthlyCostBreakdown {
  return calculateM10MonthlyBreakdown({
    dailySalary: modalidad10.contributionSalary ?? 0,
    riskClass: modalidad10.riskClass ?? 1,
    dailyUMA: uma.dailyUMA,
    minimumDailySalary: getMinimumDailySalary(uma, modalidad10.salaryZone),
    year: uma.year,
  });
}
