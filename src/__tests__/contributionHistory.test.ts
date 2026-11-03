/**
 * Pruebas del cálculo de las últimas 250 SEMANAS COTIZADAS (Art. 167 LSS 1973).
 *
 * La regla central bajo prueba: son 250 semanas *cotizadas*, no 250 semanas
 * *calendario*. Los huecos sin cotización se conservan en el historial pero
 * se saltan al promediar, y el recorrido sigue hacia atrás hasta reunir las
 * 250 semanas cotizadas.
 */
import {
  buildContributionHistory,
  buildContributionSegments,
  calculateAverageSalary,
  calculateContributionSummary,
  getContributedWeeks,
  getLastContributionWeeks,
  getLastRegisteredDailySalary,
  selectPeriodsInAverageWindow,
  summarizeLastContributedWeeks,
  type SBCPeriod,
} from '../services/pension/history';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const REFERENCIA = new Date(2026, 0, 1);

/**
 * Construye un periodo que abarca las semanas `[desdeSemana, hastaSemana)`
 * contadas hacia atrás desde la fecha de referencia (0 = la semana más
 * reciente). Permite describir historiales por semanas en vez de por fechas.
 */
function periodoPorSemanas(desdeSemana: number, hastaSemana: number, sbc: number): SBCPeriod {
  const endDate = new Date(REFERENCIA.getTime() - desdeSemana * MS_PER_WEEK - MS_PER_DAY);
  const startDate = new Date(REFERENCIA.getTime() - hastaSemana * MS_PER_WEEK);
  return { startDate, endDate, sbc };
}

describe('buildContributionHistory', () => {
  test('marca como cotizadas las semanas cubiertas y como huecos las que no', () => {
    // 10 semanas cotizadas, 5 de hueco, 10 cotizadas (de más antigua a más reciente).
    const history = buildContributionHistory(
      [periodoPorSemanas(0, 10, 200), periodoPorSemanas(15, 25, 100)],
      REFERENCIA,
    );

    expect(history.weeks).toHaveLength(25);
    // Orden cronológico ascendente: la más antigua primero.
    expect(history.weeks[0]!.date.getTime()).toBeLessThan(history.weeks[24]!.date.getTime());
    expect(getContributedWeeks(history)).toHaveLength(20);
    // Los huecos se conservan en el historial, no se eliminan.
    expect(history.weeks.filter((w) => !w.contributed)).toHaveLength(5);
  });

  test('devuelve un historial vacío cuando no hay periodos', () => {
    expect(buildContributionHistory([], REFERENCIA).weeks).toEqual([]);
  });

  test('devuelve un historial vacío cuando la referencia precede al primer periodo', () => {
    // La referencia es anterior al inicio del historial: no hay historial que
    // construir hacia atrás.
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2025, 0, 1),
        endDate: new Date(2025, 11, 31),
        sbc: 200,
        employerName: 'EMPRESA A',
      },
    ];

    expect(buildContributionHistory(periodos, new Date(2024, 0, 1)).weeks).toEqual([]);
  });
});

describe('calculateAverageSalary', () => {
  test('promedia solo las semanas cotizadas, ignorando los huecos', () => {
    const weeks = [
      { date: new Date(2025, 0, 1), contributed: true, salaryBaseContribution: 100 },
      { date: new Date(2025, 0, 8), contributed: false },
      { date: new Date(2025, 0, 15), contributed: true, salaryBaseContribution: 300 },
    ];
    // (100 + 300) / 2 = 200 — la semana sin cotización no diluye el promedio.
    expect(calculateAverageSalary(weeks)).toBe(200);
  });

  test('devuelve 0 si no hay ninguna semana cotizada', () => {
    expect(calculateAverageSalary([{ date: new Date(2025, 0, 1), contributed: false }])).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Casos de prueba del criterio legal
// ─────────────────────────────────────────────

describe('últimas 250 semanas cotizadas (Art. 167 LSS 1973)', () => {
  test('Caso 1: con 300 semanas consecutivas cotizadas, toma solo las últimas 250', () => {
    const history = buildContributionHistory([periodoPorSemanas(0, 300, 500)], REFERENCIA);
    const summary = calculateContributionSummary(history)!;

    expect(summary.contributedWeeks).toBe(300);
    expect(summary.selectedWeeks).toBe(250);
    expect(summary.skippedWeeks).toBe(0);
    expect(summary.isComplete).toBe(true);
    expect(summary.averageSalary).toBe(500);
  });

  test('Caso 2: salta el hueco y sigue hacia atrás hasta reunir las 250 cotizadas', () => {
    // Contando hacia atrás: 100 semanas cotizadas ($900), 52 sin cotizar,
    // y antes 300 semanas cotizadas ($100).
    const history = buildContributionHistory(
      [periodoPorSemanas(0, 100, 900), periodoPorSemanas(152, 452, 100)],
      REFERENCIA,
    );
    const summary = calculateContributionSummary(history)!;

    expect(summary.skippedWeeks).toBe(52);
    expect(summary.contributedWeeks).toBe(400);
    expect(summary.selectedWeeks).toBe(250);
    expect(summary.isComplete).toBe(true);

    // Las 250 seleccionadas son 100 semanas a $900 + 150 semanas a $100
    // (las 52 sin cotizar NO entran, y el recorrido continuó más atrás).
    // (100 × 900 + 150 × 100) / 250 = 420
    expect(summary.averageSalary).toBe(420);
  });

  test('no cuenta huecos antiguos fuera del rango de semanas seleccionado', () => {
    const history = buildContributionHistory(
      [periodoPorSemanas(0, 300, 500), periodoPorSemanas(320, 420, 100)],
      REFERENCIA,
    );
    const summary = calculateContributionSummary(history)!;

    expect(summary.selectedWeeks).toBe(250);
    expect(summary.skippedWeeks).toBe(0);
    expect(summary.averageSalary).toBe(500);
  });

  test('Caso 2 (contraste): tomar 250 semanas calendario daría un promedio distinto', () => {
    // Mismo historial que el caso anterior. Con el criterio incorrecto de
    // "250 semanas calendario" solo se alcanzarían 100 semanas a $900 y 98
    // a $100 (las 52 de hueco se habrían "gastado" dentro de la ventana),
    // dando un promedio más alto que el correcto de $420.
    const history = buildContributionHistory(
      [periodoPorSemanas(0, 100, 900), periodoPorSemanas(152, 452, 100)],
      REFERENCIA,
    );
    const ultimas250Calendario = history.weeks.slice(-250);
    const promedioCalendario = calculateAverageSalary(ultimas250Calendario);
    const promedioCotizadas = calculateContributionSummary(history)!.averageSalary;

    expect(promedioCalendario).toBeGreaterThan(promedioCotizadas);
  });

  test('Caso 3: con múltiples periodos laborales devuelve exactamente 250 semanas cotizadas', () => {
    // Cuatro periodos separados por huecos de distinta duración.
    const history = buildContributionHistory(
      [
        periodoPorSemanas(0, 60, 800),
        periodoPorSemanas(70, 150, 600),
        periodoPorSemanas(160, 260, 400),
        periodoPorSemanas(300, 420, 200),
      ],
      REFERENCIA,
    );
    const selected = getLastContributionWeeks(history);

    expect(selected).toHaveLength(250);
    // Todas las seleccionadas tienen cotización válida.
    expect(selected.every((w) => w.contributed && (w.salaryBaseContribution ?? 0) > 0)).toBe(true);
    // Y están en orden cronológico ascendente.
    const fechas = selected.map((w) => w.date.getTime());
    expect([...fechas].sort((a, b) => a - b)).toEqual(fechas);
  });

  test('marca isComplete=false cuando el historial no reúne 250 semanas cotizadas', () => {
    const history = buildContributionHistory([periodoPorSemanas(0, 120, 300)], REFERENCIA);
    const summary = calculateContributionSummary(history)!;

    expect(summary.contributedWeeks).toBe(120);
    expect(summary.selectedWeeks).toBe(120);
    expect(summary.isComplete).toBe(false);
    expect(summary.averageSalary).toBe(300);
  });

  test('el desglose reporta la primera y última semana usadas', () => {
    const history = buildContributionHistory([periodoPorSemanas(0, 300, 500)], REFERENCIA);
    const summary = calculateContributionSummary(history)!;

    expect(summary.firstWeekUsed.getTime()).toBeLessThan(summary.lastWeekUsed.getTime());
    expect(summary.totalWeeksInHistory).toBe(300);
  });

  test('devuelve null cuando el historial no tiene ninguna semana cotizada', () => {
    expect(calculateContributionSummary({ weeks: [] })).toBeNull();
    expect(summarizeLastContributedWeeks([], REFERENCIA)).toBeNull();
  });
});

describe('selectPeriodsInAverageWindow', () => {
  test('incluye un periodo que termina a medianoche el mismo día de firstWeekUsed', () => {
    // Referencia con hora (no a medianoche): las semanas del historial quedan
    // ancladas a las 13:03:06, mientras que las fechas de los periodos son
    // de medianoche.
    const referenciaConHora = new Date(2026, 0, 15, 13, 3, 6);

    // Periodo reciente: termina a medianoche del 8 de enero, el MISMO día
    // calendario en que arranca la semana usada en el promedio.
    const reciente: SBCPeriod = {
      startDate: new Date(2025, 0, 1),
      endDate: new Date(2026, 0, 8),
      sbc: 300,
    };
    // Periodo antiguo: fuera de la ventana, no debe aparecer en la lista.
    const antiguo: SBCPeriod = {
      startDate: new Date(2024, 0, 1),
      endDate: new Date(2024, 5, 30),
      sbc: 100,
    };

    const summary = summarizeLastContributedWeeks(
      [reciente, antiguo],
      referenciaConHora,
      1,
    )!;

    // La semana usada arranca el 8 de enero a las 13:03:06 (hereda la hora
    // de la referencia) y el periodo termina a medianoche de ese mismo día.
    expect(summary.firstWeekUsed.getDate()).toBe(8);
    expect(summary.firstWeekUsed.getHours()).toBe(13);
    // El SBC del periodo SÍ cuenta en el promedio.
    expect(summary.averageSalary).toBe(300);

    const seleccion = selectPeriodsInAverageWindow([reciente, antiguo], summary);

    // El periodo reciente aparece en la lista: sus días están en la semana
    // usada y por lo tanto sí se consideran en el promedio.
    expect(seleccion).toEqual([reciente]);
    // El promedio no cambia por el filtro: sigue siendo el del periodo.
    expect(seleccion[0]!.sbc).toBe(summary.averageSalary);
  });
});

describe('patrones simultáneos', () => {
  test('suma los SBC de los patrones traslapados sin duplicar las semanas', () => {
    // Patrón A cubre 250 semanas a $100; patrón B se traslapa las últimas
    // 50 semanas con $500 → esas semanas valen $600, y siguen siendo 250.
    const summary = summarizeLastContributedWeeks(
      [periodoPorSemanas(0, 250, 100), periodoPorSemanas(0, 50, 500)],
      REFERENCIA,
    )!;

    expect(summary.selectedWeeks).toBe(250);
    expect(summary.contributedWeeks).toBe(250);
    // (200 × 100 + 50 × 600) / 250 = 200
    expect(summary.averageSalary).toBe(200);
  });

  test('traslape parcial: el segundo empleo suma su salario y NO duplica las semanas', () => {
    // Patrón A: 250 semanas a $100. Patrón B: un segundo empleo temporal de
    // 50 semanas que EMPIEZA Y TERMINA dentro de A (no está contenido en él):
    // es el caso real de un trabajo temporal mientras sigue el principal.
    const periodos = [periodoPorSemanas(0, 250, 100), periodoPorSemanas(50, 100, 500)];

    const soloA = summarizeLastContributedWeeks([periodoPorSemanas(0, 250, 100)], REFERENCIA)!;
    const conB = summarizeLastContributedWeeks(periodos, REFERENCIA)!;

    // (a) El SBC del tramo solapado es la SUMA de los dos patrones:
    // 200 semanas a $100 + 50 semanas a $600 → (20 000 + 30 000) / 250 = 200.
    expect(conB.averageSalary).toBe(200);
    // Con solo el patrón A el promedio sería $100: el segundo empleo pesa.
    expect(soloA.averageSalary).toBe(100);

    // La semana del tramo solapado vale la suma de los dos SBC.
    const history = buildContributionHistory(periodos, REFERENCIA);
    const semanaSolapada = getContributedWeeks(history).find(
      (w) => w.date.getTime() === REFERENCIA.getTime() - 75 * MS_PER_WEEK,
    );
    expect(semanaSolapada?.salaryBaseContribution).toBe(600);

    // (b) Las semanas NO se duplican: tener dos empleos no genera dos
    // semanas cotizadas.
    expect(conB.selectedWeeks).toBe(250);
    expect(conB.contributedWeeks).toBe(250);

    // (c) El historial no crece por tener dos patrones simultáneos.
    expect(conB.totalWeeksInHistory).toBe(soloA.totalWeeksInHistory);
    expect(conB.totalWeeksInHistory).toBe(250);
  });
});

// ─────────────────────────────────────────────
// Tramos con SBC efectivo
// ─────────────────────────────────────────────
//
// Un TRAMO es un intervalo en el que el conjunto de patrones concurrentes es el
// mismo. El SBC del tramo es el SUMA de los SBC de esos patrones (integración
// de salarios por empleo simultáneo) y las semanas siguen contando una sola
// vez. Es la MISMA cifra que ve la persona usuaria en el desglose.

describe('buildContributionSegments', () => {
  test('conserva una fila por periodo activo aunque dos patrones compartan nombre', () => {
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 11, 31),
        sbc: 600,
        employerName: 'EMPRESA COMPARTIDA',
      },
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 11, 31),
        sbc: 300,
        employerName: 'EMPRESA COMPARTIDA',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(1);
    expect(tramos[0]!.sbc).toBe(900);
    expect(tramos[0]!.employerNames).toEqual(['EMPRESA COMPARTIDA']);
    expect(tramos[0]!.employers).toEqual([
      { employerName: 'EMPRESA COMPARTIDA', sbc: 300 },
      { employerName: 'EMPRESA COMPARTIDA', sbc: 600 },
    ]);
  });

  test('un solo patrón con dos cambios de salario produce dos tramos con el SBC de cada uno', () => {
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 5, 30),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 6, 1),
        endDate: new Date(2024, 11, 31),
        sbc: 200,
        employerName: 'EMPRESA A',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(2);
    // De más reciente a más antigua.
    expect(tramos[0]!.startDate).toEqual(new Date(2024, 6, 1));
    expect(tramos[0]!.endDate).toEqual(new Date(2024, 11, 31));
    expect(tramos[0]!.sbc).toBe(200);
    expect(tramos[0]!.employerNames).toEqual(['EMPRESA A']);

    expect(tramos[1]!.startDate).toEqual(new Date(2024, 0, 1));
    expect(tramos[1]!.endDate).toEqual(new Date(2024, 5, 30));
    expect(tramos[1]!.sbc).toBe(100);
    expect(tramos[1]!.employerNames).toEqual(['EMPRESA A']);
  });

  test('conserva el SBC de cada patrón y no funde cuando cambia el reparto aunque el total y los nombres coincidan', () => {
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 5, 30),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 6, 1),
        endDate: new Date(2024, 11, 31),
        sbc: 200,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 5, 30),
        sbc: 200,
        employerName: 'EMPRESA B',
      },
      {
        startDate: new Date(2024, 6, 1),
        endDate: new Date(2024, 11, 31),
        sbc: 100,
        employerName: 'EMPRESA B',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(2);
    expect(tramos[0]).toMatchObject({
      startDate: new Date(2024, 6, 1),
      endDate: new Date(2024, 11, 31),
      sbc: 300,
      employerNames: ['EMPRESA A', 'EMPRESA B'],
      employers: [
        { employerName: 'EMPRESA A', sbc: 200 },
        { employerName: 'EMPRESA B', sbc: 100 },
      ],
    });
    expect(tramos[1]).toMatchObject({
      startDate: new Date(2024, 0, 1),
      endDate: new Date(2024, 5, 30),
      sbc: 300,
      employerNames: ['EMPRESA A', 'EMPRESA B'],
      employers: [
        { employerName: 'EMPRESA A', sbc: 100 },
        { employerName: 'EMPRESA B', sbc: 200 },
      ],
    });
  });

  test('dos patrones traslapados parcialmente: el tramo común suma los SBC y nombra ambos patrones', () => {
    // Patrón A: todo el año a $100. Patrón B: 3 semanas a $500 dentro de A.
    // Las semanas del tramo común valen $600, pero NO se duplican.
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 3),
        endDate: new Date(2024, 11, 24),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 6, 3),
        endDate: new Date(2024, 6, 23),
        sbc: 500,
        employerName: 'EMPRESA B',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    // Tres tramos: antes del traslape, el tramo común y después.
    expect(tramos).toHaveLength(3);

    // Tramo reciente: solo A.
    expect(tramos[0]!.employerNames).toEqual(['EMPRESA A']);
    expect(tramos[0]!.sbc).toBe(100);
    expect(tramos[0]!.startDate).toEqual(new Date(2024, 6, 24));
    expect(tramos[0]!.endDate).toEqual(new Date(2024, 11, 24));

    // Tramo común: A + B, con el SBC SUMADO.
    expect(tramos[1]!.employerNames).toEqual(['EMPRESA A', 'EMPRESA B']);
    expect(tramos[1]!.sbc).toBe(600);
    expect(tramos[1]!.startDate).toEqual(new Date(2024, 6, 3));
    expect(tramos[1]!.endDate).toEqual(new Date(2024, 6, 23));

    // Tramo antiguo: solo A (hasta el día anterior al inicio de B).
    expect(tramos[2]!.employerNames).toEqual(['EMPRESA A']);
    expect(tramos[2]!.sbc).toBe(100);
    expect(tramos[2]!.startDate).toEqual(new Date(2024, 0, 3));
    expect(tramos[2]!.endDate).toEqual(new Date(2024, 6, 2));
  });

  test('dos patrones NO traslapados producen dos tramos, cada uno con su patrón', () => {
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 5, 30),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 6, 1),
        endDate: new Date(2024, 11, 31),
        sbc: 200,
        employerName: 'EMPRESA B',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(2);
    expect(tramos[0]!.employerNames).toEqual(['EMPRESA B']);
    expect(tramos[0]!.sbc).toBe(200);
    expect(tramos[0]!.startDate).toEqual(new Date(2024, 6, 1));
    expect(tramos[0]!.endDate).toEqual(new Date(2024, 11, 31));

    expect(tramos[1]!.employerNames).toEqual(['EMPRESA A']);
    expect(tramos[1]!.sbc).toBe(100);
  });

  test('el promedio NO cambia al desglosar en tramos: el tramo común vale la suma', () => {
    // 51 semanas cotizadas: 48 a $100 y 3 a $600 (el tramo común A+B).
    // (48 × 100 + 3 × 600) / 51 = 129.41
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 3),
        endDate: new Date(2024, 11, 24),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 6, 3),
        endDate: new Date(2024, 6, 23),
        sbc: 500,
        employerName: 'EMPRESA B',
      },
    ];

    const summary = summarizeLastContributedWeeks(periodos, new Date(2025, 0, 1))!;

    expect(summary.contributedWeeks).toBe(51);
    expect(summary.averageSalary).toBe(129.41);

    // El tramo común muestra exactamente la misma suma que el motor promedia.
    const tramos = buildContributionSegments(periodos);
    const comun = tramos.find((tramo) => tramo.employerNames.length === 2)!;
    expect(comun.sbc).toBe(600);
  });

  test('sin periodos no hay tramos', () => {
    expect(buildContributionSegments([])).toEqual([]);
  });

  test('funde tramos contiguos del mismo patrón con el mismo SBC', () => {
    // Dos periodos del MISMO patrón, contiguos y con el mismo SBC: para el
    // usuario es un solo periodo de trabajo, no un corte artificial.
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 5, 30),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 5, 31),
        endDate: new Date(2024, 11, 31),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(1);
    expect(tramos[0]!.employerNames).toEqual(['EMPRESA A']);
    expect(tramos[0]!.sbc).toBe(100);
    expect(tramos[0]!.startDate).toEqual(new Date(2024, 0, 1));
    expect(tramos[0]!.endDate).toEqual(new Date(2024, 11, 31));
  });

  test('NO funde tramos contiguos si cambia el conjunto de patrones', () => {
    // Mismo SBC y contiguos, pero cambia el patrón: es un cambio real de
    // patrón y debe verse como dos periodos.
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 5, 30),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 5, 31),
        endDate: new Date(2024, 11, 31),
        sbc: 100,
        employerName: 'EMPRESA B',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(2);
    expect(tramos[0]!.employerNames).toEqual(['EMPRESA B']);
    expect(tramos[1]!.employerNames).toEqual(['EMPRESA A']);
  });

  test('funde tramos contiguos cuando el conjunto de patrones tiene distinta longitud', () => {
    // Un tramo con un patrón y otro con dos, pero con el MISMO SBC efectivo:
    // no se funden porque los conjuntos difieren en tamaño.
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 5, 30),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 5, 31),
        endDate: new Date(2024, 11, 31),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 5, 31),
        endDate: new Date(2024, 11, 31),
        sbc: 0,
        employerName: 'EMPRESA B',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(2);
    expect(tramos[0]!.employerNames).toEqual(['EMPRESA A', 'EMPRESA B']);
    expect(tramos[1]!.employerNames).toEqual(['EMPRESA A']);
  });

  test('los tramos ignoran los huecos sin cotización', () => {
    // Dos periodos separados por un hueco: el hueco no genera un tramo.
    const periodos: SBCPeriod[] = [
      {
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 2, 31),
        sbc: 100,
        employerName: 'EMPRESA A',
      },
      {
        startDate: new Date(2024, 8, 1),
        endDate: new Date(2024, 11, 31),
        sbc: 200,
        employerName: 'EMPRESA B',
      },
    ];

    const tramos = buildContributionSegments(periodos);

    expect(tramos).toHaveLength(2);
    expect(tramos[0]!.startDate).toEqual(new Date(2024, 8, 1));
    expect(tramos[1]!.endDate).toEqual(new Date(2024, 2, 31));
  });
});

describe('getLastRegisteredDailySalary', () => {
  test('devuelve el SBC del tramo más reciente', () => {
    const segmentos = [
      { startDate: new Date(2024, 0, 1), endDate: new Date(2024, 2, 31), sbc: 100 },
      { startDate: new Date(2025, 0, 1), endDate: new Date(2025, 2, 31), sbc: 300 },
    ];

    expect(getLastRegisteredDailySalary(segmentos, 250)).toBe(300);
  });

  test('sin historial devuelve el SBC capturado', () => {
    expect(getLastRegisteredDailySalary([], 250)).toBe(250);
  });

  test('ignora los tramos sin SBC válido', () => {
    const segmentos = [
      { startDate: new Date(2024, 0, 1), endDate: new Date(2024, 2, 31), sbc: 0 },
    ];

    expect(getLastRegisteredDailySalary(segmentos, 250)).toBe(250);
  });
});
