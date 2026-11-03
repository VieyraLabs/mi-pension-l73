/**
 * Prueba de humo de ResultScreen: sin simulación coincidente muestra el
 * estado vacío; con una simulación guardada muestra el resultado.
 *
 * Para ejecutar: npm test
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories run before imports are available
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPopToTop = jest.fn();
let mockRouteParams: { simulationId?: string } = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, popToTop: mockPopToTop }),
  useRoute: () => ({ params: mockRouteParams }),
}));

import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderScreen } from '../test-utils/renderScreen';
import ResultScreen from '../screens/ResultScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { saveSimulation } from '../storage/simulationStorage';
import { calculatePension } from '../services/pension/PensionCalculator';
import { formatCurrency, formatDateLong } from '../utils/format';
import type { PensionInput } from '../models';

function buildResult(
  overrides: Partial<PensionInput['personalData']> = {},
  options: {
    totalWeeks?: number;
    dailySalary?: number;
    modalidad10?: PensionInput['modalidad10'];
    projectedAverageDailySalary?: number;
    projectedAverageBreakdown?: PensionInput['projectedAverageBreakdown'];
  } = {},
) {
  const input: PensionInput = {
    personalData: {
      name: 'María López',
      birthDate: new Date(1960, 0, 1),
      age: 65,
      estimatedRetirementDate: new Date(2025, 0, 1),
      retirementAge: 65,
      ...overrides,
    },
    workHistory: { totalWeeks: options.totalWeeks ?? 600, employmentRelations: [] },
    averageSalary: {
      dailySalary: options.dailySalary ?? 250,
      monthlySalary: (options.dailySalary ?? 250) * 30.4,
      isManual: true,
    },
    uma: { dailyUMA: 113.14, monthlyUMA: 3439.46, annualUMA: 41296.1, year: 2025, isCustom: false },
    modalidad10: options.modalidad10 ?? { active: false },
    projectedAverageDailySalary: options.projectedAverageDailySalary,
    projectedAverageBreakdown: options.projectedAverageBreakdown,
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

function buildResultAtReferenceDate(
  referenceDate: Date,
  overrides: Partial<PensionInput['personalData']> = {},
  options: {
    totalWeeks?: number;
    dailySalary?: number;
    modalidad10?: PensionInput['modalidad10'];
    projectedAverageDailySalary?: number;
    projectedAverageBreakdown?: PensionInput['projectedAverageBreakdown'];
  } = {},
) {
  jest.useFakeTimers().setSystemTime(referenceDate);
  try {
    return buildResult(overrides, options);
  } finally {
    jest.useRealTimers();
  }
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockRouteParams = {};
  await AsyncStorage.clear();
});

describe('ResultScreen', () => {
  test('muestra el estado vacío cuando no hay ninguna simulación guardada', async () => {
    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('No hay resultado disponible.')).toBeTruthy());
  });

  test('muestra el resultado de la simulación indicada por simulationId', async () => {
    const saved = await saveSimulation(buildResult(), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());
    expect(screen.getByText('Pensión mensual estimada')).toBeTruthy();
  });

  test('muestra por separado el SBC actual y el SBC proyectado al retiro', async () => {
    const result = buildResult();
    result.input.projectedAverageDailySalary = 300;
    const saved = await saveSimulation(result, 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());
    expect(screen.getByText('SBC actual (diario)')).toBeTruthy();
    expect(screen.getByText('SBC proyectado al retiro (diario)')).toBeTruthy();
    expect(screen.getByText(formatCurrency(250))).toBeTruthy();
    expect(screen.getByText(formatCurrency(300))).toBeTruthy();
  });

  test('el resumen separa las semanas cotizadas actuales de las objetivo al jubilarse', async () => {
    const saved = await saveSimulation(
      buildResultAtReferenceDate(new Date(2025, 5, 1), {
        age: 45,
        estimatedRetirementDate: new Date(2045, 5, 1),
      }),
      'María López',
    );
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    expect(screen.getByText('Semanas cotizadas actuales')).toBeTruthy();
    expect(screen.getAllByText('600 sem.').length).toBeGreaterThan(0);

    expect(screen.getByText('Semanas estimadas al pensionarte')).toBeTruthy();
    expect(screen.queryByText('Semanas cotizadas registradas')).toBeNull();
    // La proyección usa los días calendario entre ambas fechas exactas.
    expect(screen.getByText('Fecha de retiro')).toBeTruthy();
    expect(screen.getByText(formatDateLong(new Date(2045, 5, 1)))).toBeTruthy();
    expect(
      screen.getByText('1,644 sem. (600 cotizadas + 1,044 proyectadas hasta la fecha de retiro)'),
    ).toBeTruthy();
  });

  test('todas las cifras de semanas del resumen usan el separador de miles', async () => {
    const saved = await saveSimulation(
      buildResultAtReferenceDate(new Date(2025, 5, 1), {
        age: 45,
        estimatedRetirementDate: new Date(2045, 5, 1),
      }),
      'María López',
    );
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    // El objetivo se muestra con separador de miles en todas sus cifras.
    expect(
      screen.getByText('1,644 sem. (600 cotizadas + 1,044 proyectadas hasta la fecha de retiro)'),
    ).toBeTruthy();
    expect(
      screen.queryByText('1644 sem. (600 cotizadas + 1044 proyectadas hasta la fecha de retiro)'),
    ).toBeNull();
  });

  test('el resumen de Modalidad 10 muestra el SBC declarado, sus UMAs y el costo mensual', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 5, 1));
    let resultado: ReturnType<typeof buildResult>;
    try {
      resultado = buildResult(
        { age: 30, retirementAge: 65, estimatedRetirementDate: new Date(2025, 6, 1) },
        {
          totalWeeks: 600,
          modalidad10: {
            active: true,
            contributionSalary: 300,
            contributionSalaryInUMAs: 2.65,
            expectedMonths: 2,
            continuesWorkingWhileContributing: true,
          },
        },
      );
    } finally {
      jest.useRealTimers();
    }
    const saved = await saveSimulation(resultado!, 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);
    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    expect(screen.getAllByText('Modalidad 10').length).toBeGreaterThan(0);
    expect(screen.getByText('Salario base declarado')).toBeTruthy();
    expect(screen.getByText(`${formatCurrency(300)}/día`)).toBeTruthy();
    expect(screen.getByText('Equivalente en UMAs')).toBeTruthy();
    expect(screen.getByText('2.65 UMA')).toBeTruthy();
    expect(screen.getByText('Meses que planeas cotizar')).toBeTruthy();
    expect(screen.getByText('2 meses')).toBeTruthy();
    expect(screen.getByText('Costo mensual (sin INFONAVIT)')).toBeTruthy();
    expect(screen.getByText('¿Sigues trabajando mientras citas?')).toBeTruthy();
  });

  test('el desglose del SBC proyectado reparte las semanas entre ordinarias y M10', async () => {
    const resultado = buildResultAtReferenceDate(
      new Date(2025, 5, 1),
      {
        age: 30,
        retirementAge: 65,
        estimatedRetirementDate: new Date(2026, 0, 31),
      },
      {
        totalWeeks: 500,
        dailySalary: 200,
        modalidad10: { active: true, contributionSalary: 300, expectedMonths: 7 },
        projectedAverageDailySalary: 212.4,
        projectedAverageBreakdown: {
          totalWeeks: 250,
          m10Weeks: 31,
          ordinaryWeeks: 219,
          m10DailySalary: 300,
          ordinaryDailySalary: 200,
        },
      },
    );
    const averageStep = resultado.steps.find((step) => step.id === 'salario_promedio');

    expect(resultado.weeksProjection).not.toHaveProperty('m10PlannedWeeks');
    expect(averageStep?.description).toContain(
      '219 sem. ordinarias ($200.00/día) + 31 sem. M10 ($300.00/día) = $212.40/día',
    );

    const saved = await saveSimulation(resultado, 'María López');
    mockRouteParams = { simulationId: saved.id };
    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());
    expect(screen.getByText('Semanas de Modalidad 10 (de las 250)')).toBeTruthy();
    expect(screen.getByText('31 sem.')).toBeTruthy();
    expect(screen.getByText('Semanas ordinarias (de las 250)')).toBeTruthy();
    expect(screen.getByText('219 sem.')).toBeTruthy();
    expect(screen.getByText('Salario promedio de las 250 semanas')).toBeTruthy();
    expect(screen.getByText(`${formatCurrency(212.4)}/día`)).toBeTruthy();
  });

  test('el resultado histórico sin desglose conserva el SBC declarado de M10', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 5, 1));
    let resultado: ReturnType<typeof buildResult>;
    try {
      resultado = buildResult(
        { age: 30, retirementAge: 65, estimatedRetirementDate: new Date(2025, 6, 1) },
        {
          totalWeeks: 600,
          modalidad10: { active: true, contributionSalary: 300, expectedMonths: 2 },
        },
      );
    } finally {
      jest.useRealTimers();
    }
    delete resultado!.weeksProjection;
    const saved = await saveSimulation(resultado!, 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);
    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    expect(screen.getAllByText('600 sem.').length).toBeGreaterThan(0);
    expect(screen.getByText('Semanas cotizadas registradas')).toBeTruthy();
    expect(screen.queryByText('Semanas estimadas al pensionarte')).toBeNull();
    // Sin desglose no se inventa un reparto de semanas: se muestra lo que hay.
    expect(screen.queryByText('Semanas de Modalidad 10 (de las 250)')).toBeNull();
    expect(screen.getByText('Salario base declarado')).toBeTruthy();
  });

  test('el bloque de Modalidad 10 no se confunde con el objetivo de semanas', async () => {
    const saved = await saveSimulation(
      buildResultAtReferenceDate(
        new Date(2025, 5, 1),
        {
          age: 30,
          retirementAge: 100,
          estimatedRetirementDate: new Date(2075, 5, 15),
        },
        {
          totalWeeks: 500,
          modalidad10: { active: true, contributionSalary: 300, expectedMonths: 600 },
        },
      ),
      'María López',
    );
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    // El objetivo normal es 500 cotizadas + 2611 proyectadas = 3111.
    expect(
      screen.getByText('3,111 sem. (500 cotizadas + 2,611 proyectadas hasta la fecha de retiro)'),
    ).toBeTruthy();
    // El bloque Modalidad 10 ya no se titula como el total de semanas cotizadas…
    expect(screen.queryByText('Total de semanas cotizadas')).toBeNull();
    expect(screen.getByText('Meses que planeas cotizar')).toBeTruthy();
    expect(screen.getByText('600 meses')).toBeTruthy();
  });

  test('sin horizonte a futuro, las semanas objetivo coinciden con las actuales', async () => {
    // Edad actual = edad de retiro: no hay proyección, solo lo cotizado.
    const saved = await saveSimulation(buildResult({ age: 65 }), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    expect(screen.getByText('Semanas cotizadas actuales')).toBeTruthy();
    expect(screen.getByText('Semanas estimadas al pensionarte')).toBeTruthy();
    // Ambas filas muestran las mismas semanas (ya cotizadas, nada proyectado).
    expect(screen.getAllByText('600 sem.').length).toBe(2);
  });

  test('una simulación guardada sin proyección cae a las semanas cotizadas capturadas', async () => {
    // Simulación de una versión anterior de la app: no trae `weeksProjection`.
    const resultado = buildResult({ age: 45 });
    delete resultado.weeksProjection;
    const saved = await saveSimulation(resultado, 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    expect(screen.getByText('Semanas cotizadas actuales')).toBeTruthy();
    expect(screen.getByText('Semanas cotizadas registradas')).toBeTruthy();
    expect(screen.queryByText('Semanas estimadas al pensionarte')).toBeNull();
    // Sin proyección, ambas filas muestran las semanas cotizadas capturadas.
    expect(screen.getAllByText('600 sem.').length).toBe(2);
  });

  test('el historial muestra el objetivo de semanas con el mismo desglose que el resumen', async () => {
    await saveSimulation(
      buildResultAtReferenceDate(new Date(2025, 5, 1), {
        age: 45,
        estimatedRetirementDate: new Date(2045, 5, 1),
      }),
      'María López',
    );

    renderScreen(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());
    expect(screen.getByText('Semanas estimadas al pensionarte')).toBeTruthy();
    expect(screen.queryByText('Semanas cotizadas registradas')).toBeNull();
    expect(
      screen.getByText('1,644 sem. (600 cotizadas + 1,044 proyectadas hasta la fecha de retiro)'),
    ).toBeTruthy();
  });

  test('el historial de una simulación sin proyección muestra solo las semanas actuales', async () => {
    const resultado = buildResult({ age: 45 });
    delete resultado.weeksProjection;
    await saveSimulation(resultado, 'María López');

    renderScreen(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());
    expect(screen.getByText('Semanas cotizadas registradas')).toBeTruthy();
    expect(screen.queryByText('Semanas estimadas al pensionarte')).toBeNull();
    expect(screen.getAllByText('600 sem.').length).toBeGreaterThan(0);
  });

  test('el botón «Comparar» reemplaza a «Nueva simulación» y navega a la comparativa', async () => {
    const saved = await saveSimulation(buildResult(), 'María López');
    mockRouteParams = { simulationId: saved.id };

    renderScreen(<ResultScreen />);

    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());

    expect(screen.getByText('Comparar')).toBeTruthy();
    expect(screen.queryByText('Nueva simulación')).toBeNull();

    fireEvent.press(screen.getByText('Comparar'));
    expect(mockNavigate).toHaveBeenCalledWith('Comparison', { simulationId: saved.id });
  });
});
