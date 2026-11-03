/**
 * Servicio de almacenamiento local para el historial de simulaciones.
 * Usa AsyncStorage para persistir las últimas 999 simulaciones.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Modalidad10, PensionInput, SavedSimulation } from '../models';
import { getMinimumDailySalary } from '../constants/uma';
import { getOccupationDivision, getOccupationGroup } from '../constants/ocupaciones';

const STORAGE_KEY = '@mi_pension_mx:simulaciones';

/** Límite de simulaciones conservadas en el historial local. */
export const MAX_SIMULATIONS = 999;

/** Genera un ID único para la simulación. */
function generateId(): string {
  return `sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Valida que una simulación leída de AsyncStorage tenga la forma actual.
 * Descarta silenciosamente registros de versiones anteriores de la app
 * (p. ej. guardados antes de renombrar `fechaCreacion` a `creationDate`),
 * que de otro modo producirían fechas/montos inválidos al mostrarse.
 */
function isValidSavedSimulation(value: unknown): value is SavedSimulation {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<SavedSimulation>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.creationDate === 'string' &&
    !isNaN(new Date(s.creationDate).getTime()) &&
    typeof s.result?.monthlyPension === 'number'
  );
}

/** Input guardado que puede venir de una versión anterior de la app. */
type LegacyPensionInput = Partial<PensionInput> & {
  modalidad40?: Partial<Modalidad10>;
};

/**
 * Normaliza una simulación guardada por una versión anterior de la app.
 *
 * La Modalidad 40 pasó a llamarse Modalidad 10, la configuración de UMA ahora
 * trae el salario mínimo de referencia (el piso del SBC declarado) y el
 * catálogo de ocupaciones pasó a ser el oficial del IMSS. Sin esta
 * normalización, los resultados ya guardados se mostrarían sin el bloque de
 * Modalidad 10, con un piso desconocido y sin la ocupación que determina la
 * prima de Riesgos de Trabajo.
 *
 * La normalización ocurre en memoria: no se reescribe lo que el usuario tiene
 * guardado (ADR-0013).
 */
function normalizeSavedSimulation(saved: SavedSimulation): SavedSimulation {
  const input = saved.result?.input as LegacyPensionInput | undefined;
  if (!input) return saved;

  const legacy = input.modalidad40;
  const occupationDivision = input.modalidad10?.occupationDivision;
  const occupationGroup = input.modalidad10?.occupationGroup;
  // La ocupación guardada puede venir del catálogo anterior (RACERF): si ya no
  // resuelve en el catálogo vigente se limpia la selección, pero se conserva
  // la clase de riesgo, que es la que determina el costo.
  const keepsDivision = getOccupationDivision(occupationDivision) != null;
  const keepsGroup = getOccupationGroup(occupationDivision, occupationGroup) != null;

  const modalidad10: Modalidad10 = {
    active: input.modalidad10?.active ?? legacy?.active ?? false,
    contributionSalary: input.modalidad10?.contributionSalary ?? legacy?.contributionSalary,
    contributionSalaryInUMAs: input.modalidad10?.contributionSalaryInUMAs,
    continuesWorkingWhileContributing:
      input.modalidad10?.continuesWorkingWhileContributing ??
      legacy?.continuesWorkingWhileContributing ??
      true,
    expectedMonths: input.modalidad10?.expectedMonths ?? legacy?.expectedMonths,
    annualSalaryIncrease:
      input.modalidad10?.annualSalaryIncrease ?? legacy?.annualSalaryIncrease,
    riskClass: input.modalidad10?.riskClass ?? legacy?.riskClass,
    occupationDivision: keepsDivision ? occupationDivision : undefined,
    occupationGroup: keepsGroup ? occupationGroup : undefined,
    salaryZone: input.modalidad10?.salaryZone ?? legacy?.salaryZone,
  };

  const normalizedInput = {
    ...input,
    modalidad10,
    uma: input.uma
      ? { ...input.uma, smgCdmx: getMinimumDailySalary(input.uma) }
      : input.uma,
  } as PensionInput & { modalidad40?: unknown };
  // La clave vieja no viaja al resultado: se lee como Modalidad 10.
  delete normalizedInput.modalidad40;

  return {
    ...saved,
    result: {
      ...saved.result,
      input: normalizedInput,
    },
  };
}

/** Obtiene todas las simulaciones guardadas. */
export async function getSimulations(): Promise<SavedSimulation[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const parsed = JSON.parse(json) as unknown[];
    const valid = parsed.filter(isValidSavedSimulation);

    if (valid.length !== parsed.length) {
      // Autolimpieza: persiste sin los registros incompatibles para no
      // volver a filtrarlos en cada lectura.
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    return valid.map(normalizeSavedSimulation);
  } catch {
    return [];
  }
}

/** Guarda una nueva simulación. Elimina la más antigua si se superan las 999. */
export async function saveSimulation(
  result: SavedSimulation['result'],
  name?: string,
): Promise<SavedSimulation> {
  const simulations = await getSimulations();

  const newSimulation: SavedSimulation = {
    id: generateId(),
    name: name ?? `Simulación ${new Date().toLocaleDateString('es-MX')}`,
    creationDate: new Date().toISOString(),
    result,
  };

  const updated = [newSimulation, ...simulations].slice(0, MAX_SIMULATIONS);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newSimulation;
}

/** Elimina una simulación por su ID. */
export async function deleteSimulation(id: string): Promise<void> {
  const simulations = await getSimulations();
  const filtered = simulations.filter((s) => s.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/** Elimina todas las simulaciones guardadas. */
export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
