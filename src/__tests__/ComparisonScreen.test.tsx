/**
 * Pruebas de ComparisonScreen: estado vacío, tabla comparativa (fuente de
 * verdad) y degradación con gracia si la gráfica no monta.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories run before imports are available
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: { simulationId?: string } = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, popToTop: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));

let mockChartThrows = false;
let mockChartProps: {
  data?: { labels?: string[]; datasets?: { color?: unknown }[] };
  width?: number;
  fromZero?: boolean;
  formatYLabel?: (v: string) => string;
  bezier?: boolean;
  hidePointsAtIndex?: number[];
  chartConfig?: { color?: unknown; labelColor?: unknown };
} | null = null;
jest.mock('react-native-chart-kit', () => ({
  LineChart: (props: {
    data?: { labels?: string[]; datasets?: { color?: unknown }[] };
    width?: number;
    fromZero?: boolean;
    formatYLabel?: (v: string) => string;
    bezier?: boolean;
    hidePointsAtIndex?: number[];
    chartConfig?: { color?: unknown; labelColor?: unknown };
  }) => {
    if (mockChartThrows) throw new Error('SVG no disponible');
    mockChartProps = props;
    return null;
  },
}));

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderScreen } from '../test-utils/renderScreen';
import ComparisonScreen from '../screens/ComparisonScreen';
import { saveSimulation } from '../storage/simulationStorage';
import { calculatePension } from '../services/pension/PensionCalculator';
import { calculateComparison, getMaxHorizonYears } from '../services/pension/comparison/comparisonCalculator';
import { formatCurrency } from '../utils/format';
import type { PensionInput, PensionResult } from '../models';

function buildM10Result(): PensionResult {
  const input: PensionInput = {
    personalData: {
      name: 'María López',
      birthDate: new Date(1970, 0, 1),
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
      m10DailySalary: 1200,
      ordinaryDailySalary: 533.33,
    },
    uma: {
      dailyUMA: 113.14,
      monthlyUMA: 3439.46,
      annualUMA: 41296.1,
      year: 2025,
      isCustom: false,
    },
    modalidad10: {
      active: true,
      contributionSalary: 1200,
      contributionSalaryInUMAs: 10.61,
      continuesWorkingWhileContributing: false,
      expectedMonths: 120,
      riskClass: 3,
      salaryZone: 'general',
    },
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

beforeEach(async () => {
  jest.clearAllMocks();
  mockRouteParams = {};
  mockChartThrows = false;
  mockChartProps = null;
  await AsyncStorage.clear();
});

describe('ComparisonScreen', () => {
  test('muestra el estado vacío cuando no hay simulación', async () => {
    renderScreen(<ComparisonScreen />);

    await waitFor(() =>
      expect(screen.getByText('No hay resultado disponible para comparar.')).toBeTruthy(),
    );
  });

  test('muestra la tabla comparativa con las cifras clave', async () => {
    const saved = await saveSimulation(buildM10Result(), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());

    expect(screen.getByText('Costo total de la Modalidad 10')).toBeTruthy();
    expect(screen.getByText('Pensión no percibida (por contratar M10)')).toBeTruthy();
    expect(screen.getByText('Costo real de la Modalidad 10')).toBeTruthy();
    expect(screen.getByText('Pensión mensual (Con M10)')).toBeTruthy();
    expect(screen.getByText('Pensión mensual (Sin M10)')).toBeTruthy();
    // El resumen agrupa los campos en secciones diferenciadas.
    expect(screen.getByText('Costos de la Modalidad 10')).toBeTruthy();
    expect(screen.getByText('Pensión mensual')).toBeTruthy();
    expect(screen.getByText('¿En qué momento conviene?')).toBeTruthy();
    expect(screen.getByText('(el punto de equilibrio)')).toBeTruthy();
    expect(screen.getAllByText('Punto de equilibrio').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Flujo acumulado')).toBeTruthy();
    // La gráfica se configura con las dos curvas (M10 y pensionarse antes).
    expect(mockChartProps?.data?.datasets).toHaveLength(2);
    // Etiquetas del eje X solo en años enteros; los meses intermedios van vacíos.
    const labels = mockChartProps?.data?.labels ?? [];
    expect(labels[0]).toBe('0');
    expect(labels[12]).toBe('1');
    expect(labels[24]).toBe('2');
    expect(labels[1]).toBe('');
    // Puntos visibles solo en años: los meses intermedios están ocultos.
    const hide = mockChartProps?.hidePointsAtIndex ?? [];
    expect(hide).toContain(1);
    expect(hide).toContain(6);
    expect(hide).not.toContain(12);
    expect(hide).not.toContain(0);
    // Eje del costo anclado a 0 y con formato de moneda.
    expect(mockChartProps?.fromZero).toBe(true);
    expect(typeof mockChartProps?.formatYLabel).toBe('function');
    // Líneas rectas (sin bezier).
    expect(mockChartProps?.bezier).toBeFalsy();
    // Tema claro/oscuro sin hex hardcodeado: los colores se derivan del tema
    // (funciones de opacidad), no son literales hex.
    const datasets = mockChartProps?.data?.datasets ?? [];
    for (const ds of datasets) {
      expect(typeof ds.color).toBe('function');
    }
    expect(typeof mockChartProps?.chartConfig?.color).toBe('function');
    expect(typeof mockChartProps?.chartConfig?.labelColor).toBe('function');
    // El eje de tiempo indica su unidad (Años).
    expect(screen.getByText('Años')).toBeTruthy();
    // El punto de equilibrio se muestra como tiempo desde pensionarse «antes»
    // (callout sobre la gráfica y bloque del resumen), con la edad en línea aparte.
    expect(screen.getAllByText(/En \d+ años?( \d+ mes(es)?)? de que se hubiera pensionado lo antes posible\./).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/~\d+ años?( \d+ mes(es)?)? de edad \(\d{4}\)/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/en \d+\.\d+/)).toBeNull();
  });

  test('por defecto selecciona el punto de equilibrio y muestra la ventana hasta 3 años después', async () => {
    const result = buildM10Result();
    const saved = await saveSimulation(result, 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());

    // La tarjeta de detalle ya viene poblada con el punto de equilibrio.
    expect(screen.getByText('Ganancia neta por contratar M10')).toBeTruthy();
    // La línea vertical de selección ya está presente por defecto.
    expect(screen.getByTestId('chart-selection-line')).toBeTruthy();

    // La ventana por defecto arranca en el año 0 y muestra break-even + 3 años.
    const comparison = calculateComparison(result, getMaxHorizonYears(result));
    const breakEvenMonth = comparison.breakEven!.monthIndex;
    const expectedCount = breakEvenMonth + 3 * 12 + 1;
    const datasets = mockChartProps?.data?.datasets as { data: number[] }[];
    expect(datasets[0]!.data.length).toBe(expectedCount);
    expect(mockChartProps?.data?.labels?.[0]).toBe('0');
  });

  test('el zoom cambia la ventana visible sin mover los ejes', async () => {
    const saved = await saveSimulation(buildM10Result(), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());

    const datasets0 = mockChartProps?.data?.datasets as { data: number[] }[];
    const fullWidth = mockChartProps?.width ?? 0;
    const fullCount = datasets0[0]!.data.length;
    expect(fullWidth).toBeGreaterThan(0);
    expect(fullCount).toBeGreaterThan(12);

    // Acercar: el ancho (ejes) NO cambia, pero se grafican menos meses.
    fireEvent.press(screen.getByTestId('chart-zoom-in'));
    await waitFor(() =>
      expect((mockChartProps?.data?.datasets as { data: number[] }[])[0]!.data.length).toBeLessThan(fullCount),
    );
    const zoomedCount = (mockChartProps?.data?.datasets as { data: number[] }[])[0]!.data.length;
    expect(mockChartProps?.width).toBe(fullWidth);

    // Alejar: vuelve a crecer hacia el horizonte completo.
    fireEvent.press(screen.getByTestId('chart-zoom-out'));
    await waitFor(() =>
      expect((mockChartProps?.data?.datasets as { data: number[] }[])[0]!.data.length).toBeGreaterThan(zoomedCount),
    );
    expect(mockChartProps?.width).toBe(fullWidth);
  });

  test('permite desplazarse a la izquierda y derecha', async () => {
    const saved = await saveSimulation(buildM10Result(), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());

    const m10Data = () => (mockChartProps?.data?.datasets as { data: number[] }[])[0]!.data;
    const before = m10Data()[0]!;

    // Desplazar a la derecha: la ventana arranca en un mes posterior.
    fireEvent.press(screen.getByTestId('chart-pan-right'));
    await waitFor(() => expect(m10Data()[0]).not.toBe(before));
    const afterRight = m10Data()[0]!;

    // Desplazar a la izquierda: vuelve al inicio.
    fireEvent.press(screen.getByTestId('chart-pan-left'));
    await waitFor(() => expect(m10Data()[0]).toBe(before));
    expect(afterRight).not.toBe(before);
  });

  test('al tocar un punto muestra su costo y año', async () => {
    const saved = await saveSimulation(buildM10Result(), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());
    expect(screen.getByText('Toca un punto en la gráfica para ver el detalle de ese mes.')).toBeTruthy();

    // El overlay se alinea a los puntos graficados (ahora mensuales): en el
    // mes 72 (año 6) la curva «pensionarse antes» ya percibe pensión (retiro
    // a los 60), así que su acumulado debe ser > 0 y coincidir con lo dibujado.
    const datasets = mockChartProps?.data?.datasets as { data: number[] }[];
    const m10Value = datasets[0]!.data[72]!;
    const earlyValue = datasets[1]!.data[72]!;
    expect(earlyValue).toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('Ver detalle del mes 72'));

    await waitFor(() => expect(screen.getByText('En 6 años')).toBeTruthy());
    // Al seleccionar una columna queda una línea vertical que marca el momento.
    expect(screen.getByTestId('chart-selection-line')).toBeTruthy();
    // Los montos se muestran alineados a la derecha, con etiquetas claras.
    expect(screen.getByText('Al contratar Modalidad 10')).toBeTruthy();
    expect(screen.getByText('Al pensionarte lo antes posible')).toBeTruthy();
    expect(screen.getByText('Ganancia neta por contratar M10')).toBeTruthy();
    expect(screen.getByText(formatCurrency(m10Value))).toBeTruthy();
    expect(screen.getByText(formatCurrency(earlyValue))).toBeTruthy();
    expect(screen.getByText(formatCurrency(m10Value - earlyValue))).toBeTruthy();

    // Mes intermedio: el título muestra años enteros seguidos de meses.
    fireEvent.press(screen.getByLabelText('Ver detalle del mes 73'));
    await waitFor(() => expect(screen.getByText('En 6 años 1 mes')).toBeTruthy());
  });

  test('degrada con gracia si la gráfica no monta y conserva la tabla', async () => {
    mockChartThrows = true;
    const saved = await saveSimulation(buildM10Result(), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ComparisonScreen />);

    await waitFor(() => expect(screen.getByText('Resumen de la comparativa')).toBeTruthy());

    expect(screen.getByText(/La gráfica no está disponible/)).toBeTruthy();
    expect(screen.getByText('Costo total de la Modalidad 10')).toBeTruthy();
    expect(screen.getAllByText('Punto de equilibrio').length).toBeGreaterThanOrEqual(1);
  });
});
