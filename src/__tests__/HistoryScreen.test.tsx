/**
 * Regresión: el encabezado del historial debe mostrar el límite real del
 * almacenamiento (999) y no un número hardcodeado desactualizado (el antiguo
 * límite de 20). La UI consume MAX_SIMULATIONS de simulationStorage como
 * única fuente de verdad.
 *
 * Además cubre SCN-004: el modo de comparación bloquea y atenúa las
 * simulaciones de otra persona y solo confirma con 2+ seleccionadas.
 *
 * Para ejecutar: npm test
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories run before imports are available
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderScreen } from '../test-utils/renderScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { MAX_SIMULATIONS, saveSimulation } from '../storage/simulationStorage';
import { calculatePension } from '../services/pension/PensionCalculator';
import type { PensionInput, PensionResult, SavedSimulation } from '../models';
import { calculateM10MonthlyCost } from '../utils/modalidad10';
import { getMinimumDailySalary } from '../constants/uma';
import { formatCurrency, formatUMAs } from '../utils/format';

/** Resultado de una persona con Modalidad 10 activa (SBC declarado distinto). */
function buildResult(params: {
  name: string;
  birthDate: Date;
  contributionSalary: number;
  /** UMAs declaradas; el historial solo muestra el costo cuando existen. */
  contributionSalaryInUMAs?: number;
}): PensionResult {
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
    uma: {
      dailyUMA: 113.14,
      monthlyUMA: 3439.46,
      annualUMA: 41296.1,
      year: 2025,
      isCustom: false,
    },
    modalidad10: {
      active: true,
      contributionSalary: params.contributionSalary,
      contributionSalaryInUMAs: params.contributionSalaryInUMAs,
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

const MARIA_BIRTH = new Date(1968, 4, 3);
const JUANA_BIRTH = new Date(1972, 7, 12);

/** Tres simulaciones: dos de María López y una de otra persona (Juana Pérez). */
async function seedHistory(): Promise<{ mariaA: SavedSimulation; mariaB: SavedSimulation; juana: SavedSimulation }> {
  const mariaA = await saveSimulation(
    buildResult({ name: 'María López', birthDate: MARIA_BIRTH, contributionSalary: 900 }),
    'María · escenario A',
  );
  const mariaB = await saveSimulation(
    buildResult({ name: 'MARIA LOPEZ', birthDate: MARIA_BIRTH, contributionSalary: 1600 }),
    'María · escenario B',
  );
  const juana = await saveSimulation(
    buildResult({ name: 'Juana Pérez', birthDate: JUANA_BIRTH, contributionSalary: 1200 }),
    'Juana · escenario A',
  );
  return { mariaA, mariaB, juana };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('HistoryScreen', () => {
  test('el encabezado muestra el límite real del almacenamiento en vez del antiguo 20', async () => {
    renderScreen(<HistoryScreen />);

    expect(
      await screen.findByText(`Historial de simulaciones (0/${MAX_SIMULATIONS})`),
    ).toBeTruthy();
    expect(MAX_SIMULATIONS).toBe(999);
  });

  test('fuera del modo comparación se mantiene ver/eliminar y no hay marcas (SCN-004)', async () => {
    const { mariaA } = await seedHistory();
    renderScreen(<HistoryScreen />);

    await screen.findByText(`Historial de simulaciones (3/${MAX_SIMULATIONS})`);
    // Sin modo comparación no se muestra ningún control de selección.
    expect(screen.queryByTestId(`compare-select-${mariaA.id}`)).toBeNull();

    // El flujo actual de ver la simulación sigue intacto.
    fireEvent.press(screen.getAllByLabelText('Ver simulación')[0]!);
    expect(mockNavigate).toHaveBeenCalledWith('Result', { simulationId: expect.any(String) });
    expect(screen.getAllByLabelText('Eliminar simulación')).toHaveLength(3);
  });

  test('muestra el costo mensual de la Modalidad 10 junto a las UMAs declaradas', async () => {
    const umasDeclaradas = 7.96;
    await saveSimulation(
      buildResult({
        name: 'María López',
        birthDate: MARIA_BIRTH,
        contributionSalary: 900,
        contributionSalaryInUMAs: umasDeclaradas,
      }),
      'María · Modalidad 10',
    );
    renderScreen(<HistoryScreen />);

    // El costo se calcula con los parámetros guardados: SBC declarado, clase de
    // riesgo, UMA (2025) y salario mínimo de la zona general.
    const costo = calculateM10MonthlyCost({
      dailySalary: 900,
      riskClass: 3,
      dailyUMA: 113.14,
      minimumDailySalary: getMinimumDailySalary({}, 'general'),
      year: 2025,
    });

    expect(
      await screen.findByText(
        `Sí · ${formatUMAs(umasDeclaradas)} UMA (${formatCurrency(costo)}/mes)`,
      ),
    ).toBeTruthy();
  });

  test('bloquea y atenúa simulaciones de otra persona y solo confirma con 2+ (SCN-004)', async () => {
    const { mariaA, mariaB, juana } = await seedHistory();
    renderScreen(<HistoryScreen />);

    await screen.findByText(`Historial de simulaciones (3/${MAX_SIMULATIONS})`);

    // Entrar en modo comparación.
    fireEvent.press(screen.getByText('Comparar'));
    await waitFor(() => expect(screen.getByText('Cancelar')).toBeTruthy());
    expect(
      screen.getByText(
        /^Marca dos o más simulaciones de la misma persona para compararlas\. Toca la tarjeta/,
      ),
    ).toBeTruthy();

    // Con 0 seleccionadas, todas las tarjetas son seleccionables.
    expect(screen.getByTestId(`compare-select-${juana.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`compare-blocked-${juana.id}`)).toBeNull();

    // Seleccionar la primera simulación de María.
    fireEvent.press(screen.getByTestId(`compare-select-${mariaA.id}`));
    await waitFor(() => expect(screen.getByText('1 seleccionada')).toBeTruthy());

    // La tarjeta de otra persona queda marcada como bloqueada con el mensaje.
    const blocked = await screen.findByTestId(`compare-blocked-${juana.id}`);
    expect(blocked).toBeTruthy();
    expect(screen.getByText(/^Es otra persona \(nació el /)).toBeTruthy();
    // La simulación de la misma persona NO queda bloqueada.
    expect(screen.queryByTestId(`compare-blocked-${mariaB.id}`)).toBeNull();

    // Intentar seleccionar la bloqueada no cambia la selección.
    fireEvent.press(screen.getByTestId(`compare-select-${juana.id}`));
    expect(screen.getByText('1 seleccionada')).toBeTruthy();

    // El botón de confirmar sigue deshabilitado con una sola seleccionada.
    const confirm = screen.getByLabelText('Comparar simulaciones seleccionadas');
    expect(confirm.props.accessibilityState?.disabled).toBe(true);
    // (y su pulsación no navega)
    fireEvent.press(confirm);
    expect(mockNavigate).not.toHaveBeenCalled();

    // Al marcar la segunda simulación de la misma persona, se habilita.
    fireEvent.press(screen.getByTestId(`compare-select-${mariaB.id}`));
    await waitFor(() => expect(screen.getByText('2 seleccionadas')).toBeTruthy());
    expect(
      screen.getByLabelText('Comparar simulaciones seleccionadas').props.accessibilityState?.disabled,
    ).toBe(false);

    fireEvent.press(screen.getByLabelText('Comparar simulaciones seleccionadas'));
    expect(mockNavigate).toHaveBeenCalledWith('MultiComparison', {
      simulationIds: [mariaA.id, mariaB.id],
    });
  });

  test('tocar cualquier parte de la tarjeta marca y desmarca la simulación', async () => {
    const { mariaA, juana } = await seedHistory();
    renderScreen(<HistoryScreen />);

    await screen.findByText(`Historial de simulaciones (3/${MAX_SIMULATIONS})`);
    fireEvent.press(screen.getByText('Comparar'));

    // Fuera del modo comparación la tarjeta no selecciona nada.
    expect(screen.getByTestId(`compare-card-${mariaA.id}`)).toBeTruthy();

    // Tocar la TARJETA (no el checkbox) la marca.
    fireEvent.press(screen.getByTestId(`compare-card-${mariaA.id}`));
    await waitFor(() => expect(screen.getByText('1 seleccionada')).toBeTruthy());
    expect(screen.getByTestId(`compare-select-${mariaA.id}`).props.accessibilityState?.checked).toBe(
      true,
    );

    // La tarjeta bloqueada (otra persona) no responde al toque.
    fireEvent.press(screen.getByTestId(`compare-card-${juana.id}`));
    expect(screen.getByText('1 seleccionada')).toBeTruthy();

    // Volver a tocar la misma tarjeta la desmarca.
    fireEvent.press(screen.getByTestId(`compare-card-${mariaA.id}`));
    await waitFor(() => expect(screen.getByText('0 seleccionadas')).toBeTruthy());
  });

  test('cancelar el modo comparación limpia la selección y restaura el historial', async () => {
    const { mariaA } = await seedHistory();
    renderScreen(<HistoryScreen />);

    await screen.findByText(`Historial de simulaciones (3/${MAX_SIMULATIONS})`);
    fireEvent.press(screen.getByText('Comparar'));
    fireEvent.press(screen.getByTestId(`compare-select-${mariaA.id}`));
    await waitFor(() => expect(screen.getByText('1 seleccionada')).toBeTruthy());

    fireEvent.press(screen.getByText('Cancelar'));

    await waitFor(() => expect(screen.queryByText('Cancelar')).toBeNull());
    expect(screen.queryByTestId(`compare-select-${mariaA.id}`)).toBeNull();
    expect(screen.getAllByLabelText('Ver simulación')).toHaveLength(3);
  });
});
