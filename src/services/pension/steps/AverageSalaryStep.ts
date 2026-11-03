/**
 * Paso 1: Cálculo del salario promedio efectivo.
 * Incluye los meses de Modalidad 10 si están activos.
 *
 * Fuente: Art. 167 LSS 1973 — promedio de las últimas 250 semanas cotizadas.
 */
import type { CalculationContext, CalculationStep } from '../types';
import { AVERAGE_DAYS_PER_MONTH, SBC_CAP_TIMES_UMA } from '../../../constants/ley73';
import { round2 } from '../../../utils/format';

/**
 * Calcula el salario promedio ajustado de las últimas 250 semanas cotizadas.
 *
 * Los meses de Modalidad 10 NO se ponderan aquí: ya entran al promedio como
 * un tramo más de la línea temporal del SBC proyectado (Art. 167 LSS 1973).
 * Este paso solo consume ese resultado y lo narra con las mismas cifras.
 */
export const AverageSalaryStep: CalculationStep = (ctx): CalculationContext => {
  const { input } = ctx;
  const { averageSalary, uma, modalidad10 } = input;
  const salaryForCalculation = input.projectedAverageDailySalary ?? averageSalary.dailySalary;
  const warnings = [...ctx.warnings];
  const steps = [...ctx.steps];

  const dailyUMACap = SBC_CAP_TIMES_UMA * uma.dailyUMA;
  let baseDailySalary = salaryForCalculation;
  let isSalaryEstimate = input.projectedAverageDailySalary != null;
  let salaryDescription = input.projectedAverageDailySalary == null
    ? `Salario diario promedio ingresado: $${baseDailySalary.toFixed(2)}`
    : `SBC promedio proyectado al retiro: $${baseDailySalary.toFixed(2)}/día`;
  let salaryFormula = input.projectedAverageDailySalary == null
    ? 'SBC promedio (250 semanas) — ingresado por el usuario'
    : 'SBC promedio proyectado al retiro — historial + proyección';

  const breakdown = input.projectedAverageBreakdown;
  const m10Weeks = breakdown?.m10Weeks ?? 0;

  if (breakdown && m10Weeks > 0) {
    baseDailySalary = round2(salaryForCalculation);
    salaryDescription =
      `Promedio ponderado: ${breakdown.ordinaryWeeks} sem. ordinarias ` +
      `($${breakdown.ordinaryDailySalary.toFixed(2)}/día) + ${m10Weeks} sem. M10 ` +
      `($${breakdown.m10DailySalary.toFixed(2)}/día) = $${baseDailySalary.toFixed(2)}/día`;
    salaryFormula =
      `(SBC_ord × sem_ord + SBC_M10 × sem_M10) ÷ ${breakdown.totalWeeks}`;
    isSalaryEstimate = true;
    warnings.push(
      'El promedio salarial incluye los meses de Modalidad 10 cotizados al SBC declarado. ' +
        'El IMSS calculará el promedio exacto con tu historial completo.',
    );
  } else if (modalidad10.active) {
    warnings.push(
      'La Modalidad 10 está activa pero el SBC promedio proyectado no incluye sus meses. ' +
        'Verifica los datos capturados en el paso 4.',
    );
  }

  // Aplicar tope de 25 UMA
  const capApplied = baseDailySalary > dailyUMACap;
  const effectiveDailySalary = capApplied ? dailyUMACap : baseDailySalary;

  if (capApplied) {
    warnings.push(
      `El SBC ($${baseDailySalary.toFixed(2)}/día) excede el tope de 25 UMA ` +
        `($${dailyUMACap.toFixed(2)}/día). Se utiliza el tope máximo. ` +
        `(Art. 28 LSS vigente; ref. DOF 27-ene-2016)`,
    );
  }

  steps.push({
    id: 'salario_promedio',
    title: '1. Salario Base de Cotización Promedio',
    description: capApplied
      ? `${salaryDescription} → topado a 25 UMA = $${effectiveDailySalary.toFixed(2)}/día`
      : salaryDescription,
    value: effectiveDailySalary * AVERAGE_DAYS_PER_MONTH,
    formula: capApplied ? `min(${salaryFormula}, 25 × UMA_diaria)` : salaryFormula,
    legalBasis: 'Art. 167 LSS 1973 (promedio 250 semanas); Art. 28 LSS vigente (tope 25 UMA)',
    isEstimate: isSalaryEstimate,
    assumption:
      m10Weeks > 0
        ? 'El promedio incorpora los meses de Modalidad 10 al SBC declarado (Art. 227 LSS vigente) ' +
          'y supone cotización continua hasta el retiro. El IMSS usará el historial exacto.'
        : input.projectedAverageDailySalary != null
          ? 'Se asume cotización continua hasta el retiro con el último SBC agregado del historial disponible.'
          : undefined,
  });

  return {
    ...ctx,
    effectiveDailySalary,
    capApplied,
    steps,
    warnings,
  };
};
