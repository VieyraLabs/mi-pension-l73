/**
 * PensionCalculator — Orquestador del pipeline de cálculo de pensión Ley 73.
 *
 * Implementa el patrón Pipeline: cada paso recibe un contexto inmutable
 * y devuelve el contexto actualizado. El resultado final se construye
 * a partir del contexto final del pipeline.
 *
 * NOTA LEGAL: Los resultados son ESTIMACIONES con fines informativos.
 * La resolución oficial corresponde al IMSS.
 */
import type { PensionInput, PensionResult } from '../../models';
import type { CalculationContext } from './types';
import { AverageSalaryStep } from './steps/AverageSalaryStep';
import { BasicQuantityStep } from './steps/BasicQuantityStep';
import { AnnualIncrementsStep } from './steps/AnnualIncrementsStep';
import { DecreeIncrementStep } from './steps/DecreeIncrementStep';
import { AgeFactorStep } from './steps/AgeFactorStep';
import { FamilyAssignmentsStep } from './steps/FamilyAssignmentsStep';
import { AssistanceAidStep } from './steps/AssistanceAidStep';
import { LimitsStep } from './steps/LimitsStep';
import { AVERAGE_DAYS_PER_MONTH, MONTHS_PER_YEAR, MINIMUM_WEEKS_VEJEZ } from '../../constants/ley73';
import { round2 } from '../../utils/format';
import { calculateM10PlannedWeeks } from '../../utils/modalidad10';
import {
  calculateWeeksProjection,
  getLocalReferenceDate,
  normalizeLocalCalendarDate,
} from '../../utils/weeksProjection';
import { safeParsePensionInputAtReferenceDate } from '../../validation/pensionSchema';

/** Resultado de validación previa al cálculo. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida los datos de entrada antes del cálculo.
 * Las reglas de validación viven en el schema Zod (`pensionSchema.ts`), única
 * fuente de verdad — aquí solo se traducen sus resultados y se agregan
 * advertencias informativas (no bloqueantes) sobre el input.
 */
export function validateInput(input: PensionInput): ValidationResult {
  const warnings: string[] = [];
  const referenceDate = getLocalReferenceDate();
  const parseResult = safeParsePensionInputAtReferenceDate(input, referenceDate);
  const errors = parseResult.success ? [] : parseResult.error.issues.map((issue) => issue.message);

  // La proyección de semanas comparte la fecha de referencia con la validación.
  const { targetWeeks } = calculateWeeksProjection({
    currentWeeks: input.workHistory.totalWeeks,
    age: input.personalData.age,
    retirementAge: input.personalData.retirementAge,
    referenceDate,
    retirementDate: input.personalData.estimatedRetirementDate,
    m10PlannedWeeks: input.modalidad10.active
      ? calculateM10PlannedWeeks(referenceDate, input.personalData.estimatedRetirementDate)
      : 0,
  });
  if (targetWeeks >= MINIMUM_WEEKS_VEJEZ && targetWeeks < 520) {
    warnings.push(
      'Tienes justo el mínimo de semanas. Considera cotizar más para incrementar tu pensión.',
    );
  }

  if (input.uma.isCustom) {
    warnings.push('Se está utilizando un valor de UMA personalizado ingresado manualmente.');
  }

  return {
    valid: parseResult.success,
    errors,
    warnings,
  };
}

/**
 * Crea el contexto inicial del pipeline con valores por defecto.
 */
function createInitialContext(
  input: PensionInput,
  referenceDate: Date,
  m10PlannedWeeks: number,
): CalculationContext {
  return {
    input,
    weeksProjection: calculateWeeksProjection({
      currentWeeks: input.workHistory.totalWeeks,
      age: input.personalData.age,
      retirementAge: input.personalData.retirementAge,
      referenceDate,
      retirementDate: input.personalData.estimatedRetirementDate,
      m10PlannedWeeks,
    }),
    m10PlannedWeeks,
    effectiveDailySalary: input.projectedAverageDailySalary ?? input.averageSalary.dailySalary,
    salaryInTimesMinimumWage: 0,
    basicQuantityPct: 0,
    annualIncrementPct: 0,
    excessYears: 0,
    basicAmount: 0,
    annualIncrements: 0,
    subtotalBeforeFactor: 0,
    decree11Increment: 0,
    ageFactor: 1.0,
    quantityWithFactor: 0,
    familyAllowances: 0,
    assistanceAid: 0,
    pensionType: 'vejez',
    capApplied: false,
    pmgApplied: false,
    monthlyPension: 0,
    steps: [],
    warnings: [],
  };
}

/** Pipeline de pasos en orden de ejecución. */
const PIPELINE = [
  AverageSalaryStep,
  BasicQuantityStep,
  AnnualIncrementsStep,
  DecreeIncrementStep,
  AgeFactorStep,
  FamilyAssignmentsStep,
  AssistanceAidStep,
  LimitsStep,
] as const;

/**
 * Ejecuta el cálculo completo de la pensión Ley 73.
 *
 * @param input Datos de entrada del asegurado
 * @returns PensionResult con el resultado y desglose completo
 */
export function calculatePension(input: PensionInput): PensionResult {
  const calculationDate = new Date();
  const referenceDate = normalizeLocalCalendarDate(calculationDate);
  const m10PlannedWeeks = input.modalidad10.active
    ? calculateM10PlannedWeeks(referenceDate, input.personalData.estimatedRetirementDate)
    : 0;
  // Ejecutar pipeline: cada paso recibe y devuelve un contexto
  const finalContext = PIPELINE.reduce<CalculationContext>(
    (ctx, step) => step(ctx),
    createInitialContext(input, referenceDate, m10PlannedWeeks),
  );

  const monthlyPension = round2(finalContext.monthlyPension);
  const annualPension = round2(monthlyPension * MONTHS_PER_YEAR);
  const dailyAmount = round2(monthlyPension / AVERAGE_DAYS_PER_MONTH);

  // Agregar paso final de resumen
  const stepsWithSummary = [
    ...finalContext.steps,
    {
      id: 'resultado_final',
      title: '✅ Resultado Final',
      description: `Pensión mensual estimada: $${monthlyPension.toFixed(2)} MXN`,
      value: monthlyPension,
      formula: 'Pipeline completo Ley 73',
      legalBasis: 'Ley del Seguro Social 1973',
      isEstimate: true,
      assumption:
        'Este resultado es una ESTIMACIÓN. La resolución oficial corresponde al IMSS. ' +
        'Los porcentajes de la tabla Art. 167 son de referencia bibliográfica.',
    },
  ];

  return {
    pensionType: finalContext.pensionType,
    monthlyPension,
    annualPension,
    dailyAmount,
    basicAmount: finalContext.basicAmount,
    annualIncrements: finalContext.annualIncrements,
    decree11Increment: finalContext.decree11Increment,
    ageFactor: finalContext.ageFactor,
    familyAllowances: finalContext.familyAllowances,
    assistanceAid: finalContext.assistanceAid,
    capApplied: finalContext.capApplied,
    pmgApplied: finalContext.pmgApplied,
    steps: stepsWithSummary,
    weeksProjection: finalContext.weeksProjection,
    warnings: [
      ...finalContext.warnings,
      '⚠️ AVISO LEGAL: Este resultado es una estimación con fines informativos únicamente. ' +
        'La resolución oficial de su pensión corresponde al IMSS conforme a sus procedimientos institucionales.',
    ],
    isEstimate: true,
    input,
    calculationDate: calculationDate.toISOString(),
  };
}
