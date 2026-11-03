/**
 * Paso 5: Factor de edad para Cesantía en Edad Avanzada.
 * Si el retiro es antes de los 65 años (edad LEGAL), se aplica un factor de
 * reducción.
 *
 * Fuentes: Art. 171 LSS 1973 (cuantía de la cesantía y regla de los seis
 * meses) y Art. 138 LSS 1973 (pensión de vejez a los 65 años).
 */
import type { CalculationContext, CalculationStep } from '../types';
import {
  CESANTIA_AGE_FACTORS,
  VEJEZ_AGE,
  MINIMUM_CESANTIA_AGE,
} from '../../../constants/ley73';
import { calculateLegalAge } from '../../../utils/date';
import { round2 } from '../../../utils/format';

/** Texto legal de la regla del Art. 171 LSS 1973 (párrafo final). */
const REGLA_ART_171 =
  'Art. 171 LSS 1973: se aumentará un año a los cumplidos cuando la edad los exceda en seis meses.';

/** Formatea una edad para narrarla: sin decimales si es entera. */
function formateaEdad(edad: number): string {
  return Number.isInteger(edad) ? String(edad) : String(Number(edad.toFixed(2)));
}

export const AgeFactorStep: CalculationStep = (ctx): CalculationContext => {
  const { input, subtotalBeforeFactor } = ctx;
  const retirementAge = input.personalData.retirementAge;
  const steps = [...ctx.steps];
  const warnings = [...ctx.warnings];

  // EDAD LEGAL (Art. 171 LSS 1973): si la edad cumplida incluye seis meses o
  // más, la edad que manda para la cuantía es un año mayor.
  const legalAge = calculateLegalAge(retirementAge);

  // Determinar tipo de pensión y factor de edad
  const pensionType = legalAge >= VEJEZ_AGE ? 'vejez' : 'cesantia_edad_avanzada';

  // El factor de edad solo aplica para Cesantía (60–64 años)
  // Para Vejez (65+) el factor es 1.0
  let ageFactor = 1.0;
  if (pensionType === 'cesantia_edad_avanzada') {
    // Clamp a los rangos válidos
    const clampedAge = Math.max(MINIMUM_CESANTIA_AGE, Math.min(legalAge, VEJEZ_AGE - 1));
    ageFactor = CESANTIA_AGE_FACTORS[clampedAge] ?? 0.75;
  }

  const quantityWithFactor = round2(subtotalBeforeFactor * ageFactor);

  // La edad declarada puede diferir de la legal (Art. 171): cuando difiere se
  // dice, para que el desglose sea auditable.
  const detalleEdad =
    legalAge === retirementAge
      ? ''
      : ` (edad legal; ${formateaEdad(retirementAge)} años cumplidos — ${REGLA_ART_171})`;

  if (pensionType === 'cesantia_edad_avanzada') {
    warnings.push(
      `Pensión de Cesantía en Edad Avanzada a los ${legalAge} años${detalleEdad}: ` +
        `se aplica factor de ${(ageFactor * 100).toFixed(0)}% sobre la cuantía. ` +
        `(Art. 171 LSS 1973)`,
    );
  }

  steps.push({
    id: 'factor_edad',
    title: `6. Factor por Edad de Retiro (${pensionType === 'vejez' ? 'Vejez' : 'Cesantía en Edad Avanzada'})`,
    description:
      pensionType === 'vejez'
        ? `Pensión de Vejez a los ${legalAge} años${detalleEdad}: factor 100% (sin reducción). ` +
          `Cuantía: $${quantityWithFactor.toFixed(2)}/mes`
        : `Cesantía en Edad Avanzada a los ${legalAge} años${detalleEdad}: factor ${(ageFactor * 100).toFixed(0)}%. ` +
          `$${subtotalBeforeFactor.toFixed(2)} × ${(ageFactor * 100).toFixed(0)}% = $${quantityWithFactor.toFixed(2)}/mes`,
    value: quantityWithFactor,
    formula:
      pensionType === 'vejez'
        ? 'Cuantía × 100% (sin reducción)'
        : `Cuantía × ${(ageFactor * 100).toFixed(0)}%`,
    legalBasis:
      pensionType === 'vejez'
        ? 'Art. 138 LSS 1973 — Pensión de Vejez (65 años)'
        : 'Art. 171 LSS 1973 — Cuantía de la cesantía en edad avanzada',
    isEstimate: false,
  });

  return {
    ...ctx,
    pensionType,
    ageFactor,
    quantityWithFactor,
    steps,
    warnings,
  };
};
