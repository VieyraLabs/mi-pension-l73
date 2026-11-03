/**
 * Esquemas de validación Zod para los formularios de la aplicación.
 * Garantizan la integridad de los datos antes del cálculo.
 */
import { z } from 'zod';
import { MINIMUM_WEEKS_VEJEZ, MODALIDAD_10_CAP_TIMES_UMA } from '../constants/ley73';
import { calculateM10PlannedWeeks } from '../utils/modalidad10';
import {
  calculateWeeksProjection,
  describeWeeksProjection,
  getLocalReferenceDate,
} from '../utils/weeksProjection';

// ─────────────────────────────────────────────
// Esquemas base
// ─────────────────────────────────────────────

export const PersonalDataSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es requerido' })
    .trim()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  birthDate: z.date({ required_error: 'La fecha de nacimiento es requerida' }),
  age: z.number().int().min(0).max(120),
  estimatedRetirementDate: z.date({ required_error: 'La fecha de retiro estimada es requerida' }),
  retirementAge: z
    .number({ required_error: 'La edad de retiro es requerida' })
    .min(60, 'La edad mínima de retiro es 60 años (Cesantía en Edad Avanzada)')
    .max(100, 'La edad máxima permitida es 100 años')
    .refine(
      (value) => Math.abs(value * 2 - Math.round(value * 2)) < 1e-9,
      'La edad debe ser un número entero o medio (60, 60.5, 61, ...)',
    ),
});

/**
 * Relación laboral reconstruida (por ejemplo, al importar una constancia del
 * IMSS). Espeja `EmploymentRelation` de src/models/index.ts — mantener ambos
 * en sincronía: este esquema es el contrato compartido de entrada entre
 * formulario, motor, parser PDF e historial (RNF-007/RNF-012).
 */
export const EmploymentRelationSchema = z.object({
  employerName: z.string(),
  employerRegistrationNumber: z.string(),
  startDate: z.date({ required_error: 'La fecha de alta es requerida' }),
  endDate: z.date().optional(),
  contributionBaseSalary: z
    .number({ required_error: 'El salario base de cotización es requerido' })
    .min(0, 'El salario base de cotización no puede ser negativo'),
  movementType: z.string(),
  contributedDays: z
    .number({ required_error: 'Los días cotizados son requeridos' })
    .int('Los días cotizados deben ser un número entero')
    .min(0, 'Los días cotizados no pueden ser negativos'),
});

export const WorkHistorySchema = z.object({
  // El mínimo de 500 semanas (Arts. 138 y 145 LSS 1973) se valida a nivel de
  // PensionInputSchema (ver más abajo), no aquí — considera también las
  // semanas proyectadas por Modalidad 10, que viven en otro campo.
  totalWeeks: z
    .number({ required_error: 'Las semanas cotizadas son requeridas' })
    .int('Las semanas deben ser un número entero')
    .min(0, 'Las semanas cotizadas no pueden ser negativas')
    .max(5000, 'El número de semanas parece incorrecto (máximo 5000)'),
  recognizedWeeks: z.number().int().min(0).optional(),
  deductedWeeks: z.number().int().min(0).optional(),
  employmentRelations: z.array(EmploymentRelationSchema).default([]),
});

export const AverageContributionSalarySchema = z.object({
  dailySalary: z
    .number({ required_error: 'El salario diario es requerido' })
    .positive('El salario diario debe ser mayor a cero')
    .max(100000, 'El salario parece excesivo (máximo $100,000/día)'),
  monthlySalary: z.number().positive(),
  isManual: z.boolean().default(true),
});

export const UMAConfigurationSchema = z.object({
  dailyUMA: z
    .number({ required_error: 'El valor de la UMA es requerido' })
    .positive('La UMA debe ser mayor a cero')
    .max(10000, 'El valor de la UMA parece incorrecto'),
  monthlyUMA: z.number().positive(),
  annualUMA: z.number().positive(),
  smgCdmx: z.number().positive().optional(),
  smgFronteraNorte: z.number().positive().optional(),
  year: z.number().int().min(2017).max(2100),
  isCustom: z.boolean().default(false),
});

export const Modalidad10Schema = z.object({
  active: z.boolean().default(false),
  contributionSalary: z
    .number()
    .positive('El salario de la Modalidad 10 debe ser mayor a cero')
    .optional()
    .nullable(),
  contributionSalaryInUMAs: z
    .number()
    .positive('Las UMAs de la Modalidad 10 deben ser mayores a cero')
    .optional()
    .nullable(),
  continuesWorkingWhileContributing: z.boolean().optional().nullable(),
  expectedMonths: z
    .number()
    .int()
    .min(0, 'Los meses de Modalidad 10 no pueden ser negativos')
    .max(600)
    .optional()
    .nullable(),
  annualSalaryIncrease: z.number().min(0).max(100).optional().nullable(),
  riskClass: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .optional()
    .nullable(),
  occupationDivision: z.string().max(10).optional().nullable(),
  occupationGroup: z.string().max(10).optional().nullable(),
  salaryZone: z.enum(['general', 'frontera_norte']).optional().nullable(),
});

export const BeneficiariesSchema = z.object({
  hasSpouse: z.boolean().default(false),
  hasMinorChildren: z.boolean().default(false),
  numberOfMinorChildren: z.number().int().min(0).max(20).default(0),
  hasDependentParents: z.boolean().default(false),
  numberOfDependentParents: z.number().int().min(0).max(2).default(0),
});

// ─────────────────────────────────────────────
// Esquema completo del formulario
// ─────────────────────────────────────────────

function createPensionInputSchema(referenceDateProvider: () => Date) {
  return z
    .object({
      personalData: PersonalDataSchema,
      workHistory: WorkHistorySchema,
      averageSalary: AverageContributionSalarySchema,
      projectedAverageDailySalary: z.number().positive().max(100000).optional(),
      uma: UMAConfigurationSchema,
      modalidad10: Modalidad10Schema,
      beneficiaries: BeneficiariesSchema,
    })
    .superRefine((data, ctx) => {
      // El mínimo legal se evalúa contra la proyección hasta la fecha exacta
      // de retiro y las semanas contractuales de M10.
      const referenceDate = referenceDateProvider();
      const retirementDate = data.personalData.estimatedRetirementDate;
      const projection = calculateWeeksProjection({
        currentWeeks: data.workHistory.totalWeeks,
        age: data.personalData.age,
        retirementAge: data.personalData.retirementAge,
        referenceDate,
        retirementDate,
        m10PlannedWeeks: data.modalidad10.active
          ? calculateM10PlannedWeeks(referenceDate, retirementDate)
          : 0,
      });
      if (projection.targetWeeks < MINIMUM_WEEKS_VEJEZ) {
        const faltantes = MINIMUM_WEEKS_VEJEZ - projection.targetWeeks;
        // El desglose es el MISMO que narra el motor (Art. 167 LSS 1973):
        // semanas cotizadas + proyectadas hasta la edad de retiro = total con
        // el que se jubila el asegurado.
        const { breakdown } = describeWeeksProjection(projection);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['workHistory', 'totalWeeks'],
          message:
            `Se requieren mínimo ${MINIMUM_WEEKS_VEJEZ} semanas cotizadas (Arts. 138 y 145 LSS 1973)` +
            ` (${breakdown}). Te faltan ${faltantes} semanas para al jubilarse.`,
        });
      }

      // Límites del SBC declarado en la Modalidad 10 (Art. 28 LSS vigente):
      // piso = salario mínimo del área geográfica, techo = 25 UMA.
      if (data.modalidad10.active) {
        const salary = data.modalidad10.contributionSalary;
        const maximum = MODALIDAD_10_CAP_TIMES_UMA * data.uma.dailyUMA;
        // Piso por zona sin fallback: si el registro no trae el SMG de la zona,
        // no se inventa un mínimo de otro año (comportamiento previo a la v2).
        const minimum =
          data.modalidad10.salaryZone === 'frontera_norte' && data.uma.smgFronteraNorte != null
            ? data.uma.smgFronteraNorte
            : data.uma.smgCdmx;
        if (salary != null) {
          if (salary > maximum) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['modalidad10', 'contributionSalary'],
              message:
                `El salario de la Modalidad 10 no puede exceder ${MODALIDAD_10_CAP_TIMES_UMA} UMA ` +
                `($${maximum.toFixed(2)}/día) — Art. 28 LSS vigente.`,
            });
          }
          if (minimum != null && salary < minimum) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['modalidad10', 'contributionSalary'],
              message:
                `El salario de la Modalidad 10 no puede ser inferior al salario mínimo de tu zona ` +
                `($${minimum.toFixed(2)}/día) — Art. 28 LSS vigente.`,
            });
          }
        }
        const umas = data.modalidad10.contributionSalaryInUMAs;
        if (umas != null && umas > MODALIDAD_10_CAP_TIMES_UMA) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['modalidad10', 'contributionSalaryInUMAs'],
            message:
              `Las UMAs de la Modalidad 10 no pueden exceder ${MODALIDAD_10_CAP_TIMES_UMA} ` +
              `— Art. 28 LSS vigente.`,
          });
        }
      }
    });
}

export const PensionInputSchema = createPensionInputSchema(getLocalReferenceDate);

/** Parse con la fecha local de referencia de la operación que lo invoca. */
export function safeParsePensionInputAtReferenceDate(input: unknown, referenceDate: Date) {
  return createPensionInputSchema(() => referenceDate).safeParse(input);
}

export type PensionInputForm = z.infer<typeof PensionInputSchema>;

// ─────────────────────────────────────────────
// Esquema simplificado para el Simulador
// ─────────────────────────────────────────────

export const SimulatorSchema = z.object({
  retirementAge: z.number().int().min(60).max(100),
  dailySalary: z.number().positive(),
  contributedWeeks: z.number().int().min(1),
  dailyUMA: z.number().positive(),
  hasSpouse: z.boolean().default(false),
  hasMinorChildren: z.boolean().default(false),
  numberOfChildren: z.number().int().min(0).default(0),
});

export type SimulatorForm = z.infer<typeof SimulatorSchema>;
