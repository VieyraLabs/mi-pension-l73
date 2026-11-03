/**
 * Pruebas del hook useHistory (historial de simulaciones guardadas).
 *
 * Para ejecutar: npm test
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories run before imports are available
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useHistory } from '../hooks/useHistory';
import { calculatePension } from '../services/pension/PensionCalculator';
import type { PensionInput } from '../models';

function buildResult() {
  const input: PensionInput = {
    personalData: {
      birthDate: new Date(1960, 0, 1),
      age: 65,
      estimatedRetirementDate: new Date(2025, 0, 1),
      retirementAge: 65,
    },
    workHistory: { totalWeeks: 500, employmentRelations: [] },
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
  return calculatePension(input);
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useHistory', () => {
  test('carga las simulaciones guardadas al montar', async () => {
    const { result } = renderHook(() => useHistory());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.simulations).toEqual([]);
  });

  test('save agrega una simulación al principio de la lista', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save(buildResult(), 'Primera');
    });

    expect(result.current.simulations).toHaveLength(1);
    expect(result.current.simulations[0]?.name).toBe('Primera');
  });

  test('remove quita la simulación indicada del estado', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let savedId = '';
    await act(async () => {
      const saved = await result.current.save(buildResult(), 'A eliminar');
      savedId = saved.id;
    });
    expect(result.current.simulations).toHaveLength(1);

    await act(async () => {
      await result.current.remove(savedId);
    });

    expect(result.current.simulations).toHaveLength(0);
  });

  test('clear vacía todo el historial', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save(buildResult(), 'A');
      await result.current.save(buildResult(), 'B');
    });
    expect(result.current.simulations).toHaveLength(2);

    await act(async () => {
      await result.current.clear();
    });

    expect(result.current.simulations).toHaveLength(0);
  });
});
