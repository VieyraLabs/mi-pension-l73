/**
 * Tabla histórica de UMA (Unidad de Medida y Actualización) y SMG (Salario Mínimo General).
 * Fuente: INEGI (UMA), CONASAMI (SMG), publicados en DOF.
 * Cada registro lleva su campo `source` con la publicación DOF de origen y año de vigencia.
 * Los valores marcados como esEstimacion:true son proyecciones y deben verificarse.
 *
 * NOTA LEGAL: Los valores de UMA y SMG son utilizados únicamente como referencia
 * para los cálculos. La resolución oficial corresponde al IMSS.
 */
import type { UMARecord, SalaryZone } from '../models';
import { DAYS_PER_YEAR_UMA, AVERAGE_DAYS_PER_MONTH } from './ley73';

/**
 * Tabla histórica UMA/SMG 2017–2026.
 * Provenancia por registro: campo `source` de cada entrada.
 * - UMA: publicación anual de INEGI en DOF (a más tardar el 10 de enero),
 *   vigente desde el 1 de enero del año correspondiente (Ley para Determinar
 *   el Valor de la UMA, DOF 27-ene-2016).
 * - SMG (ZSMG/CDMX): resolución anual de CONASAMI, vigente desde el 1 de enero.
 */

export const TABLA_UMA_SMG: readonly UMARecord[] = [
  {
    year: 2017,
    dailyUMA: 75.49,
    monthlyUMA: 2294.9,
    annualUMA: 27553.85,
    smgCdmx: 80.04,
    isEstimate: false,
    source: 'DOF 10-ene-2017 (INEGI), DOF 01-dic-2016 (CONASAMI)',
  },
  {
    year: 2018,
    dailyUMA: 80.6,
    monthlyUMA: 2450.24,
    annualUMA: 29419.0,
    smgCdmx: 88.36,
    isEstimate: false,
    source: 'DOF 10-ene-2018 (INEGI), DOF 19-dic-2017 (CONASAMI)',
  },
  {
    year: 2019,
    dailyUMA: 84.49,
    monthlyUMA: 2568.5,
    annualUMA: 30838.85,
    smgCdmx: 102.68,
    isEstimate: false,
    source: 'DOF 10-ene-2019 (INEGI), DOF 28-dic-2018 (CONASAMI)',
  },
  {
    year: 2020,
    dailyUMA: 86.88,
    monthlyUMA: 2641.15,
    annualUMA: 31711.2,
    smgCdmx: 123.22,
    isEstimate: false,
    source: 'DOF 10-ene-2020 (INEGI), DOF 01-ene-2020 (CONASAMI)',
  },
  {
    year: 2021,
    dailyUMA: 89.62,
    monthlyUMA: 2724.45,
    annualUMA: 32711.3,
    smgCdmx: 141.7,
    isEstimate: false,
    source: 'DOF 11-ene-2021 (INEGI), DOF 01-ene-2021 (CONASAMI)',
  },
  {
    year: 2022,
    dailyUMA: 96.22,
    monthlyUMA: 2925.09,
    annualUMA: 35120.3,
    smgCdmx: 172.87,
    isEstimate: false,
    source: 'DOF 10-ene-2022 (INEGI), DOF 01-ene-2022 (CONASAMI)',
  },
  {
    year: 2023,
    dailyUMA: 103.74,
    monthlyUMA: 3153.7,
    annualUMA: 37865.1,
    smgCdmx: 207.44,
    isEstimate: false,
    source: 'DOF 10-ene-2023 (INEGI), DOF 01-ene-2023 (CONASAMI)',
  },
  {
    year: 2024,
    dailyUMA: 108.57,
    monthlyUMA: 3300.53,
    annualUMA: 39628.05,
    smgCdmx: 248.93,
    isEstimate: false,
    source: 'DOF 10-ene-2024 (INEGI), DOF 01-ene-2024 (CONASAMI)',
  },
  {
    year: 2025,
    dailyUMA: 113.14,
    monthlyUMA: 3439.46,
    annualUMA: 41296.1,
    smgCdmx: 278.8,
    isEstimate: false,
    source: 'DOF 10-ene-2025 (INEGI), DOF 01-ene-2025 (CONASAMI)',
  },
  {
    year: 2026,
    dailyUMA: 117.31,
    monthlyUMA: 3566.22,
    annualUMA: 42818.15,
    smgCdmx: 315.04,
    // SMG de la Zona Libre de la Frontera Norte 2026.
    smgFronteraNorte: 440.87,
    isEstimate: false,
    source:
      'DOF 09-ene-2026 (INEGI) — valor diario corroborado en valoruma.com. ' +
      'SMG ZSMG 2026 oficial CONASAMI, Tabla de Salarios Mínimos 2026 (PDF gob.mx). ' +
      'SMG Frontera Norte 2026: calculadora oficial del IMSS para Personas Trabajadoras ' +
      'Independientes (calculadoraPTI-0326.js, marzo 2026); confirmar contra la tabla ' +
      'de CONASAMI.',
  },
] as const;

/**
 * UMA vigente por defecto — último registro de TABLA_UMA_SMG. Fuente y vigencia
 * heredadas del campo `source` de ese registro.
 */
export const UMA_ACTUAL: UMARecord = TABLA_UMA_SMG[TABLA_UMA_SMG.length - 1]!;

/** Obtiene el registro UMA/SMG para un año específico. */
export function getUMAByYear(anio: number): UMARecord | undefined {
  return TABLA_UMA_SMG.find((r) => r.year === anio);
}

/** Obtiene el registro UMA/SMG más reciente disponible. */
export function getMostRecentUMA(): UMARecord {
  return TABLA_UMA_SMG[TABLA_UMA_SMG.length - 1]!;
}

/**
 * Salario mínimo de la zona geográfica seleccionada, que la Modalidad 10 usa
 * como piso del SBC declarado (Art. 28 LSS vigente: "el salario mínimo general
 * del área geográfica respectiva").
 *
 * - `general` (resto del país): usa el SMG general (históricamente el de la
 *   Zona A / CDMX que ya registra la tabla).
 * - `frontera_norte`: usa el SMG de la Zona Libre de la Frontera Norte cuando
 *   el registro lo trae; si no, cae al SMG general.
 *
 * Si la configuración no trae el SMG —simulaciones guardadas por versiones
 * anteriores de la app— se usa el del registro UMA vigente.
 */
export function getMinimumDailySalary(
  uma: { smgCdmx?: number; smgFronteraNorte?: number },
  zone: SalaryZone = 'general',
): number {
  if (zone === 'frontera_norte' && uma.smgFronteraNorte != null) {
    return uma.smgFronteraNorte;
  }
  return uma.smgCdmx ?? UMA_ACTUAL.smgCdmx;
}

/**
 * Calcula los valores de UMA mensual y anual a partir del valor diario.
 * Fuente: Ley para Determinar el Valor de la UMA, Art. 9 (DOF 27-ene-2016):
 * - Mensual = Diario × 30.4
 * - Anual = Diario × 365
 */
export function calculateUMAFromDailyValue(dailyUMA: number): {
  dailyUMA: number;
  monthlyUMA: number;
  annualUMA: number;
} {
  return {
    dailyUMA,
    monthlyUMA: parseFloat((dailyUMA * AVERAGE_DAYS_PER_MONTH).toFixed(2)),
    annualUMA: parseFloat((dailyUMA * DAYS_PER_YEAR_UMA).toFixed(2)),
  };
}
