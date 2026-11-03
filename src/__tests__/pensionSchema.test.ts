/**
 * Tests de contrato del esquema de validación compartido (Zod).
 *
 * CHG-20261024-002 / US-004: `employmentRelations` está tipado con
 * `EmploymentRelationSchema` (espejo de `EmploymentRelation` de
 * src/models/index.ts) — ya no admite `any`. Estos tests fijan el contrato:
 * formularios, motor, parser PDF e historial comparten esta misma forma.
 *
 * Para ejecutar: npm test
 */
import {
  PensionInputSchema,
  Modalidad10Schema,
  WorkHistorySchema,
  EmploymentRelationSchema,
  safeParsePensionInputAtReferenceDate,
  type PensionInputForm,
} from '../validation/pensionSchema';

function buildValidRelation() {
  return {
    employerName: 'EMPRESA DE PRUEBA SA DE CV',
    employerRegistrationNumber: 'E234567810',
    startDate: new Date(2018, 6, 1),
    endDate: new Date(2021, 0, 15),
    contributionBaseSalary: 500,
    movementType: '09',
    contributedDays: 920,
  };
}

function parseAtReferenceDate(input: unknown, referenceDate: Date) {
  return safeParsePensionInputAtReferenceDate(input, referenceDate);
}

function buildValidInput(): PensionInputForm {
  return {
    personalData: {
      name: 'Usuario de Prueba',
      birthDate: new Date(1965, 0, 1),
      age: 60,
      estimatedRetirementDate: new Date(2025, 0, 1),
      retirementAge: 60,
    },
    workHistory: {
      totalWeeks: 520,
      employmentRelations: [buildValidRelation()],
    },
    averageSalary: { dailySalary: 200, monthlySalary: 6080, isManual: true },
    uma: { dailyUMA: 113.14, monthlyUMA: 3439.46, annualUMA: 41296.1, year: 2025, isCustom: false },
    modalidad10: { active: false },
    beneficiaries: {
      hasSpouse: false,
      hasMinorChildren: false,
      numberOfMinorChildren: 0,
      hasDependentParents: false,
      numberOfDependentParents: 0,
    },
  };
}

describe('EmploymentRelationSchema', () => {
  test('acepta una relación laboral completa (forma que produce el parser PDF)', () => {
    const result = EmploymentRelationSchema.safeParse(buildValidRelation());
    expect(result.success).toBe(true);
  });

  test('acepta un empleo activo sin endDate', () => {
    const vigente = buildValidRelation();
    delete (vigente as Partial<typeof vigente>).endDate;
    const result = EmploymentRelationSchema.safeParse(vigente);
    expect(result.success).toBe(true);
  });

  test('rechaza contributedDays negativo con mensaje accionable', () => {
    const result = EmploymentRelationSchema.safeParse({
      ...buildValidRelation(),
      contributedDays: -10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('no pueden ser negativos'))).toBe(
        true,
      );
    }
  });

  test('rechaza contributedDays fraccionario', () => {
    const result = EmploymentRelationSchema.safeParse({
      ...buildValidRelation(),
      contributedDays: 9.5,
    });
    expect(result.success).toBe(false);
  });

  test('rechaza contributionBaseSalary negativo', () => {
    const result = EmploymentRelationSchema.safeParse({
      ...buildValidRelation(),
      contributionBaseSalary: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('no puede ser negativo')),
      ).toBe(true);
    }
  });

  test('rechaza startDate faltante', () => {
    const sinAlta = buildValidRelation();
    delete (sinAlta as Partial<typeof sinAlta>).startDate;
    const result = EmploymentRelationSchema.safeParse(sinAlta);
    expect(result.success).toBe(false);
  });
});

describe('WorkHistorySchema — employmentRelations tipado', () => {
  test('aplica default [] cuando no se proveen relaciones', () => {
    const result = WorkHistorySchema.parse({ totalWeeks: 500 });
    expect(result.employmentRelations).toEqual([]);
  });

  test('valida las relaciones dentro del historial laboral', () => {
    const result = WorkHistorySchema.safeParse({
      totalWeeks: 500,
      employmentRelations: [{ ...buildValidRelation(), contributedDays: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('PensionInputSchema — contrato completo con historial reconstruido', () => {
  test('acepta un input válido que incluye una relación laboral completa', () => {
    const result = PensionInputSchema.safeParse(buildValidInput());
    expect(result.success).toBe(true);
  });

  test('rechaza el input completo si una relación tiene contributedDays negativo', () => {
    const input = buildValidInput();
    input.workHistory.employmentRelations = [
      { ...buildValidRelation(), contributedDays: -5 },
    ];
    const result = PensionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.path.includes('employmentRelations'),
        ),
      ).toBe(true);
    }
  });
});

describe('Modalidad10Schema — meses esperados', () => {
  test('acepta cero meses si no hay un mes contractual antes del retiro', () => {
    expect(Modalidad10Schema.safeParse({ active: true, expectedMonths: 0 }).success).toBe(true);
  });
});

describe('PensionInputSchema — límites del SBC de Modalidad 10 (Art. 28 LSS vigente)', () => {
  test('acepta un SBC dentro del rango: de una UMA al tope de 25 UMA', () => {
    const input = buildValidInput();
    input.uma.smgCdmx = 278.8;
    input.modalidad10 = {
      active: true,
      contributionSalary: 2828.5,
      contributionSalaryInUMAs: 25,
    };

    const result = parseAtReferenceDate(input, new Date(2025, 4, 30));

    expect(result.success).toBe(true);
  });

  test('rechaza un SBC por encima de 25 UMA', () => {
    const input = buildValidInput();
    input.uma.smgCdmx = 278.8;
    input.modalidad10 = {
      active: true,
      contributionSalary: 3000,
      contributionSalaryInUMAs: 26.52,
    };

    const result = parseAtReferenceDate(input, new Date(2025, 4, 30));

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.message.includes('no puede exceder 25 UMA')),
    ).toBe(true);
  });

  test('rechaza un SBC por debajo del salario mínimo de la zona', () => {
    const input = buildValidInput();
    input.uma.smgCdmx = 278.8;
    input.modalidad10 = {
      active: true,
      contributionSalary: 100,
      contributionSalaryInUMAs: 0.88,
    };

    const result = parseAtReferenceDate(input, new Date(2025, 4, 30));

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.message.includes('salario mínimo de tu zona')),
    ).toBe(true);
  });

  test('rechaza un número de UMAs por encima del tope legal', () => {
    const input = buildValidInput();
    input.modalidad10 = {
      active: true,
      contributionSalary: 2828.5,
      contributionSalaryInUMAs: 26,
    };

    const result = parseAtReferenceDate(input, new Date(2025, 4, 30));

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.message.includes('no pueden exceder 25')),
    ).toBe(true);
  });
});

describe('PensionInputSchema — mínimo de 500 semanas (con proyección al jubilarse)', () => {
  test('rechaza edad de retiro menor a 60 citando el límite legal (Cesantía en Edad Avanzada)', () => {
    const input = buildValidInput();
    input.personalData.retirementAge = 58;
    const result = PensionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('mínima de retiro es 60')),
      ).toBe(true);
    }
  });

  test('acepta una edad de retiro con fracción de medio año (60.5)', () => {
    // La edad con medios años es la que el motor necesita para aplicar la
    // regla del Art. 171 LSS 1973 ("se aumentará un año a los cumplidos
    // cuando la edad los exceda en seis meses").
    const input = buildValidInput();
    input.personalData.retirementAge = 60.5;
    const result = PensionInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  test('rechaza una edad de retiro que no es múltiplo de medio año', () => {
    const input = buildValidInput();
    input.personalData.retirementAge = 60.3;
    const result = PensionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('entero o medio')),
      ).toBe(true);
    }
  });

  test('rechaza 499 semanas sin Modalidad 10', () => {
    const input = { ...buildValidInput() };
    input.workHistory = { totalWeeks: 499, employmentRelations: [buildValidRelation()] };
    const result = PensionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('mínimo 500 semanas')),
      ).toBe(true);
    }
  });

  test('el mensaje dice cuántas semanas faltan PARA AL JUBILARSE', () => {
    const input = { ...buildValidInput() };
    input.workHistory = { totalWeeks: 100, employmentRelations: [] };
    // El asegurado está en su edad de retiro: no hay horizonte a futuro.
    const result = PensionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const mensaje = result.error.issues
        .map((i) => i.message)
        .find((m) => m.includes('mínimo 500 semanas'));
      expect(mensaje).toBeDefined();
      // 500 − 100 = 400 semanas faltantes, expresadas como faltan "al jubilarse".
      expect(mensaje).toMatch(/400/);
      expect(mensaje).toMatch(/al jubilarse/i);
    }
  });

  test('acepta pocas semanas si la proyección hasta el retiro alcanza las 500', () => {
    // El horizonte date-exacto de 35 años supera ampliamente el mínimo legal.
    const input = { ...buildValidInput() };
    input.personalData = {
      ...input.personalData,
      age: 30,
      retirementAge: 65,
      estimatedRetirementDate: new Date(2060, 5, 1),
    };
    input.workHistory = { totalWeeks: 100, employmentRelations: [] };
    const result = parseAtReferenceDate(input, new Date(2025, 5, 1));
    expect(result.success).toBe(true);
  });

  test('quien no cumple hoy pero sí al jubilarse NO recibe el error de semanas', () => {
    // Con la fecha exacta de retiro indicada, la proyección supera el mínimo.
    const input = { ...buildValidInput() };
    input.personalData = {
      ...input.personalData,
      age: 30,
      retirementAge: 65,
      estimatedRetirementDate: new Date(2060, 5, 1),
    };
    input.workHistory = { totalWeeks: 100, employmentRelations: [] };
    const result = parseAtReferenceDate(input, new Date(2025, 5, 1));
    expect(result.success).toBe(true);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('mínimo 500 semanas')),
      ).toBe(false);
    }
  });

  test('rechaza cuando ni con la proyección se alcanza el mínimo de 500', () => {
    // Del 1 de enero al 1 de enero siguiente se proyectan 52 semanas.
    const input = { ...buildValidInput() };
    input.personalData = {
      ...input.personalData,
      age: 64,
      retirementAge: 65,
      estimatedRetirementDate: new Date(2026, 0, 1),
    };
    input.workHistory = { totalWeeks: 50, employmentRelations: [] };
    const result = parseAtReferenceDate(input, new Date(2025, 0, 1));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('mínimo 500 semanas')),
      ).toBe(true);
    }
  });

  test('el mensaje del mínimo de 500 narra las cifras de la proyección', () => {
    // 50 cotizadas + 52 proyectadas en el intervalo exacto = 102; faltan 398.
    const input = { ...buildValidInput() };
    input.personalData = {
      ...input.personalData,
      age: 64,
      retirementAge: 65,
      estimatedRetirementDate: new Date(2026, 0, 1),
    };
    input.workHistory = { totalWeeks: 50, employmentRelations: [] };
    const result = parseAtReferenceDate(input, new Date(2025, 0, 1));
    expect(result.success).toBe(false);
    if (!result.success) {
      const mensaje = result.error.issues
        .map((i) => i.message)
        .find((m) => m.includes('mínimo 500 semanas'));
      expect(mensaje).toBeDefined();
      // Cifras de la proyección: actuales, proyectadas y objetivo.
      expect(mensaje).toMatch(/50 cotizadas/);
      expect(mensaje).toMatch(/52 proyectadas hasta la edad de retiro/);
      expect(mensaje).toMatch(/= 102/);
      expect(mensaje).toMatch(/Te faltan 398 semanas/);
    }
  });

  test('acepta 480 semanas + Modalidad 10 planeada que completa el mínimo', () => {
    const input = { ...buildValidInput() };
    input.personalData.estimatedRetirementDate = new Date(2025, 5, 15);
    input.workHistory = { totalWeeks: 496, employmentRelations: [buildValidRelation()] };
    input.modalidad10 = {
      active: true,
      contributionSalary: 300,
      startDate: new Date(2025, 0, 1),
      expectedMonths: 24,
      annualSalaryIncrease: 5,
    } as typeof input.modalidad10;
    const result = parseAtReferenceDate(input, new Date(2025, 4, 30));
    expect(result.success).toBe(true);
  });

  test('rechaza 400 semanas aunque Modalidad 10 planeada no alcance el mínimo', () => {
    const input = { ...buildValidInput() };
    input.personalData.estimatedRetirementDate = new Date(2025, 5, 15);
    input.workHistory = { totalWeeks: 400, employmentRelations: [] };
    input.modalidad10 = {
      active: true,
      contributionSalary: 300,
      startDate: new Date(2025, 0, 1),
      expectedMonths: 6,
      annualSalaryIncrease: 5,
    } as typeof input.modalidad10;
    const result = parseAtReferenceDate(input, new Date(2025, 4, 30));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('planeadas en Modalidad 10')),
      ).toBe(true);
    }
  });
});
