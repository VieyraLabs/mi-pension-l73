/**
 * Modelos de dominio para la Calculadora de Pensión IMSS Ley 73.
 * Todos los tipos están estrictamente tipados con TypeScript.
 */

import type {
  ContributionSummary,
  ProjectedAverageBreakdown,
  SBCPeriodSegment,
} from '../services/pension/history/types';
import type { WeeksProjection } from '../utils/weeksProjection';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export type RetirementType = 'vejez' | 'cesantia';

export type PensionType = 'vejez' | 'cesantia_edad_avanzada';

/**
 * Clase de riesgo laboral (I–V) del catálogo de ocupaciones de la Modalidad 10
 * del IMSS. Determina la prima de Riesgos de Trabajo.
 */
export type RiskClass = 1 | 2 | 3 | 4 | 5;

/**
 * Zona geográfica de salario mínimo usada como piso del SBC declarado en la
 * Modalidad 10 (Art. 28 LSS vigente).
 */
export type SalaryZone = 'general' | 'frontera_norte';

export type DocumentType =
  | 'constancia_semanas_imss'
  | 'estado_cuenta_afore'
  | 'resolucion_pension'
  | 'constancia_semanas_issste'
  | 'recibo_nomina'
  | 'historial_modalidad10';

// ─────────────────────────────────────────────
// Datos personales
// ─────────────────────────────────────────────

export interface PersonalData {
  /**
   * Nombre de la persona. El formulario lo exige, pero se mantiene opcional
   * en el modelo porque las simulaciones ya guardadas en el dispositivo
   * pueden no traerlo.
   */
  name?: string;
  birthDate: Date;
  age: number;
  estimatedRetirementDate: Date;
  /**
   * Edad de retiro declarada. Admite fracciones de medio año (60.5, 64.5, ...).
   * La EDAD LEGAL que manda para el cálculo de la cuantía la determina el motor
   * (Art. 171 LSS 1973): seis meses o más cumplidos se computan como el año
   * siguiente.
   */
  retirementAge: number;
}

// ─────────────────────────────────────────────
// Historial laboral
// ─────────────────────────────────────────────

export interface EmploymentRelation {
  employerName: string;
  employerRegistrationNumber: string;
  startDate: Date;
  endDate?: Date;
  contributionBaseSalary: number;
  movementType: string;
  contributedDays: number;
}

export interface WorkHistory {
  totalWeeks: number;
  recognizedWeeks?: number;
  deductedWeeks?: number;
  startDate?: Date;
  endDate?: Date;
  lastEmployer?: string;
  employmentRelations: EmploymentRelation[];
}

// ─────────────────────────────────────────────
// Salario Base de Cotización
// ─────────────────────────────────────────────

export interface AverageContributionSalary {
  /** Salario diario promedio de las últimas 250 semanas */
  dailySalary: number;
  /** Salario mensual equivalente */
  monthlySalary: number;
  /** Fuente del dato */
  isManual: boolean;
}

// ─────────────────────────────────────────────
// UMA
// ─────────────────────────────────────────────

export interface UMAConfiguration {
  /** UMA diaria en pesos MXN */
  dailyUMA: number;
  /** UMA mensual (umaDiaria * 30.4) */
  monthlyUMA: number;
  /** UMA anual (umaDiaria * 365) */
  annualUMA: number;
  /** Salario Mínimo General diario aplicable como referencia (ZSMG/CDMX) */
  smgCdmx?: number;
  /** Salario Mínimo de la Zona Libre de la Frontera Norte (diario, opcional). */
  smgFronteraNorte?: number;
  /** Año de la UMA seleccionada */
  year: number;
  /** Si fue capturada manualmente por el usuario */
  isCustom: boolean;
}

// ─────────────────────────────────────────────
// Modalidad 10
// ─────────────────────────────────────────────

/**
 * Modalidad 10 — incorporación voluntaria al régimen obligatorio
 * (capítulo IX de la LSS vigente, Arts. 222 a 233).
 */
export interface Modalidad10 {
  active: boolean;
  /** SBC diario declarado en la Modalidad 10 (MXN). */
  contributionSalary?: number;
  /** Equivalente del SBC declarado en UMAs (unidad legal del Art. 28). */
  contributionSalaryInUMAs?: number;
  /** Si la persona sigue trabajando mientras cotiza en la Modalidad 10. */
  continuesWorkingWhileContributing?: boolean;
  /** Meses contractuales DERIVADOS: no son editables. */
  expectedMonths?: number;
  /** Incremento salarial anual esperado (%), opcional. */
  annualSalaryIncrease?: number;
  /** Clase de riesgo laboral (I–V) que determina la prima de Riesgos de Trabajo. */
  riskClass?: RiskClass;
  /** División de actividad económica (catálogo de ocupaciones del IMSS). */
  occupationDivision?: string;
  /** Grupo principal de actividad dentro de la división. */
  occupationGroup?: string;
  /** Zona geográfica de salario mínimo (piso del SBC declarado). */
  salaryZone?: SalaryZone;
}

// ─────────────────────────────────────────────
// Beneficiarios
// ─────────────────────────────────────────────

export interface Beneficiaries {
  hasSpouse: boolean;
  hasMinorChildren: boolean;
  numberOfMinorChildren: number;
  hasDependentParents: boolean;
  numberOfDependentParents: number;
}

// ─────────────────────────────────────────────
// Input completo del simulador
// ─────────────────────────────────────────────

export interface PensionInput {
  personalData: PersonalData;
  workHistory: WorkHistory;
  averageSalary: AverageContributionSalary;
  /** SBC diario promedio proyectado al retiro; opcional para compatibilidad con simulaciones anteriores. */
  projectedAverageDailySalary?: number;
  /**
   * Reparto de las semanas del SBC promedio proyectado (ordinarias y de
   * Modalidad 10). Opcional para compatibilidad con simulaciones anteriores:
   * sin él, el motor no puede narrar el desglose del promedio.
   */
  projectedAverageBreakdown?: ProjectedAverageBreakdown;
  uma: UMAConfiguration;
  modalidad10: Modalidad10;
  beneficiaries: Beneficiaries;
}

// ─────────────────────────────────────────────
// Pasos del cálculo (para el desglose)
// ─────────────────────────────────────────────

export interface CalculationStepResult {
  /** Identificador del paso */
  id: string;
  /** Título descriptivo */
  title: string;
  /** Descripción del cálculo realizado */
  description: string;
  /** Valor resultante del paso (en pesos) */
  value: number;
  /** Fórmula aplicada (texto) */
  formula?: string;
  /** Base legal (artículo, tabla) */
  legalBasis?: string;
  /** Si este paso involucra un supuesto/estimación */
  isEstimate: boolean;
  /** Descripción del supuesto cuando aplica */
  assumption?: string;
}

// ─────────────────────────────────────────────
// Resultado principal
// ─────────────────────────────────────────────

export interface PensionResult {
  /** Tipo de pensión calculada */
  pensionType: PensionType;
  /** Pensión mensual estimada (en pesos) */
  monthlyPension: number;
  /** Pensión anual */
  annualPension: number;
  /** Monto diario */
  dailyAmount: number;
  /** Cuantía básica calculada */
  basicAmount: number;
  /** Incrementos anuales totales */
  annualIncrements: number;
  /** Incremento del 11% (Decreto DOF 2001/2004) sobre cuantía básica + incrementos */
  decree11Increment: number;
  /** Factor de edad aplicado (0.75 a 1.0) */
  ageFactor: number;
  /** Asignaciones familiares sumadas */
  familyAllowances: number;
  /** Ayuda asistencial */
  assistanceAid: number;
  /** Si se aplicó el tope de 25 UMA */
  capApplied: boolean;
  /** Si se aplicó la pensión mínima garantizada */
  pmgApplied: boolean;
  /** Desglose paso a paso */
  steps: CalculationStepResult[];
  /**
   * Proyección de semanas hasta la edad de retiro (ya cotizadas + proyectadas).
   * Opcional a propósito: las simulaciones ya guardadas en el dispositivo
   * (versiones anteriores de la app) no la tienen.
   */
  weeksProjection?: WeeksProjection;
  /** Advertencias legales o de estimación */
  warnings: string[];
  /** El resultado es una estimación */
  isEstimate: boolean;
  /** Input utilizado para el cálculo */
  input: PensionInput;
  /** Fecha del cálculo */
  calculationDate: string; // ISO string
}

// ─────────────────────────────────────────────
// Simulación guardada en historial
// ─────────────────────────────────────────────

export interface SavedSimulation {
  id: string;
  name: string;
  creationDate: string; // ISO string
  result: PensionResult;
}

// ─────────────────────────────────────────────
// Datos importados de PDF, ya revisados por el usuario
// ─────────────────────────────────────────────

/** Datos ya revisados/corregidos por el usuario en ValidationScreen, para precargar NewSimulationScreen. */
export interface ImportedSBCPeriodSegment extends Omit<SBCPeriodSegment, 'startDate' | 'endDate'> {
  /** Fechas ISO para mantener serializables los parámetros de navegación. */
  startDate: string;
  endDate: string;
}

/** Datos ya revisados/corregidos por el usuario en ValidationScreen, para precargar NewSimulationScreen. */
export interface ImportedSimulationData {
  name?: string;
  /** Fecha en formato AAAA-MM-DD */
  birthDate?: string;
  totalWeeks?: number;
  /** SBC promedio estimado de las últimas 250 semanas (aproximado; ver advertencias del parser). */
  averageSBC?: number;
  /** Último SBC registrado con el patrón más reciente — solo informativo, no es el promedio. */
  lastSBC?: number;
  /** Segmentos históricos agregados que se usarán para proyectar el promedio al retiro. */
  sbcPeriods?: ImportedSBCPeriodSegment[];
}

// ─────────────────────────────────────────────
// PDF / Importación de constancia IMSS
// ─────────────────────────────────────────────

export interface ExtractedData {
  name?: string;
  curp?: string;
  nss?: string;
  birthDate?: Date;
  totalWeeks?: number;
  recognizedWeeks?: number;
  deductedWeeks?: number;
  startDate?: Date;
  endDate?: Date;
  lastEmployer?: string;
  insuredStatus?: string;
  insuranceType?: string;
  lastSBC?: number;
  employmentRelations: EmploymentRelation[];
  averageSBC?: number;
  /**
   * TRAMOS del SBC reconstruidos del historial de movimientos, de MÁS
   * RECIENTE A MÁS ANTIGUA. Solo presente si la constancia incluye el historial detallado.
   *
   * Cada tramo es un intervalo en el que coexisten uno o más patrones: su `sbc`
   * es el SBC EFECTIVO (la suma de los patrones concurrentes) y `employerNames`
   * indica qué patrones coexistían. Las semanas siguen contando una sola vez.
   *
   * CONTRATO: la lista está ACOTADA a los tramos que SOLAPAN la ventana de las
   * últimas 250 semanas cotizadas usada para el promedio (`contributionSummary`:
   * de `firstWeekUsed` hasta `lastWeekUsed` + 7 días). Un empleo anterior a esa
   * ventana no pesa en el cálculo y por eso no se expone.
   *
   * El CÁLCULO del promedio, en cambio, sigue usando el historial COMPLETO: es lo
   * que permite saltar los huecos laborales y alcanzar las 250 semanas cotizadas
   * (Art. 167 LSS 1973, ADR-0010). El filtro acota lo que se MUESTRA, no lo que se
   * promedia.
   */
  sbcPeriods?: SBCPeriodSegment[];
  /** Desglose de la ventana de las últimas 250 semanas cotizadas usada para calcular averageSBC. */
  contributionSummary?: ContributionSummary;
}

export interface ParseResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  warnings: string[];
  missingFields: string[];
}

export interface ImportedDocument {
  documentType: DocumentType;
  extractedText: string;
  extractedData: ExtractedData;
  confidence: number; // 0 a 1
  requiresReview: boolean;
}

// ─────────────────────────────────────────────
// Constantes UMA por año (tabla de referencia)
// ─────────────────────────────────────────────

export interface UMARecord {
  year: number;
  dailyUMA: number;
  monthlyUMA: number;
  annualUMA: number;
  smgCdmx: number; // Salario Mínimo General Ciudad de México
  smgFronteraNorte?: number; // Salario Mínimo Zona Libre Frontera Norte (opcional)
  isEstimate: boolean;
  source: string;
}
