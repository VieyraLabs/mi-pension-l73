/**
 * Paso 3: Cálculo de incrementos anuales por semanas excedentes.
 * Por cada 52 semanas cotizadas adicionales a las 500 mínimas,
 * se aplica un porcentaje de incremento según la tabla Art. 167.
 *
 * Fuente: Art. 167 LSS 1973 — párrafo de incrementos anuales.
 */
import type { CalculationContext, CalculationStep } from '../types';
import { DAYS_PER_YEAR_UMA, MINIMUM_WEEKS_VEJEZ, WEEKS_PER_YEAR } from '../../../constants/ley73';
import { round2 } from '../../../utils/format';
import { describeWeeksProjection } from '../../../utils/weeksProjection';

export const AnnualIncrementsStep: CalculationStep = (ctx): CalculationContext => {
  const { basicAmount, annualIncrementPct, effectiveDailySalary, weeksProjection } = ctx;
  const { projectedWeeks, targetWeeks } = weeksProjection;
  const steps = [...ctx.steps];

  // Semanas excedentes sobre el mínimo (con las semanas proyectadas hasta la
  // edad de retiro ya incluidas en el total).
  const excessWeeks = Math.max(0, targetWeeks - MINIMUM_WEEKS_VEJEZ);
  // Años completos excedentes (cada 52 semanas = 1 año de incremento)
  const excessYears = Math.floor(excessWeeks / WEEKS_PER_YEAR);

  // Desglose del horizonte: la proyección hasta la edad de retiro y, si las
  // semanas de Modalidad 10 la exceden, el sobrante de M10. El mismo texto
  // lo usa el esquema de validación del mínimo de 500 semanas.
  const { breakdown, m10ExtraWeeks } = describeWeeksProjection(weeksProjection);

  // El incremento se calcula sobre el SBC anual y luego se divide entre 12 para obtener el mensual
  // Fuente: Art. 167 LSS 1973 — cada año adicional incrementa en annualIncrementPct% del SBC
  // Fórmula: Incremento Anual = Salario Diario × 365 × Porcentaje
  // Incremento Mensual = Incremento Anual / 12
  const annualIncrement = round2(effectiveDailySalary * DAYS_PER_YEAR_UMA * (annualIncrementPct / 100));
  const annualIncrements = round2(annualIncrement / 12 * excessYears);
  const subtotalBeforeFactor = round2(basicAmount + annualIncrements);

  steps.push({
    id: 'incrementos_anuales',
    title: '3. Incrementos Anuales por Semanas Excedentes',
    description:
      `Semanas totales: ${breakdown} ` +
      `− 500 mínimas = ${excessWeeks} excedentes → ` +
      `${excessYears} años completos × ${annualIncrementPct}% × ${effectiveDailySalary.toFixed(2)}/día × 365 días = ` +
      `${annualIncrement.toFixed(2)}/año → ${annualIncrements.toFixed(2)}/mes adicionales`,
    value: annualIncrements,
    formula: `floor((semanas − 500) / 52) × ${annualIncrementPct}% × SBC_diario × 365 ÷ 12`,
    legalBasis: 'Art. 167 LSS 1973 — incrementos anuales por semanas adicionales',
    isEstimate: projectedWeeks > 0 || m10ExtraWeeks > 0,
    assumption:
      m10ExtraWeeks > 0
        ? `Incluye las semanas planeadas por los meses de Modalidad 10 que planeas contratar (${breakdown}).`
        : projectedWeeks > 0
          ? `Incluye las semanas proyectadas hasta la edad de retiro (${breakdown}): se supone que sigues cotizando hasta jubilarte.`
          : undefined,
  });

  steps.push({
    id: 'subtotal_cuantia',
    title: '4. Cuantía Total (Básica + Incrementos)',
    description:
      `Cuantía básica $${basicAmount.toFixed(2)} + Incrementos $${annualIncrements.toFixed(2)} = $${subtotalBeforeFactor.toFixed(2)}/mes`,
    value: subtotalBeforeFactor,
    formula: 'Cuantía_básica + Incrementos_anuales',
    legalBasis: 'Art. 167 LSS 1973',
    isEstimate: true,
  });

  return {
    ...ctx,
    excessYears,
    annualIncrements,
    subtotalBeforeFactor,
    steps,
  };
};
