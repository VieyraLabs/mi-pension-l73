/**
 * Hook para manejar el estado del formulario de nueva simulación.
 * Mantiene el estado completo del PensionInput entre los pasos del stepper.
 */
import { useState, useCallback, useMemo } from 'react';
import type {
  PensionInput,
  PersonalData,
  WorkHistory,
  Modalidad10,
  Beneficiaries,
} from '../models';
import { UMA_ACTUAL, calculateUMAFromDailyValue, getUMAByYear } from '../constants/uma';
import { MODALIDAD_10_CAP_TIMES_UMA } from '../constants/ley73';
import { calculateAge, calculateRetirementDate } from '../utils/date';
import { dailyToMonthly, monthlyToDaily, round2 } from '../utils/format';
import {
  M10_MAX_MONTHS,
  calculateM10PlannedWeeks,
  estimateM10Months,
  m10SalaryFromUMAs,
  m10SalaryInUMAs,
  m10SalaryRange,
} from '../utils/modalidad10';
import {
  calculateWeeksProjection,
  getLocalReferenceDate,
} from '../utils/weeksProjection';
import { M10_DEFAULT_OCCUPATION } from '../constants/ocupaciones';

/**
 * Fecha de nacimiento por defecto del formulario.
 *
 * Exportada para que los campos de fecha de nacimiento (`PersonalDataStep`,
 * `ValidationScreen`) abran su calendario en la fecha que precarga el
 * formulario cuando aún no hay una fecha válida.
 */
export const DEFAULT_BIRTH_DATE = new Date(1965, 0, 1);

/** Acota los meses de Modalidad 10 a su máximo contractual, permitiendo cero. */
function clampM10Months(months: number): number {
  return Math.min(M10_MAX_MONTHS, months);
}

/**
 * Meses de Modalidad 10 DERIVADOS de los meses contractuales entre la
 * referencia local y la fecha exacta de retiro. El valor cero es válido cuando
 * no hay un mes contractual completo por delante.
 */
function expectedMonthsForHorizon(referenceDate: Date, personalData: PersonalData): number {
  return clampM10Months(estimateM10Months(referenceDate, personalData.estimatedRetirementDate));
}

const INITIAL_STATE: PensionInput = {
  personalData: {
    birthDate: DEFAULT_BIRTH_DATE,
    // La edad se conserva como metadato; las semanas futuras usan la fecha de retiro exacta.
    age: calculateAge(DEFAULT_BIRTH_DATE),
    estimatedRetirementDate: calculateRetirementDate(DEFAULT_BIRTH_DATE, 65),
    retirementAge: 65,
  },
  workHistory: {
    totalWeeks: 0,
    employmentRelations: [],
  },
  averageSalary: {
    dailySalary: 0,
    monthlySalary: 0,
    isManual: true,
  },
  uma: {
    dailyUMA: UMA_ACTUAL.dailyUMA,
    monthlyUMA: UMA_ACTUAL.monthlyUMA,
    annualUMA: UMA_ACTUAL.annualUMA,
    smgCdmx: UMA_ACTUAL.smgCdmx,
    smgFronteraNorte: UMA_ACTUAL.smgFronteraNorte,
    year: UMA_ACTUAL.year,
    isCustom: false,
  },
  modalidad10: {
    active: false,
    continuesWorkingWhileContributing: true,
    salaryZone: 'general',
    // La ocupación se precarga con la del catálogo oficial; la persona puede
    // cambiarla en el paso 4.
    occupationDivision: M10_DEFAULT_OCCUPATION.divisionCode,
    occupationGroup: M10_DEFAULT_OCCUPATION.groupCode,
    riskClass: M10_DEFAULT_OCCUPATION.riskClass,
  },
  beneficiaries: {
    hasSpouse: false,
    hasMinorChildren: false,
    numberOfMinorChildren: 0,
    hasDependentParents: false,
    numberOfDependentParents: 0,
  },
};

export function usePensionForm() {
  const [input, setInput] = useState<PensionInput>(INITIAL_STATE);
  const referenceDate = getLocalReferenceDate();

  const updatePersonalData = useCallback(
    (data: Partial<PersonalData>) => {
      const updateReferenceDate = getLocalReferenceDate();
      setInput((prev) => {
        const newData = { ...prev.personalData, ...data };
        // Recalcular edad automáticamente si cambia la fecha de nacimiento
        if (data.birthDate) {
          newData.age = calculateAge(data.birthDate, updateReferenceDate);
        }
        // Recalcular la fecha de retiro si cambia la fecha de nacimiento o la
        // edad de retiro (si no, la fecha queda desactualizada).
        if ((data.birthDate || data.retirementAge !== undefined) && newData.birthDate) {
          newData.estimatedRetirementDate = calculateRetirementDate(
            newData.birthDate,
            newData.retirementAge,
          );
        }
        // Los meses M10 se derivan de la fecha exacta de retiro y se
        // recalculan cuando cambie esa fecha.
        const modalidad10 = prev.modalidad10.active
          ? {
              ...prev.modalidad10,
              expectedMonths: expectedMonthsForHorizon(updateReferenceDate, newData),
            }
          : prev.modalidad10;
        return { ...prev, personalData: newData, modalidad10 };
      });
    },
    [],
  );

  const updateWorkHistory = useCallback((history: Partial<WorkHistory>) => {
    setInput((prev) => ({
      ...prev,
      workHistory: { ...prev.workHistory, ...history },
    }));
  }, []);

  const updateDailySalary = useCallback((dailySalary: number) => {
    setInput((prev) => ({
      ...prev,
      averageSalary: {
        ...prev.averageSalary,
        dailySalary,
        monthlySalary: dailyToMonthly(dailySalary),
        isManual: true,
      },
    }));
  }, []);

  const updateMonthlySalary = useCallback((monthlySalary: number) => {
    setInput((prev) => ({
      ...prev,
      averageSalary: {
        ...prev.averageSalary,
        dailySalary: monthlyToDaily(monthlySalary),
        monthlySalary,
        isManual: true,
      },
    }));
  }, []);

  /**
   * Cambia el año de la UMA.
   *
   * El SBC declarado en la Modalidad 10 se conserva (es lo que se va a pagar)
   * y su equivalente en UMAs se recalcula con la nueva UMA, acotado al rango
   * legal: el salario mínimo de la zona como piso y 25 UMA como techo.
   */
  const selectUMAByYear = useCallback((year: number) => {
    const record = getUMAByYear(year);
    if (!record) return;
    setInput((prev) => {
      const uma = {
        dailyUMA: record.dailyUMA,
        monthlyUMA: record.monthlyUMA,
        annualUMA: record.annualUMA,
        smgCdmx: record.smgCdmx,
        smgFronteraNorte: record.smgFronteraNorte,
        year: record.year,
        isCustom: false,
      };
      const modalidad10 = { ...prev.modalidad10 };
      if (modalidad10.contributionSalary != null) {
        const range = m10SalaryRange(uma.dailyUMA, uma.smgCdmx ?? 0);
        const salary = round2(
          Math.min(
            Math.max(modalidad10.contributionSalary, range.minimumDailySalary),
            range.maximumDailySalary,
          ),
        );
        modalidad10.contributionSalary = salary;
        modalidad10.contributionSalaryInUMAs = m10SalaryInUMAs(salary, uma.dailyUMA);
      }
      return { ...prev, uma, modalidad10 };
    });
  }, []);

  const setCustomUMA = useCallback((dailyUMA: number) => {
    const values = calculateUMAFromDailyValue(dailyUMA);
    setInput((prev) => {
      const uma = {
        ...values,
        smgCdmx: prev.uma.smgCdmx,
        smgFronteraNorte: prev.uma.smgFronteraNorte,
        year: new Date().getFullYear(),
        isCustom: true,
      };
      const modalidad10 = { ...prev.modalidad10 };
      if (modalidad10.contributionSalary != null) {
        const range = m10SalaryRange(uma.dailyUMA, uma.smgCdmx ?? 0);
        const salary = round2(
          Math.min(
            Math.max(modalidad10.contributionSalary, range.minimumDailySalary),
            range.maximumDailySalary,
          ),
        );
        modalidad10.contributionSalary = salary;
        modalidad10.contributionSalaryInUMAs = m10SalaryInUMAs(salary, uma.dailyUMA);
      }
      return { ...prev, uma, modalidad10 };
    });
  }, []);

  /**
   * Actualiza los campos generales de la Modalidad 10 (activación, incremento
   * anual esperado, si sigue trabajando).
   *
   * El SBC declarado y su equivalente en UMAs NO se tocan aquí: se escriben
   * únicamente por `setModalidad10ContributionSalary` y `setModalidad10UMAs`,
   * que los mantienen sincronizados.
   */
  const updateModalidad10 = useCallback((m10: Partial<Modalidad10>) => {
    const referenceDate = getLocalReferenceDate();
    setInput((prev) => {
      const modalidad10 = { ...prev.modalidad10, ...m10 };
      // Al activar la Modalidad 10 se precarga el máximo legal de UMAs.
      if (modalidad10.active && modalidad10.contributionSalary == null) {
        modalidad10.contributionSalary = m10SalaryFromUMAs(
          MODALIDAD_10_CAP_TIMES_UMA,
          prev.uma.dailyUMA,
        );
        modalidad10.contributionSalaryInUMAs = MODALIDAD_10_CAP_TIMES_UMA;
      }
      // Los meses contractuales se derivan de la fecha exacta de retiro y se
      // borran si la Modalidad 10 se desactiva.
      modalidad10.expectedMonths = modalidad10.active
        ? expectedMonthsForHorizon(referenceDate, prev.personalData)
        : undefined;
      return { ...prev, modalidad10 };
    });
  }, []);

  /**
   * Fija el SBC diario declarado en la Modalidad 10 y recalcula su equivalente
   * en UMAs.
   *
   * El valor se guarda tal como lo captura la persona (para no interrumpir la
   * escritura); el rango legal del Art. 28 LSS vigente —salario mínimo de la
   * zona como piso y 25 UMA como techo— lo acotan el control de UMAs y el
   * esquema de validación.
   */
  const setModalidad10ContributionSalary = useCallback((dailySalary: number) => {
    setInput((prev) => {
      const salary = round2(dailySalary);
      return {
        ...prev,
        modalidad10: {
          ...prev.modalidad10,
          contributionSalary: salary,
          contributionSalaryInUMAs: m10SalaryInUMAs(salary, prev.uma.dailyUMA),
        },
      };
    });
  }, []);

  /** Fija el número de UMAs y recalcula el SBC diario declarado. */
  const setModalidad10UMAs = useCallback((umas: number) => {
    setInput((prev) => {
      const salary = round2(m10SalaryFromUMAs(umas, prev.uma.dailyUMA));
      return {
        ...prev,
        modalidad10: {
          ...prev.modalidad10,
          contributionSalary: salary,
          contributionSalaryInUMAs: round2(umas),
        },
      };
    });
  }, []);

  /**
   * Proyección de semanas hasta la fecha exacta de retiro (ya cotizadas + proyectadas).
   * La calcula el formulario con la MISMA función que usa el motor, para que la
   * UI narre las mismas cifras sin recalcular nada (RNF-013).
   */
  const weeksProjection = useMemo(
    () =>
      calculateWeeksProjection({
        currentWeeks: input.workHistory.totalWeeks,
        age: input.personalData.age,
        retirementAge: input.personalData.retirementAge,
        referenceDate,
        retirementDate: input.personalData.estimatedRetirementDate,
        m10PlannedWeeks: input.modalidad10.active
          ? calculateM10PlannedWeeks(referenceDate, input.personalData.estimatedRetirementDate)
          : 0,
      }),
    [
      input.workHistory.totalWeeks,
      input.personalData.age,
      input.personalData.retirementAge,
      input.personalData.estimatedRetirementDate.getTime(),
      input.modalidad10.active,
      referenceDate.getTime(),
    ],
  );

  const updateBeneficiaries = useCallback((beneficiaries: Partial<Beneficiaries>) => {
    setInput((prev) => ({
      ...prev,
      beneficiaries: { ...prev.beneficiaries, ...beneficiaries },
    }));
  }, []);

  const resetForm = useCallback(() => {
    setInput(INITIAL_STATE);
  }, []);

  return {
    input,
    weeksProjection,
    updatePersonalData,
    updateWorkHistory,
    updateDailySalary,
    updateMonthlySalary,
    selectUMAByYear,
    setCustomUMA,
    updateModalidad10,
    setModalidad10ContributionSalary,
    setModalidad10UMAs,
    updateBeneficiaries,
    resetForm,
  };
}
