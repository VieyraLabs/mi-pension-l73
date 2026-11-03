/**
 * Pruebas de la EDAD LEGAL para el cálculo de la cuantía (Art. 171 LSS 1973).
 *
 * "Se aumentará un año a los cumplidos cuando la edad los exceda en seis meses."
 * (LSS 1973, Art. 171; DOF 12-mar-1973).
 *
 * Para ejecutar: npm test
 */
import { calculateLegalAge, calculateRetirementDate } from '../utils/date';

describe('calculateLegalAge — regla del Art. 171 LSS 1973', () => {
  test('una edad entera se mantiene', () => {
    expect(calculateLegalAge(60)).toBe(60);
    expect(calculateLegalAge(61)).toBe(61);
    expect(calculateLegalAge(64)).toBe(64);
    expect(calculateLegalAge(65)).toBe(65);
  });

  test('menos de medio año no aumenta la edad', () => {
    expect(calculateLegalAge(60.25)).toBe(60);
    expect(calculateLegalAge(63.49)).toBe(63);
  });

  test('medio año o más aumenta un año', () => {
    expect(calculateLegalAge(60.5)).toBe(61);
    expect(calculateLegalAge(61.5)).toBe(62);
    expect(calculateLegalAge(64.5)).toBe(65);
  });
});

describe('calculateRetirementDate — edad de retiro fraccionada', () => {
  test('con edad entera conserva el cumpleaños del año correspondiente', () => {
    const nacimiento = new Date(1965, 0, 15);
    expect(calculateRetirementDate(nacimiento, 65)).toEqual(new Date(2030, 0, 15));
  });

  test('con edad fraccionada suma los meses de la fracción', () => {
    const nacimiento = new Date(1965, 0, 15);
    // 60.5 años → 60 años y 6 meses → 15 de julio de 2025.
    expect(calculateRetirementDate(nacimiento, 60.5)).toEqual(new Date(2025, 6, 15));
  });
});
