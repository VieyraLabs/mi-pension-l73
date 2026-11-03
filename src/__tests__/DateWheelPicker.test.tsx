/**
 * Pruebas del selector de fecha con ruedas ("Wheel Date Picker" de iOS).
 *
 * El picker es un componente reutilizable: se abre sobre un modal, ofrece una
 * rueda por cada componente de la fecha (año, mes y día) y devuelve la fecha
 * elegida con `onChange`.
 *
 * Para ejecutar: npm test
 */
import React from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import { renderScreen } from '../test-utils/renderScreen';
import { DateWheelPicker } from '../components/DateWheelPicker';

function renderPicker(overrides?: {
  onChange?: jest.Mock<void, [Date]>;
  onDismiss?: jest.Mock<void, []>;
  value?: Date;
  minDate?: Date;
  maxDate?: Date;
}) {
  const onChange = overrides?.onChange ?? jest.fn<void, [Date]>();
  const onDismiss = overrides?.onDismiss ?? jest.fn<void, []>();
  renderScreen(
    <DateWheelPicker
      visible
      value={overrides?.value ?? new Date(2030, 0, 1)}
      onChange={onChange}
      onDismiss={onDismiss}
      minDate={overrides?.minDate}
      maxDate={overrides?.maxDate}
    />,
  );
  return { onChange, onDismiss };
}

describe('DateWheelPicker', () => {
  test('abre el modal con las ruedas de año, mes y día', () => {
    renderPicker();

    expect(screen.getByText('Selecciona la fecha')).toBeTruthy();
    expect(screen.getByText('Aceptar')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  test('cada elemento de la rueda es localizable por su accessibilityLabel', () => {
    renderPicker({ value: new Date(2030, 0, 1) });

    expect(screen.getByLabelText('Año 2030')).toBeTruthy();
    expect(screen.getByLabelText('Mes enero')).toBeTruthy();
    expect(screen.getByLabelText('Día 1')).toBeTruthy();
  });

  test('elegir año, mes y día y aceptar devuelve la fecha elegida', () => {
    const { onChange, onDismiss } = renderPicker({ value: new Date(2030, 0, 1) });

    fireEvent.press(screen.getByLabelText('Año 2029'));
    fireEvent.press(screen.getByLabelText('Mes julio'));
    fireEvent.press(screen.getByLabelText('Día 16'));
    fireEvent.press(screen.getByText('Aceptar'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const fecha = onChange.mock.calls[0]?.[0] as Date;
    expect(fecha.getFullYear()).toBe(2029);
    expect(fecha.getMonth()).toBe(6);
    expect(fecha.getDate()).toBe(16);
    // Al confirmar, el modal se cierra.
    expect(onDismiss).toHaveBeenCalled();
  });

  test('cancelar cierra el modal sin devolver fecha', () => {
    const { onChange, onDismiss } = renderPicker({ value: new Date(2030, 0, 1) });

    fireEvent.press(screen.getByLabelText('Día 16'));
    fireEvent.press(screen.getByText('Cancelar'));

    expect(onChange).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  test('la rueda de años respeta la fecha mínima y la máxima', () => {
    renderPicker({
      value: new Date(2030, 0, 1),
      minDate: new Date(2028, 0, 1),
      maxDate: new Date(2032, 0, 1),
    });

    expect(screen.getByLabelText('Año 2028')).toBeTruthy();
    expect(screen.getByLabelText('Año 2032')).toBeTruthy();
    expect(screen.queryByLabelText('Año 2027')).toBeNull();
    expect(screen.queryByLabelText('Año 2033')).toBeNull();
  });

  test('la rueda de días se limita a los días del mes elegido', () => {
    renderPicker({ value: new Date(2030, 1, 1) });

    // Febrero de 2030 tiene 28 días.
    expect(screen.getByLabelText('Día 28')).toBeTruthy();
    expect(screen.queryByLabelText('Día 29')).toBeNull();
  });
});
