/**
 * Pruebas del helper de proyección de semanas hasta la edad de retiro.
 *
 * El helper es compartido por el motor de cálculo, el esquema de validación
 * y el formulario: es la única fuente de verdad sobre cuántas semanas se
 * tienen hoy y cuántas se proyectan hasta jubilarse.
 *
 * Para ejecutar: npm test
 */
import {
  calculateWeeksProjection,
  countCotizedWeeksInDateRange,
  estimateMonthsToRetirement,
  describeWeeksProjection,
} from '../utils/weeksProjection';
import { calculateM10PlannedWeeks } from '../utils/modalidad10';

describe('countCotizedWeeksInDateRange', () => {
  test('cuenta ambos extremos y redondea los rangos de 30 y 60 días', () => {
    expect(
      countCotizedWeeksInDateRange(new Date(2025, 5, 2), new Date(2025, 6, 1)),
    ).toBe(4);
    expect(
      countCotizedWeeksInDateRange(new Date(2025, 5, 2), new Date(2025, 6, 31)),
    ).toBe(9);
  });

  test('solo redondea hacia arriba cuando el residuo excede tres días', () => {
    expect(
      countCotizedWeeksInDateRange(new Date(2025, 0, 1), new Date(2025, 0, 10)),
    ).toBe(1);
    expect(
      countCotizedWeeksInDateRange(new Date(2025, 0, 1), new Date(2025, 0, 11)),
    ).toBe(2);
  });

  test('cuenta cero semanas para un solo día o un intervalo invertido', () => {
    expect(
      countCotizedWeeksInDateRange(new Date(2025, 2, 1), new Date(2025, 2, 1)),
    ).toBe(0);
    expect(
      countCotizedWeeksInDateRange(new Date(2025, 2, 2), new Date(2025, 2, 1)),
    ).toBe(0);
  });

  test('usa días calendario al atravesar el cambio de horario de verano', () => {
    expect(
      countCotizedWeeksInDateRange(new Date(2025, 2, 1), new Date(2025, 2, 11)),
    ).toBe(2);
  });
});

describe('calculateWeeksProjection', () => {
  test('proyecta desde mañana hasta la fecha exacta de retiro y aplica el umbral legal', () => {
    const referenceDate = new Date(2025, 5, 1);
    const projectionAtThreeRemainderDays = calculateWeeksProjection({
      currentWeeks: 100,
      age: 40,
      retirementAge: 65,
      referenceDate,
      retirementDate: new Date(2025, 5, 11),
      m10PlannedWeeks: 0,
    });
    const projectionAtFourRemainderDays = calculateWeeksProjection({
      currentWeeks: 100,
      age: 40,
      retirementAge: 65,
      referenceDate,
      retirementDate: new Date(2025, 5, 12),
      m10PlannedWeeks: 0,
    });

    expect(projectionAtThreeRemainderDays.projectedWeeks).toBe(1);
    expect(projectionAtFourRemainderDays.projectedWeeks).toBe(2);
    expect(projectionAtFourRemainderDays.targetWeeks).toBe(102);
    expect(projectionAtFourRemainderDays.yearsToRetirement).toBe(25);
  });

  test('no proyecta semanas si el retiro ocurre hoy o antes', () => {
    const referenceDate = new Date(2025, 5, 1);
    for (const retirementDate of [new Date(2025, 5, 1), new Date(2025, 4, 31)]) {
      expect(
        calculateWeeksProjection({
          currentWeeks: 100,
          age: 40,
          retirementAge: 65,
          referenceDate,
          retirementDate,
          m10PlannedWeeks: 0,
        }).projectedWeeks,
      ).toBe(0);
    }
  });

  test('el objetivo usa el máximo y M10 completa julio entre 30 de junio y 1 de julio', () => {
    const referenceDate = new Date(2025, 5, 30);
    const retirementDate = new Date(2025, 6, 1);
    const m10PlannedWeeks = calculateM10PlannedWeeks(referenceDate, retirementDate);
    const projection = calculateWeeksProjection({
      currentWeeks: 500,
      age: 64,
      retirementAge: 65,
      referenceDate,
      retirementDate,
      m10PlannedWeeks,
    });

    expect(m10PlannedWeeks).toBe(4);
    expect(projection.projectedWeeks).toBe(0);
    expect(projection.targetWeeks).toBe(504);
  });

  test('proyecta semanas por el intervalo de fechas exacto, independiente de la edad', () => {
    const projection = calculateWeeksProjection({
      currentWeeks: 500,
      age: 30,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2060, 5, 1),
      m10PlannedWeeks: 0,
    });

    expect(projection.yearsToRetirement).toBe(35);
    expect(projection.projectedWeeks).toBe(1826);
    expect(projection.targetWeeks).toBe(2326);
  });

  test('si ya está en la edad de retiro no proyecta semanas', () => {
    const projection = calculateWeeksProjection({
      currentWeeks: 800,
      age: 65,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2025, 5, 1),
      m10PlannedWeeks: 0,
    });

    expect(projection.yearsToRetirement).toBe(0);
    expect(projection.projectedWeeks).toBe(0);
    expect(projection.targetWeeks).toBe(800);
  });

  test('si la edad actual supera la edad de retiro no proyecta semanas', () => {
    const projection = calculateWeeksProjection({
      currentWeeks: 800,
      age: 70,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2025, 5, 1),
      m10PlannedWeeks: 0,
    });

    expect(projection.yearsToRetirement).toBe(0);
    expect(projection.projectedWeeks).toBe(0);
    expect(projection.targetWeeks).toBe(800);
  });

  test('las semanas de Modalidad 10 dentro del horizonte NO se suman dos veces', () => {
    // El horizonte base de 35 años es mayor que las 52 semanas de M10, que
    // quedan incluidas y no se suman dos veces.
    const projection = calculateWeeksProjection({
      currentWeeks: 500,
      age: 30,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2060, 5, 1),
      m10PlannedWeeks: 52,
    });

    expect(projection.projectedWeeks).toBe(1826);
    expect(projection.targetWeeks).toBe(500 + 1826);
  });

  test('las semanas de Modalidad 10 fuera del horizonte sustituyen a la proyección', () => {
    // La proyección exacta es de 260 semanas; si M10 aporta 300, prevalece.
    const projection = calculateWeeksProjection({
      currentWeeks: 500,
      age: 60,
      retirementAge: 65,
      referenceDate: new Date(2025, 0, 4),
      retirementDate: new Date(2030, 0, 1),
      m10PlannedWeeks: 300,
    });

    expect(projection.projectedWeeks).toBe(260);
    expect(projection.targetWeeks).toBe(500 + 300);
  });

  test('con Modalidad 10 dentro del horizonte el objetivo no se duplica', () => {
    const projection = calculateWeeksProjection({
      currentWeeks: 100,
      age: 40,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2050, 5, 1),
      m10PlannedWeeks: 100,
    });

    expect(projection.targetWeeks).toBe(100 + 1304);
  });
});

describe('estimateMonthsToRetirement', () => {
  test('calcula los meses que faltan hasta la edad de retiro', () => {
    expect(estimateMonthsToRetirement(30, 65)).toBe(35 * 12);
  });

  test('devuelve 0 si ya está en la edad de retiro', () => {
    expect(estimateMonthsToRetirement(65, 65)).toBe(0);
  });

  test('devuelve 0 si la edad actual supera la edad de retiro', () => {
    expect(estimateMonthsToRetirement(70, 65)).toBe(0);
  });
});

describe('describeWeeksProjection', () => {
  test('narra las tres cifras: cotizadas, proyectadas y total', () => {
    const projection = calculateWeeksProjection({
      currentWeeks: 100,
      age: 30,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2060, 5, 1),
      m10PlannedWeeks: 0,
    });

    const narrative = describeWeeksProjection(projection);
    expect(narrative.parts).toEqual([
      '100 cotizadas',
      '1826 proyectadas hasta la edad de retiro',
    ]);
    expect(narrative.breakdown).toBe(
      '100 cotizadas + 1826 proyectadas hasta la edad de retiro = 1926',
    );
    expect(narrative.m10ExtraWeeks).toBe(0);
  });

  test('con edad de retiro nombra el horizonte con los años', () => {
    const projection = calculateWeeksProjection({
      currentWeeks: 100,
      age: 30,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2060, 5, 1),
      m10PlannedWeeks: 0,
    });

    const narrative = describeWeeksProjection(projection, 65);
    expect(narrative.parts).toEqual([
      '100 cotizadas',
      '1826 proyectadas hasta los 65 años',
    ]);
  });

  test('menciona las semanas de Modalidad 10 que exceden el horizonte', () => {
    // Para estas fechas exactas, 260 semanas de proyección coinciden con
    // las primeras 260 semanas del supuesto M10; solo exceden 40.
    const projection = calculateWeeksProjection({
      currentWeeks: 500,
      age: 60,
      retirementAge: 65,
      referenceDate: new Date(2025, 0, 4),
      retirementDate: new Date(2030, 0, 1),
      m10PlannedWeeks: 300,
    });

    const narrative = describeWeeksProjection(projection);
    expect(narrative.m10ExtraWeeks).toBe(40);
    expect(narrative.breakdown).toBe(
      '500 cotizadas + 260 proyectadas hasta la edad de retiro + 40 planeadas en Modalidad 10 = 800',
    );
  });

  test('sin horizonte a futuro narra solo las semanas cotizadas', () => {
    const projection = calculateWeeksProjection({
      currentWeeks: 800,
      age: 65,
      retirementAge: 65,
      referenceDate: new Date(2025, 5, 1),
      retirementDate: new Date(2025, 5, 1),
      m10PlannedWeeks: 0,
    });

    const narrative = describeWeeksProjection(projection);
    expect(narrative.parts).toEqual(['800 cotizadas']);
    expect(narrative.breakdown).toBe('800 cotizadas = 800');
  });
});
