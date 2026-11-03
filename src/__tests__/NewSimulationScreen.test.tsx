/**
 * Prueba de humo de NewSimulationScreen: renderiza el primer paso del
 * stepper sin crashear y permite avanzar de paso.
 *
 * También fija la estructura de los pasos (4 en total): el historial laboral y
 * el SBC viven en el paso 2, la edad de retiro y los beneficiarios en el paso
 * 3, y la UMA y la Modalidad 10 en el paso 4.
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
  useRoute: () => ({ params: undefined }),
}));

import React from 'react';
import { StyleSheet } from 'react-native';
import { screen, fireEvent } from '@testing-library/react-native';
import { lightTheme } from '../theme';
import { renderScreen } from '../test-utils/renderScreen';
import NewSimulationScreen from '../screens/NewSimulationScreen';
import { getLocalReferenceDate } from '../utils/weeksProjection';
import { calculateM10MonthlyCost, estimateM10Months } from '../utils/modalidad10';
import { round2 } from '../utils/format';
import { formatCurrency } from '../utils/format';
import { UMA_ACTUAL } from '../constants/uma';
import {
  cumpleanosEnEdad,
  edadMostrada,
  formateaEdad,
} from '../components/RetirementAgeStep';

/** Fecha de nacimiento de referencia: 15 de enero de 1960. */
const NACIMIENTO = new Date(1960, 0, 15);

/**
 * El nombre es obligatorio desde el paso 1: escribe uno y avanza al paso 2.
 */
function advanceToWorkHistoryStep() {
  fireEvent.changeText(screen.getAllByDisplayValue('')[0]!, 'Persona de prueba');
  fireEvent.press(screen.getByText('Siguiente'));
}

function advanceToRetirementStep() {
  advanceToWorkHistoryStep();
  fireEvent.changeText(screen.getAllByDisplayValue('')[0]!, '500');
  fireEvent.changeText(screen.getAllByDisplayValue('')[0]!, '200');
  fireEvent.press(screen.getByText('Siguiente'));
}

function advanceToUmaStep() {
  advanceToRetirementStep();
  fireEvent.press(screen.getByText('Siguiente'));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NewSimulationScreen', () => {
  test('renderiza el paso de datos personales sin crashear', () => {
    renderScreen(<NewSimulationScreen />);

    expect(screen.getByText('Paso 1 de 4: Datos personales')).toBeTruthy();
    expect(screen.getByText('Información personal')).toBeTruthy();
  });

  test('en el paso de datos personales «Siguiente» exige el nombre además de la fecha válida', () => {
    renderScreen(<NewSimulationScreen />);

    // La fecha trae un valor válido por defecto, pero el nombre es
    // obligatorio: sin él no se avanza.
    expect(screen.getAllByText('Nombre *').length).toBeGreaterThan(0);

    const nextButton = screen.getByText('Siguiente');
    expect(nextButton).toBeDisabled();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0]!, 'María López');
    expect(nextButton).toBeEnabled();

    fireEvent.press(nextButton);
    expect(screen.getByText('Paso 2 de 4: Historial laboral')).toBeTruthy();
  });

  test('la fecha de nacimiento del paso 1 se elige con el mismo calendario que la de retiro', () => {
    renderScreen(<NewSimulationScreen />);

    // El nombre es obligatorio; la fecha por defecto ya es válida.
    fireEvent.changeText(screen.getAllByDisplayValue('')[0]!, 'María López');

    // El campo no se escribe a mano: muestra la fecha por defecto del
    // formulario en formato largo y es de solo lectura.
    const campo = screen.getByDisplayValue('1 de enero de 1965');
    expect(campo.props.editable).toBe(false);

    // Tocar el campo abre el MISMO selector de calendario del paso 3.
    fireEvent.press(screen.getByLabelText('Abrir calendario'));
    expect(screen.getByText('Selecciona la fecha')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Año 1980'));
    fireEvent.press(screen.getByLabelText('Mes marzo'));
    fireEvent.press(screen.getByLabelText('Día 15'));
    fireEvent.press(screen.getByText('Aceptar'));

    // La fecha elegida queda en el campo (con su edad informativa) y
    // «Siguiente» permanece habilitado.
    expect(screen.getByDisplayValue('15 de marzo de 1980')).toBeTruthy();
    expect(screen.getByText(/Edad actual: \d+ años/)).toBeTruthy();
    expect(screen.getByText('Siguiente')).toBeEnabled();
  });

  test('bloquea «Siguiente» en el paso laboral hasta completar campos obligatorios válidos', () => {
    renderScreen(<NewSimulationScreen />);
    advanceToWorkHistoryStep();

    const nextButton = screen.getByText('Siguiente');
    expect(nextButton).toBeDisabled();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0]!, '500');
    expect(nextButton).toBeDisabled();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0]!, '200');
    expect(nextButton).toBeEnabled();

    fireEvent.changeText(screen.getByDisplayValue('500'), '5001');
    expect(nextButton).toBeDisabled();
  });

  test('el botón "Siguiente" avanza al paso de historial laboral', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToWorkHistoryStep();

    expect(screen.getByText('Paso 2 de 4: Historial laboral')).toBeTruthy();
    expect(screen.getByText('Historial laboral')).toBeTruthy();
  });

  test('el botón "Anterior" está deshabilitado en el primer paso', () => {
    renderScreen(<NewSimulationScreen />);

    expect(screen.getByText('Anterior')).toBeDisabled();
  });

  test('el paso 1 ya NO pide la edad de retiro', () => {
    renderScreen(<NewSimulationScreen />);

    expect(screen.getByText('Paso 1 de 4: Datos personales')).toBeTruthy();
    expect(screen.queryAllByText(/Edad de retiro/)).toHaveLength(0);
  });

  test('el paso 2 reúne el historial laboral y el SBC', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToWorkHistoryStep();

    expect(screen.getByText('Paso 2 de 4: Historial laboral')).toBeTruthy();
    // Semanas cotizadas (tarjeta de historial laboral).
    expect(screen.getAllByText(/Total de semanas cotizadas/).length).toBeGreaterThan(0);
    // SBC (tarjeta de salario, en la MISMA pantalla).
    expect(screen.getAllByText(/Salario diario promedio/).length).toBeGreaterThan(0);
  });

  test('el paso 2 NO narra la proyección de semanas (la edad de retiro aún no está decidida)', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToWorkHistoryStep();

    expect(screen.getByText('Paso 2 de 4: Historial laboral')).toBeTruthy();
    expect(screen.queryByText(/Al jubilarte tendrás/)).toBeNull();
    expect(screen.queryByText(/se proyectan/)).toBeNull();
    expect(screen.queryByText(/La proyección asume/)).toBeNull();
  });

  test('el paso 3 reúne la edad de retiro y los beneficiarios', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToRetirementStep();

    expect(screen.getByText('Paso 3 de 4: Edad de retiro')).toBeTruthy();
    // Edad de retiro (tarjeta).
    expect(screen.getAllByText(/Edad de retiro/).length).toBeGreaterThan(0);
    // Beneficiarios (misma pantalla).
    expect(screen.getAllByText('Beneficiarios').length).toBeGreaterThan(0);
    expect(screen.getByText('Salario Base de Cotización proyectado')).toBeTruthy();
    expect(screen.queryByLabelText('Salario Base de Cotización proyectado')).toBeNull();
  });

  test('el paso 4 reúne la UMA y la Modalidad 10', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToUmaStep();

    expect(screen.getByText('Paso 4 de 4: UMA')).toBeTruthy();
    // UMA (tarjeta).
    expect(screen.getAllByText(/Unidad de Medida y Actualización/).length).toBeGreaterThan(0);
    // Modalidad 10 (misma pantalla).
    expect(screen.getAllByText(/Modalidad 10 \(opcional\)/).length).toBeGreaterThan(0);
  });

  test('el paso 3 precarga la fecha del cumpleaños a los 65 y muestra la edad en solo lectura', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToRetirementStep();

    // La fecha precargada es el cumpleaños a los 65 años (1 de enero de 2030).
    expect(screen.getByDisplayValue('1 de enero de 2030')).toBeTruthy();
    // La edad calculada se presenta como texto informativo, no como input.
    expect(screen.getByText('65 años')).toBeTruthy();
    expect(screen.queryByDisplayValue('65')).toBeNull();
  });

  test('elegir una fecha en el calendario actualiza la edad mostrada', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToRetirementStep();

    fireEvent.press(screen.getByLabelText('Abrir calendario'));
    // 1 de julio de 2029 → 64 años y 6 meses → 64.5 (medio año de precisión).
    fireEvent.press(screen.getByLabelText('Año 2029'));
    fireEvent.press(screen.getByLabelText('Mes julio'));
    fireEvent.press(screen.getByLabelText('Día 1'));
    fireEvent.press(screen.getByText('Aceptar'));

    expect(screen.getByDisplayValue('1 de julio de 2029')).toBeTruthy();
    expect(screen.getByText('64.5 años')).toBeTruthy();
    expect(screen.queryByDisplayValue('64.5')).toBeNull();
  });

  test('para el 1 de julio de 2025 muestra 60.5 años y aclara la edad para el factor de Cesantía', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToRetirementStep();

    fireEvent.press(screen.getByLabelText('Abrir calendario'));
    fireEvent.press(screen.getByLabelText('Año 2025'));
    fireEvent.press(screen.getByLabelText('Mes julio'));
    fireEvent.press(screen.getByLabelText('Día 1'));
    fireEvent.press(screen.getByText('Aceptar'));

    expect(screen.getByDisplayValue('1 de julio de 2025')).toBeTruthy();
    expect(screen.getByText('60.5 años')).toBeTruthy();
    expect(
      screen.getByText(
        'Para el factor de Cesantía, se considera como 61 años (Art. 171 LSS 1973).',
      ),
    ).toBeTruthy();
  });

  test('para el 1 de julio de 2030 muestra 65 años sin fracción ni nota de edad legal', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToRetirementStep();

    fireEvent.press(screen.getByLabelText('Abrir calendario'));
    fireEvent.press(screen.getByLabelText('Año 2030'));
    fireEvent.press(screen.getByLabelText('Mes julio'));
    fireEvent.press(screen.getByLabelText('Día 1'));
    fireEvent.press(screen.getByText('Aceptar'));

    expect(screen.getByDisplayValue('1 de julio de 2030')).toBeTruthy();
    expect(screen.getByText('65 años')).toBeTruthy();
    expect(screen.queryByText(/65\.5 años|se considera como/)).toBeNull();
  });

  test('tocar el campo de fecha abre el calendario', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToRetirementStep();

    expect(screen.queryByText('Selecciona la fecha')).toBeNull();
    fireEvent.press(screen.getByDisplayValue('1 de enero de 2030'));
    expect(screen.getByText('Selecciona la fecha')).toBeTruthy();
  });

  test('el motor recibe la EDAD DE PRESENTACIÓN (con medios años): la consume para la edad legal', () => {
    renderScreen(<NewSimulationScreen />);

    advanceToRetirementStep();

    // 1 de julio de 2029 con nacimiento 1 de enero de 1965 → 64.5 en pantalla.
    fireEvent.press(screen.getByLabelText('Abrir calendario'));
    fireEvent.press(screen.getByLabelText('Año 2029'));
    fireEvent.press(screen.getByLabelText('Mes julio'));
    fireEvent.press(screen.getByLabelText('Día 1'));
    fireEvent.press(screen.getByText('Aceptar'));

    const displayedAge = screen.getByText('64.5 años');
    expect(displayedAge).toBeTruthy();
    expect(StyleSheet.flatten(displayedAge.props.style)).toMatchObject({
      fontSize: lightTheme.fonts.titleMedium.fontSize,
      lineHeight: lightTheme.fonts.titleMedium.lineHeight,
    });

    // El motor aplica el Art. 171 LSS 1973: 64.5 → edad legal 65 (vejez).
    expect(
      screen.getByText(
        'Para determinar el tipo y factor de pensión, se considera como 65 años (Vejez, Art. 171 LSS 1973).',
      ),
    ).toBeTruthy();

    // El horizonte de Modalidad 10 se deriva de la EDAD DE PRESENTACIÓN (64.5).
    fireEvent.press(screen.getByText('Siguiente'));
    fireEvent.press(screen.getByText('¿Deseas cotizar en Modalidad 10? Toca aquí'));

    const mesesConMediaEdad = estimateM10Months(
      getLocalReferenceDate(),
      new Date(2029, 6, 1),
    );
    expect(screen.getByText('Meses cotizando en M10 (proyectados)')).toBeTruthy();
    expect(screen.getByText(`${mesesConMediaEdad} meses`)).toBeTruthy();
    expect(
      screen.getByText(
        'M10 va del día 1 del mes siguiente a hoy hasta el último día del mes de retiro, ambos inclusive.',
      ),
    ).toBeTruthy();
  });

  test('los meses de Modalidad 10 son de solo lectura: texto, no campo editable', () => {
    renderScreen(<NewSimulationScreen />);

    // Ir al paso 4 (UMA + Modalidad 10).
    advanceToUmaStep();
    expect(screen.getByText('Paso 4 de 4: UMA')).toBeTruthy();

    // Activar Modalidad 10.
    fireEvent.press(screen.getByText('¿Deseas cotizar en Modalidad 10? Toca aquí'));

    // El valor viene del horizonte: los meses entre hoy y la fecha de retiro.
    const mesesEsperados = estimateM10Months(
      getLocalReferenceDate(),
      new Date(2030, 0, 1),
    );

    // Es un texto de solo lectura, como la edad de retiro: no un input.
    expect(screen.getByText('Meses cotizando en M10 (proyectados)')).toBeTruthy();
    expect(screen.getByText(`${mesesEsperados} meses`)).toBeTruthy();
    expect(screen.queryByDisplayValue(String(mesesEsperados))).toBeNull();
  });

  test('la Modalidad 10 arranca con el máximo legal de UMAs y el control las mueve de una en una', () => {
    renderScreen(<NewSimulationScreen />);
    advanceToUmaStep();

    // Activar Modalidad 10: se precarga el techo de 25 UMA (Art. 28 LSS vigente).
    fireEvent.press(screen.getByText('¿Deseas cotizar en Modalidad 10? Toca aquí'));

    expect(screen.getByDisplayValue('25')).toBeTruthy();
    expect(
      screen.getByDisplayValue(String(round2(25 * UMA_ACTUAL.dailyUMA))),
    ).toBeTruthy();

    // Bajar una UMA baja el monto una UMA.
    fireEvent.press(screen.getByLabelText('Quitar una UMA'));
    expect(screen.getByDisplayValue('24')).toBeTruthy();
    expect(
      screen.getByDisplayValue(String(round2(24 * UMA_ACTUAL.dailyUMA))),
    ).toBeTruthy();
  });

  test('escribir el SBC actualiza su equivalente en UMAs', () => {
    renderScreen(<NewSimulationScreen />);
    advanceToUmaStep();
    fireEvent.press(screen.getByText('¿Deseas cotizar en Modalidad 10? Toca aquí'));

    fireEvent.changeText(
      screen.getByDisplayValue(String(round2(25 * UMA_ACTUAL.dailyUMA))),
      '1000',
    );

    expect(screen.getByDisplayValue(String(round2(1000 / UMA_ACTUAL.dailyUMA)))).toBeTruthy();
  });

  test('muestra el costo mensual y el rango legal de UMAs', () => {
    renderScreen(<NewSimulationScreen />);
    advanceToUmaStep();
    fireEvent.press(screen.getByText('¿Deseas cotizar en Modalidad 10? Toca aquí'));

    expect(screen.getByText('Costo mensual de la Modalidad 10')).toBeTruthy();
    // La ocupación precargada es Comerciantes (clase III).
    expect(
      screen.getByText(
        `${formatCurrency(
          calculateM10MonthlyCost({
            dailySalary: round2(25 * UMA_ACTUAL.dailyUMA),
            riskClass: 3,
            dailyUMA: UMA_ACTUAL.dailyUMA,
            minimumDailySalary: UMA_ACTUAL.smgCdmx,
            year: UMA_ACTUAL.year,
          }),
        )}/mes`,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Rango legal \(Art\. 28 LSS vigente\)/)).toBeTruthy();
  });

  test('la ocupación precargada es Comerciantes y agentes de ventas → Comerciantes', () => {
    renderScreen(<NewSimulationScreen />);
    advanceToUmaStep();
    fireEvent.press(screen.getByText('¿Deseas cotizar en Modalidad 10? Toca aquí'));

    expect(screen.getByText('Comerciantes y agentes de ventas')).toBeTruthy();
    expect(screen.getByText('Comerciantes')).toBeTruthy();
    expect(screen.getByText(/Clase III/)).toBeTruthy();
  });

  test('elegir la ocupación fija la clase de riesgo y con ella el costo', () => {
    renderScreen(<NewSimulationScreen />);
    advanceToUmaStep();
    fireEvent.press(screen.getByText('¿Deseas cotizar en Modalidad 10? Toca aquí'));

    const costoClaseIII = calculateM10MonthlyCost({
      dailySalary: round2(25 * UMA_ACTUAL.dailyUMA),
      riskClass: 3,
      dailyUMA: UMA_ACTUAL.dailyUMA,
      minimumDailySalary: UMA_ACTUAL.smgCdmx,
      year: UMA_ACTUAL.year,
    });

    // Plataformas digitales → Conductores y repartidores → clase IV.
    fireEvent.press(screen.getByLabelText('Seleccionar División'));
    fireEvent.press(screen.getByText('Plataformas digitales'));
    fireEvent.press(screen.getByLabelText('Seleccionar Grupo principal'));
    fireEvent.press(screen.getByText('Conductores y repartidores'));

    const costoClaseIV = calculateM10MonthlyCost({
      dailySalary: round2(25 * UMA_ACTUAL.dailyUMA),
      riskClass: 4,
      dailyUMA: UMA_ACTUAL.dailyUMA,
      minimumDailySalary: UMA_ACTUAL.smgCdmx,
      year: UMA_ACTUAL.year,
    });

    expect(screen.getByText(`${formatCurrency(costoClaseIV)}/mes`)).toBeTruthy();
    expect(screen.queryByText(`${formatCurrency(costoClaseIII)}/mes`)).toBeNull();
    expect(screen.getByText(/Clase IV/)).toBeTruthy();
  });
});

describe('RetirementAgeStep — reglas de presentación de la edad', () => {
  test('el cumpleaños precargado es el del año en que cumpliría 65 años', () => {
    expect(cumpleanosEnEdad(NACIMIENTO, 65)).toEqual(new Date(2025, 0, 15));
  });

  test('el 29 de febrero se ajusta en los años que no son bisiestos', () => {
    // 1960 + 65 = 2025, que no es bisiesto: 28 de febrero.
    expect(cumpleanosEnEdad(new Date(1960, 1, 29), 65)).toEqual(new Date(2025, 1, 28));
  });

  test('60 años y 3 meses → 60', () => {
    expect(edadMostrada(NACIMIENTO, new Date(2020, 3, 15))).toBe(60);
  });

  test('60 años y 6 meses → 60.5', () => {
    expect(edadMostrada(NACIMIENTO, new Date(2020, 6, 15))).toBe(60.5);
  });

  test('60 años y 9 meses → 60.5 (el medio año más cercano, no 61)', () => {
    expect(edadMostrada(NACIMIENTO, new Date(2020, 9, 15))).toBe(60.5);
  });

  test('64 años y 7 meses → 64.5', () => {
    expect(edadMostrada(NACIMIENTO, new Date(2024, 7, 15))).toBe(64.5);
  });

  test('65 años y 6 meses → 65 (a partir de 65, solo enteros)', () => {
    expect(edadMostrada(NACIMIENTO, new Date(2025, 6, 15))).toBe(65);
  });

  test('66 años y 2 meses → 66 (fuera del rango de medios años)', () => {
    expect(edadMostrada(NACIMIENTO, new Date(2026, 2, 15))).toBe(66);
  });

  test('59 años y 11 meses → 59', () => {
    expect(edadMostrada(NACIMIENTO, new Date(2019, 11, 15))).toBe(59);
  });

  test('el formato muestra decimal solo si hay fracción', () => {
    expect(formateaEdad(60)).toBe('60');
    expect(formateaEdad(60.5)).toBe('60.5');
    expect(formateaEdad(65)).toBe('65');
  });
});
