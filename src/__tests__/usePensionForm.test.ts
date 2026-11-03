/**
 * Pruebas del hook usePensionForm (estado del formulario de nueva simulación).
 *
 * Para ejecutar: npm test
 */
import { renderHook, act } from '@testing-library/react-native';
import { usePensionForm } from '../hooks/usePensionForm';
import { calculateAge, calculateRetirementDate } from '../utils/date';
import {
  countCotizedWeeksInDateRange,
  getLocalReferenceDate,
} from '../utils/weeksProjection';
import { estimateM10Months } from '../utils/modalidad10';
import { M10_DEFAULT_OCCUPATION } from '../constants/ocupaciones';
import { round2 } from '../utils/format';
import { calculatePension } from '../services/pension/PensionCalculator';
import { PensionInputSchema } from '../validation/pensionSchema';

describe('usePensionForm', () => {
  test('inicia con el estado por defecto (65 años, sin beneficiarios)', () => {
    const { result } = renderHook(() => usePensionForm());

    expect(result.current.input.personalData.retirementAge).toBe(65);
    expect(result.current.input.workHistory.totalWeeks).toBe(0);
    expect(result.current.input.beneficiaries.hasSpouse).toBe(false);
  });

  test('el estado inicial ya trae la edad real de la fecha de nacimiento', () => {
    const { result } = renderHook(() => usePensionForm());

    const { birthDate, age, estimatedRetirementDate } = result.current.input.personalData;
    // Con `age: 0` la proyección de semanas hasta el retiro quedaba inflada
    // a 65 años de horizonte.
    expect(age).toBe(calculateAge(birthDate));
    expect(age).toBeGreaterThan(0);
    expect(estimatedRetirementDate).toEqual(
      calculateRetirementDate(birthDate, result.current.input.personalData.retirementAge),
    );
  });

  test('updatePersonalData recalcula la edad al cambiar la fecha de nacimiento', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ birthDate: new Date(1960, 0, 1) });
    });

    expect(result.current.input.personalData.age).toBeGreaterThan(0);
    expect(result.current.input.personalData.birthDate).toEqual(new Date(1960, 0, 1));
  });

  test('updatePersonalData recalcula la fecha de retiro al cambiar la edad de retiro', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ birthDate: new Date(1960, 0, 1) });
    });
    act(() => {
      result.current.updatePersonalData({ retirementAge: 60 });
    });

    expect(result.current.input.personalData.retirementAge).toBe(60);
    expect(result.current.input.personalData.estimatedRetirementDate.getFullYear()).toBe(2020);
  });

  test('updatePersonalData recalcula la fecha de retiro al cambiar la fecha de nacimiento', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ birthDate: new Date(1960, 0, 1) });
    });

    const { birthDate, retirementAge, estimatedRetirementDate } = result.current.input.personalData;
    expect(estimatedRetirementDate).toEqual(calculateRetirementDate(birthDate, retirementAge));
  });

  test('updateWorkHistory actualiza las semanas cotizadas', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateWorkHistory({ totalWeeks: 800 });
    });

    expect(result.current.input.workHistory.totalWeeks).toBe(800);
  });

  test('updateDailySalary actualiza el salario diario y su equivalente mensual', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateDailySalary(300);
    });

    expect(result.current.input.averageSalary.dailySalary).toBe(300);
    expect(result.current.input.averageSalary.monthlySalary).toBeCloseTo(300 * 30.4, 1);
  });

  test('updateMonthlySalary actualiza el salario mensual y su equivalente diario', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateMonthlySalary(9120);
    });

    expect(result.current.input.averageSalary.monthlySalary).toBe(9120);
    expect(result.current.input.averageSalary.dailySalary).toBeCloseTo(300, 1);
  });

  test('selectUMAByYear actualiza la configuración de UMA para un año válido', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.selectUMAByYear(2023);
    });

    expect(result.current.input.uma.year).toBe(2023);
    expect(result.current.input.uma.isCustom).toBe(false);
  });

  test('selectUMAByYear no cambia nada para un año sin registro', () => {
    const { result } = renderHook(() => usePensionForm());
    const before = result.current.input.uma;

    act(() => {
      result.current.selectUMAByYear(1999);
    });

    expect(result.current.input.uma).toEqual(before);
  });

  test('setCustomUMA marca la UMA como personalizada', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.setCustomUMA(120);
    });

    expect(result.current.input.uma.dailyUMA).toBe(120);
    expect(result.current.input.uma.isCustom).toBe(true);
  });

  test('updateModalidad10 actualiza los campos de Modalidad 10', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateModalidad10({ active: true, contributionSalary: 500 });
    });

    expect(result.current.input.modalidad10.active).toBe(true);
    expect(result.current.input.modalidad10.contributionSalary).toBe(500);
  });

  test('la Modalidad 10 arranca con la ocupación precargada del catálogo oficial', () => {
    const { result } = renderHook(() => usePensionForm());

    const { occupationDivision, occupationGroup, riskClass } =
      result.current.input.modalidad10;

    expect(occupationDivision).toBe(M10_DEFAULT_OCCUPATION.divisionCode);
    expect(occupationGroup).toBe(M10_DEFAULT_OCCUPATION.groupCode);
    // La clase viene del catálogo, no se escribe a mano.
    expect(riskClass).toBe(M10_DEFAULT_OCCUPATION.riskClass);
    expect(riskClass).toBe(3);
  });

  test('al activar Modalidad 10 se precarga el máximo legal de UMAs', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateModalidad10({ active: true });
    });

    const { contributionSalary, contributionSalaryInUMAs } = result.current.input.modalidad10;
    expect(contributionSalaryInUMAs).toBe(25);
    expect(contributionSalary).toBe(
      round2(25 * result.current.input.uma.dailyUMA),
    );
  });

  test('el SBC declarado y su equivalente en UMAs se mantienen sincronizados', () => {
    const { result } = renderHook(() => usePensionForm());
    const umaDiaria = result.current.input.uma.dailyUMA;

    act(() => {
      result.current.setModalidad10ContributionSalary(1000);
    });

    expect(result.current.input.modalidad10.contributionSalary).toBe(1000);
    expect(result.current.input.modalidad10.contributionSalaryInUMAs).toBe(
      round2(1000 / umaDiaria),
    );

    act(() => {
      result.current.setModalidad10UMAs(10);
    });

    expect(result.current.input.modalidad10.contributionSalaryInUMAs).toBe(10);
    expect(result.current.input.modalidad10.contributionSalary).toBe(
      round2(10 * umaDiaria),
    );
  });

  test('cambiar de año de UMA conserva el SBC declarado y recalcula sus UMAs', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.setModalidad10ContributionSalary(2000);
    });
    act(() => {
      result.current.selectUMAByYear(2024);
    });

    const { dailyUMA } = result.current.input.uma;
    expect(dailyUMA).toBe(108.57);
    expect(result.current.input.modalidad10.contributionSalary).toBe(2000);
    expect(result.current.input.modalidad10.contributionSalaryInUMAs).toBe(
      round2(2000 / 108.57),
    );
  });

  test('una UMA personalizada conserva el SBC y recalcula sus UMAs', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.setModalidad10ContributionSalary(2000);
    });
    act(() => {
      result.current.setCustomUMA(120);
    });

    expect(result.current.input.modalidad10.contributionSalary).toBe(2000);
    expect(result.current.input.modalidad10.contributionSalaryInUMAs).toBe(
      round2(2000 / 120),
    );
  });

  test('updateModalidad10 precarga los meses esperados al activar Modalidad 10', () => {
    const { result } = renderHook(() => usePensionForm());

    const { estimatedRetirementDate } = result.current.input.personalData;
    const mesesEsperados = estimateM10Months(getLocalReferenceDate(), estimatedRetirementDate);

    act(() => {
      result.current.updateModalidad10({ active: true, contributionSalary: 500 });
    });

    expect(result.current.input.modalidad10.expectedMonths).toBe(mesesEsperados);
  });

  test('al desactivar Modalidad 10 se borran los meses esperados', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateModalidad10({ active: true });
    });
    act(() => {
      result.current.updateModalidad10({ active: false });
    });

    expect(result.current.input.modalidad10.active).toBe(false);
    // El campo es derivado (no editable): sin Modalidad 10 no hay meses que
    // cotizar en M10, así que no queda valor.
    expect(result.current.input.modalidad10.expectedMonths).toBeUndefined();
  });

  test('al activar Modalidad 10 los meses se derivan hasta la fecha exacta de retiro', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ age: 40, retirementAge: 65 });
    });
    act(() => {
      result.current.updateModalidad10({ active: true });
    });

    expect(result.current.input.modalidad10.expectedMonths).toBe(
      estimateM10Months(
        getLocalReferenceDate(),
        result.current.input.personalData.estimatedRetirementDate,
      ),
    );
  });

  test('al cambiar solo la edad sin cambiar la fecha de retiro no cambia el horizonte M10', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ age: 40, retirementAge: 65 });
    });
    act(() => {
      result.current.updateModalidad10({ active: true });
    });
    act(() => {
      result.current.updatePersonalData({ age: 50 });
    });

    expect(result.current.input.modalidad10.expectedMonths).toBe(
      estimateM10Months(
        getLocalReferenceDate(),
        result.current.input.personalData.estimatedRetirementDate,
      ),
    );
  });

  test('al cambiar la edad de retiro con Modalidad 10 activa los meses se recalculan', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ age: 40, retirementAge: 65 });
    });
    act(() => {
      result.current.updateModalidad10({ active: true });
    });
    act(() => {
      result.current.updatePersonalData({ retirementAge: 60 });
    });

    expect(result.current.input.modalidad10.expectedMonths).toBe(
      estimateM10Months(
        getLocalReferenceDate(),
        result.current.input.personalData.estimatedRetirementDate,
      ),
    );
  });

  test('los meses esperados no se pueden editar a mano: siempre derivan del horizonte', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ age: 40, retirementAge: 65 });
    });
    act(() => {
      result.current.updateModalidad10({ active: true });
    });
    act(() => {
      result.current.updateModalidad10({ expectedMonths: 12 });
    });

    expect(result.current.input.modalidad10.expectedMonths).toBe(
      estimateM10Months(
        getLocalReferenceDate(),
        result.current.input.personalData.estimatedRetirementDate,
      ),
    );
  });

  test('acota a 600 meses cuando el horizonte supera los 50 años que admite el esquema', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ estimatedRetirementDate: new Date(2100, 0, 1) });
    });
    act(() => {
      result.current.updateModalidad10({ active: true });
    });

    // El horizonte supera el máximo vigente de 600 meses admitido por Zod.
    expect(result.current.input.modalidad10.expectedMonths).toBe(600);
  });

  test('expone la proyección de semanas para que la UI no la recalcule', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ age: 40, retirementAge: 65 });
    });
    act(() => {
      result.current.updateWorkHistory({ totalWeeks: 100 });
    });

    const referenceDate = getLocalReferenceDate();
    const retirementDate = result.current.input.personalData.estimatedRetirementDate;
    const projectedWeeks = countCotizedWeeksInDateRange(
      new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1),
      retirementDate,
    );
    expect(result.current.weeksProjection.currentWeeks).toBe(100);
    expect(result.current.weeksProjection.projectedWeeks).toBe(projectedWeeks);
    expect(result.current.weeksProjection.targetWeeks).toBe(100 + projectedWeeks);
    expect(result.current.weeksProjection.yearsToRetirement).toBe(25);
  });

  test('la proyección del formulario es la MISMA que la del motor', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ age: 40, retirementAge: 65 });
    });
    act(() => {
      result.current.updateWorkHistory({ totalWeeks: 100 });
    });
    act(() => {
      result.current.updateModalidad10({ active: true });
    });

    // La UI narra las cifras que el motor ya calculó (RNF-013).
    const motor = calculatePension(result.current.input);
    expect(result.current.weeksProjection).toEqual(motor.weeksProjection);
  });

  test('los meses de Modalidad 10 se actualizan al cambiar la edad de retiro', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updatePersonalData({ birthDate: new Date(1980, 0, 1) });
    });
    act(() => {
      result.current.updateModalidad10({ active: true });
    });
    act(() => {
      result.current.updatePersonalData({ retirementAge: 60 });
    });

    expect(result.current.input.modalidad10.expectedMonths).toBe(
      estimateM10Months(
        getLocalReferenceDate(),
        result.current.input.personalData.estimatedRetirementDate,
      ),
    );
  });

  test('el hook, Zod y el motor comparten la proyección por fecha exacta', () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 5, 1));
    try {
      const { result } = renderHook(() => usePensionForm());
      act(() => {
        result.current.updatePersonalData({
          name: 'Persona de prueba',
          birthDate: new Date(1960, 5, 12),
          retirementAge: 65,
        });
      });
      act(() => {
        result.current.updateWorkHistory({ totalWeeks: 497 });
      });

      const input = result.current.input;
      const engineResult = calculatePension(input);
      const validation = PensionInputSchema.safeParse(input);
      const weekIssue = validation.success
        ? undefined
        : validation.error.issues.find((issue) => issue.path.join('.') === 'workHistory.totalWeeks');

      expect(input.personalData.estimatedRetirementDate).toEqual(new Date(2025, 5, 12));
      expect(result.current.weeksProjection).toEqual(engineResult.weeksProjection);
      expect(engineResult.weeksProjection?.projectedWeeks).toBe(2);
      expect(engineResult.weeksProjection?.targetWeeks).toBe(499);
      expect(weekIssue?.message).toContain('497 cotizadas + 2 proyectadas hasta la edad de retiro = 499');
      expect(engineResult.steps.find((step) => step.id === 'incrementos_anuales')?.description)
        .toContain('497 cotizadas + 2 proyectadas hasta la edad de retiro = 499');
    } finally {
      jest.useRealTimers();
    }
  });

  test('recalcula semanas y meses M10 si cambia solo la fecha exacta de retiro', () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 5, 1));
    try {
      const { result } = renderHook(() => usePensionForm());
      act(() => {
        result.current.updatePersonalData({
          birthDate: new Date(1960, 5, 1),
          retirementAge: 65,
        });
      });
      act(() => {
        result.current.updateModalidad10({ active: true, contributionSalary: 500 });
      });

      expect(result.current.input.modalidad10.expectedMonths).toBe(0);
      expect(result.current.weeksProjection.projectedWeeks).toBe(0);

      act(() => {
        result.current.updatePersonalData({ estimatedRetirementDate: new Date(2025, 6, 1) });
      });

      expect(result.current.input.modalidad10.expectedMonths).toBe(1);
      expect(result.current.weeksProjection.projectedWeeks).toBe(4);
    } finally {
      jest.useRealTimers();
    }
  });

  test('updateBeneficiaries actualiza los beneficiarios', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateBeneficiaries({ hasSpouse: true });
    });

    expect(result.current.input.beneficiaries.hasSpouse).toBe(true);
  });

  test('resetForm restaura el estado inicial', () => {
    const { result } = renderHook(() => usePensionForm());

    act(() => {
      result.current.updateWorkHistory({ totalWeeks: 800 });
    });
    expect(result.current.input.workHistory.totalWeeks).toBe(800);

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.input.workHistory.totalWeeks).toBe(0);
  });
});
