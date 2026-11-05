/**
 * Pantalla de comparación multi-simulación (SCN-006 / SCN-007).
 *
 * La tabla es la fuente de verdad: filas = métricas, columnas = simulaciones,
 * con la base «pensionarse lo antes posible» como referencia común y un punto
 * de equilibrio por columna.
 *
 * Para ejecutar: npm test
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories run before imports are available
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: { simulationIds: string[] } = { simulationIds: [] };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

let mockChartProps: {
  data?: { labels?: string[]; datasets?: { data?: number[]; color?: unknown }[] };
  width?: number;
  fromZero?: boolean;
  formatYLabel?: (v: string) => string;
  hidePointsAtIndex?: number[];
} | null = null;
jest.mock('react-native-chart-kit', () => ({
  LineChart: (props: {
    data?: { labels?: string[]; datasets?: { data?: number[]; color?: unknown }[] };
    width?: number;
    fromZero?: boolean;
    formatYLabel?: (v: string) => string;
    hidePointsAtIndex?: number[];
  }) => {
    mockChartProps = props;
    return null;
  },
}));

import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderScreen } from '../test-utils/renderScreen';
import MultiComparisonScreen from '../screens/MultiComparisonScreen';
import { saveSimulation } from '../storage/simulationStorage';
import { calculatePension } from '../services/pension/PensionCalculator';
import {
  calculateMultiComparison,
  getMultiComparisonHorizonYears,
} from '../services/pension/comparison/comparisonCalculator';
import { formatCurrency, formatInteger } from '../utils/format';
import type { PensionInput, PensionResult, SavedSimulation } from '../models';

/** Resultado de una persona de 55 años con la Modalidad 10 en un SBC dado. */
function buildResult(params: {
  name: string;
  birthDate: Date;
  contributionSalary: number;
  /** false = simulación SIN Modalidad 10 (active: false, sin UMA). */
  withM10?: boolean;
}): PensionResult {
  const withM10 = params.withM10 ?? true;
  const input: PensionInput = {
    personalData: {
      name: params.name,
      birthDate: params.birthDate,
      age: 55,
      estimatedRetirementDate: new Date(2035, 0, 1),
      retirementAge: 65,
    },
    workHistory: { totalWeeks: 1500, employmentRelations: [] },
    averageSalary: { dailySalary: 500, monthlySalary: 15200, isManual: false },
    projectedAverageDailySalary: 800,
    projectedAverageBreakdown: {
      totalWeeks: 250,
      m10Weeks: 100,
      ordinaryWeeks: 150,
      m10DailySalary: params.contributionSalary,
      ordinaryDailySalary: 533.33,
    },
    uma: {
      dailyUMA: 113.14,
      monthlyUMA: 3439.46,
      annualUMA: 41296.1,
      year: 2025,
      isCustom: false,
    },
    modalidad10: withM10
      ? {
          active: true,
          contributionSalary: params.contributionSalary,
          contributionSalaryInUMAs: Number((params.contributionSalary / 113.14).toFixed(2)),
          continuesWorkingWhileContributing: false,
          expectedMonths: 120,
          riskClass: 3,
          salaryZone: 'general',
        }
      : { active: false },
    beneficiaries: {
      hasSpouse: false,
      hasMinorChildren: false,
      numberOfMinorChildren: 0,
      hasDependentParents: false,
      numberOfDependentParents: 0,
    },
  };
  return calculatePension(input);
}

const BIRTH = new Date(1970, 0, 1);

async function seedTwoScenarios(): Promise<{ a: SavedSimulation; b: SavedSimulation }> {
  const a = await saveSimulation(
    buildResult({ name: 'María López', birthDate: BIRTH, contributionSalary: 900 }),
    'María · escenario A',
  );
  const b = await saveSimulation(
    buildResult({ name: 'María López', birthDate: BIRTH, contributionSalary: 1600 }),
    'María · escenario B',
  );
  return { a, b };
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockRouteParams = { simulationIds: [] };
  mockChartProps = null;
  await AsyncStorage.clear();
});

describe('MultiComparisonScreen', () => {
  test('renderiza la tabla con filas métricas y columnas por simulación (SCN-006)', async () => {
    const { a, b } = await seedTwoScenarios();
    mockRouteParams = { simulationIds: [a.id, b.id] };

    renderScreen(<MultiComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());

    // La base se identifica como referencia común de todas las columnas (DEC-014).
    expect(screen.getByText('Referencia común de todas las columnas')).toBeTruthy();
    expect(screen.getByTestId('multi-base-label')).toHaveTextContent(
      'Pensionarse lo antes posible',
    );

    // Orden de columnas: de MAYOR a MENOR UMA (b=14.14 antes que a=7.95),
    // aunque se pasaron en orden [a.id, b.id].
    const headerCells = screen.getAllByTestId(/^multi-header-/);
    expect(headerCells).toHaveLength(2);
    expect(headerCells[0]!.props.testID).toBe(`multi-header-${b.id}`);
    expect(headerCells[1]!.props.testID).toBe(`multi-header-${a.id}`);

    // Columnas = simulaciones seleccionadas (en la tabla y en el drill-down).
    expect(screen.getAllByText('M10 con 7.95 UMAs (120 meses)').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('M10 con 14.14 UMAs (120 meses)').length).toBeGreaterThanOrEqual(2);

    // Filas = métricas clave (DEC-015). Algunas etiquetas también aparecen en
    // el detalle expandido de la simulación de mayor UMA, así que se acepta ≥1.
    for (const label of [
      'Pensión mensual (Con M10)',
      'Fecha de retiro',
      'Semanas al pensionarte',
      'SBC proyectado (diario)',
      'Costo total de la Modalidad 10',
      'Pensión no percibida (por contratar M10)',
      'Costo real de la Modalidad 10',
      'Punto de equilibrio',
      'Pensión mensual (Sin M10)',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }

    // Cada celda muestra el valor de SU simulación.
    const pensionA = within(screen.getByTestId(`multi-cell-pension-${a.id}`));
    expect(pensionA.getByText(formatCurrency(a.result.monthlyPension))).toBeTruthy();
    const pensionB = within(screen.getByTestId(`multi-cell-pension-${b.id}`));
    expect(pensionB.getByText(formatCurrency(b.result.monthlyPension))).toBeTruthy();

    // Semanas y SBC proyectado salen del resultado, sin recalcular en la UI.
    const weeksA = within(screen.getByTestId(`multi-cell-weeks-${a.id}`));
    expect(
      weeksA.getByText(
        `${formatInteger(a.result.weeksProjection?.targetWeeks ?? a.result.input.workHistory.totalWeeks)} sem.`,
      ),
    ).toBeTruthy();
    const sbcB = within(screen.getByTestId(`multi-cell-sbc-${b.id}`));
    expect(sbcB.getByText(formatCurrency(800))).toBeTruthy();

    // Cada columna tiene SU punto de equilibrio contra la base (o «No se alcanza»).
    for (const id of [a.id, b.id]) {
      const cell = within(screen.getByTestId(`multi-cell-breakeven-${id}`));
      expect(cell.getByText(/^(En \d+ años?( \d+ mes(es)?)?|No se alcanza)$/)).toBeTruthy();
    }
    // La fecha de nacimiento identifica la persona de la columna.
    expect(screen.getAllByText(/de enero de 1970$/).length).toBeGreaterThanOrEqual(2);

    // La base es COMÚN: ambas columnas muestran la misma pensión sin Modalidad 10.
    const horizon = getMultiComparisonHorizonYears([a.result, b.result]);
    const multi = calculateMultiComparison(
      [
        { simulationId: a.id, name: a.name, result: a.result },
        { simulationId: b.id, name: b.name, result: b.result },
      ],
      horizon,
    );
    expect(multi.entries[0]!.metrics.earlyMonthlyPension).toBe(
      multi.entries[1]!.metrics.earlyMonthlyPension,
    );
    const baseText = formatCurrency(multi.entries[0]!.metrics.earlyMonthlyPension);
    for (const id of [a.id, b.id]) {
      expect(
        within(screen.getByTestId(`multi-cell-base-${id}`)).getByText(baseText),
      ).toBeTruthy();
    }

    // El detalle queda como drill-down opcional (accordion), no como pestañas, y
    // replica el formato del «Resumen de la comparativa» individual.
    expect(screen.getByText('Detalle por simulación')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`multi-accordion-${a.id}`));
    await waitFor(() => expect(screen.getByText('Costos de la Modalidad 10')).toBeTruthy());
    expect(screen.getByText('¿En qué momento conviene?')).toBeTruthy();
    expect(screen.getAllByText('Costo real de la Modalidad 10').length).toBeGreaterThanOrEqual(1);
  });

  test('el detalle de la mayor UMA queda expandido por defecto y solo uno a la vez', async () => {
    const { a, b } = await seedTwoScenarios(); // b = 14.14 UMA (mayor), a = 7.95 UMA
    mockRouteParams = { simulationIds: [a.id, b.id] };

    renderScreen(<MultiComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Detalle por simulación')).toBeTruthy());

    // Por defecto está expandida la de MAYOR UMA (b) y ninguna otra.
    await waitFor(() => expect(screen.getByTestId(`multi-detail-${b.id}`)).toBeTruthy());
    expect(screen.queryByTestId(`multi-detail-${a.id}`)).toBeNull();

    // Al expandir a (menor UMA), b se contrae: sigue habiendo solo una abierta.
    fireEvent.press(screen.getByTestId(`multi-accordion-${a.id}`));
    await waitFor(() => expect(screen.getByTestId(`multi-detail-${a.id}`)).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId(`multi-detail-${b.id}`)).toBeNull());
  });

  test('muestra la gráfica con todas las series M10 más una única base (SCN-008)', async () => {
    const { a, b } = await seedTwoScenarios();
    mockRouteParams = { simulationIds: [a.id, b.id] };

    renderScreen(<MultiComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Flujo acumulado')).toBeTruthy());

    const datasets = (mockChartProps?.data?.datasets ?? []) as { data: number[]; color?: unknown }[];
    // 2 simulaciones con M10 + 1 única base «pensionarse lo antes posible».
    expect(datasets).toHaveLength(3);
    for (const ds of datasets) {
      expect(ds.data.length).toBeGreaterThan(0);
      expect(typeof ds.color).toBe('function');
    }
    expect(mockChartProps?.fromZero).toBe(true);
    expect(typeof mockChartProps?.formatYLabel).toBe('function');
    // La leyenda identifica la base común y las dos simulaciones.
    expect(screen.getAllByText('Pensionarse lo antes posible').length).toBeGreaterThanOrEqual(1);

    // Detalle al seleccionar una columna: mes 72 = año 6.
    fireEvent.press(screen.getByLabelText('Ver detalle del mes 72'));
    await waitFor(() => expect(screen.getByText('En 6 años')).toBeTruthy());
    expect(screen.getByText('Flujo acumulado a esa fecha (pensión − cuotas)')).toBeTruthy();
    // Una fila por serie (2 simulaciones + base) con su valor en ese mes.
    expect(screen.getAllByText('M10 con 7.95 UMAs (120 meses)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('M10 con 14.14 UMAs (120 meses)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('multi-chart-selection-line')).toBeTruthy();
  });

  test('degrada con gracia si alguna simulación ya no existe (SCN-007)', async () => {
    const { a } = await seedTwoScenarios();
    // Uno de los ids ya no está en el historial.
    mockRouteParams = { simulationIds: [a.id, 'sim_borrada'] };

    renderScreen(<MultiComparisonScreen />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'No encontramos las simulaciones seleccionadas. Puede que se hayan eliminado del historial.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('Resumen de la comparativa')).toBeNull();

    fireEvent.press(screen.getByText('Volver al historial'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('con una sola simulación disponible invita a elegir al menos dos', async () => {
    const { a } = await seedTwoScenarios();
    mockRouteParams = { simulationIds: [a.id] };

    renderScreen(<MultiComparisonScreen />);

    await waitFor(() =>
      expect(
        screen.getByText('Selecciona al menos dos simulaciones del historial para compararlas.'),
      ).toBeTruthy(),
    );
  });

  test('si sobran ids borrados pero quedan 2 simulaciones, compara y avisa', async () => {
    const { a, b } = await seedTwoScenarios();
    mockRouteParams = { simulationIds: [a.id, b.id, 'sim_borrada'] };

    renderScreen(<MultiComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());
    expect(
      screen.getByText('Algunas simulaciones seleccionadas ya no existen en el historial.'),
    ).toBeTruthy();
    expect(screen.getByTestId(`multi-cell-pension-${a.id}`)).toBeTruthy();
    expect(screen.getByTestId(`multi-cell-pension-${b.id}`)).toBeTruthy();
  });

  test('una simulación sin Modalidad 10 va después de la de M10 con menor UMA', async () => {
    const { a, b } = await seedTwoScenarios(); // a=7.95 UMA, b=14.14 UMA
    const sinM10 = await saveSimulation(
      buildResult({ name: 'María López', birthDate: BIRTH, contributionSalary: 900, withM10: false }),
      'María · sin M10',
    );
    // Se pasan en orden [sinM10, b, a] para forzar el reordenamiento.
    mockRouteParams = { simulationIds: [sinM10.id, b.id, a.id] };

    renderScreen(<MultiComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());

    const headerCells = screen.getAllByTestId(/^multi-header-/);
    expect(headerCells).toHaveLength(3);
    // 1º b (14.14 UMA), 2º a (7.95 UMA), 3º la sin M10.
    expect(headerCells[0]!.props.testID).toBe(`multi-header-${b.id}`);
    expect(headerCells[1]!.props.testID).toBe(`multi-header-${a.id}`);
    expect(headerCells[2]!.props.testID).toBe(`multi-header-${sinM10.id}`);
  });
});
