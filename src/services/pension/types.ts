/**
 * Tipos internos del motor de cálculo de pensión.
 * Separados del dominio para mantener el motor desacoplado.
 */

import type {
  PensionInput,
  CalculationStepResult,
  PensionType,
} from '../../models';
import type { WeeksProjection } from '../../utils/weeksProjection';

/** Contexto inmutable que se pasa entre los pasos del pipeline. */
export interface CalculationContext {
  readonly input: PensionInput;
  /** Proyección de semanas hasta la edad de retiro (ya cotizadas + proyectadas) */
  weeksProjection: WeeksProjection;
  /** Semanas M10 planeadas por fechas, solo para los pasos internos del cálculo. */
  m10PlannedWeeks: number;
  /** Salario diario efectivo (ya topado y ajustado por M10) */
  effectiveDailySalary: number;
  /** Salario en veces el SMG (para buscar rango en tabla Art. 167) */
  salaryInTimesMinimumWage: number;
  /** Porcentaje de cuantía básica de la tabla Art. 167 */
  basicQuantityPct: number;
  /** Incremento anual de la tabla Art. 167 */
  annualIncrementPct: number;
  /** Número de años excedentes (semanas_excedentes / 52) */
  excessYears: number;
  /** Cuantía básica en pesos (effectiveDailySalary * basicQuantityPct * 30.4) */
  basicAmount: number;
  /** Total de incrementos anuales en pesos */
  annualIncrements: number;
  /** Subtotal antes de factor de edad */
  subtotalBeforeFactor: number;
  /** Monto del incremento del 11% (Decreto DOF 2001/2004) ya incluido en subtotalBeforeFactor */
  decree11Increment: number;
  /** Factor de edad (0.75 a 1.0) */
  ageFactor: number;
  /** Cuantía después de factor de edad */
  quantityWithFactor: number;
  /** Asignaciones familiares en pesos */
  familyAllowances: number;
  /** Ayuda asistencial en pesos */
  assistanceAid: number;
  /** Tipo de pensión determinado */
  pensionType: PensionType;
  /** Si se aplicó el tope de 25 UMA */
  capApplied: boolean;
  /** Si se aplicó la pensión mínima garantizada */
  pmgApplied: boolean;
  /** Total pensión mensual */
  monthlyPension: number;
  /** Pasos acumulados del pipeline */
  steps: CalculationStepResult[];
  /** Advertencias acumuladas */
  warnings: string[];
}

/** Paso puro del pipeline: recibe contexto y devuelve contexto actualizado. */
export type CalculationStep = (ctx: CalculationContext) => CalculationContext;
