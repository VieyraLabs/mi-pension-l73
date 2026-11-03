/**
 * Cuota de la Modalidad 10 (incorporación voluntaria al régimen obligatorio
 * para personas trabajadoras independientes).
 *
 * FUENTE PRIMARIA
 *
 * 1. **Calculadora oficial del IMSS para Personas Trabajadoras Independientes**
 *    (Modalidad 10), versión de marzo de 2026:
 *    `https://www.imss.gob.mx/sites/all/statics/trabajadores-independientes/calculadoraPTI-0326.js`
 *    La función `calculoCuotas(salario, numDias)` es la fórmula que el propio
 *    Instituto aplica para emitir la línea de captura: se reproduce aquí
 *    componente por componente.
 * 2. **Anexo A del Informe al Consejo Técnico del IMSS 2025-2026**, Cuadro A.3
 *    "Esquema de financiamiento por tipo de seguro, diciembre de 2025" (p. 242):
 *    `https://www.imss.gob.mx/sites/all/statics/pdf/informes/20252026/15-anexos.pdf`
 *    (tasas por ramo y tabla de cesantía y vejez, nota 6).
 *
 * NOTA LEGAL: cifras de referencia; la línea de captura que emite el IMSS es la
 * que cobra. La aportación a INFONAVIT (5 % del SBC) **no** se incluye: es
 * ahorro para vivienda, no una prima de financiamiento (Art. 228 LSS vigente).
 *
 * NOTA DE MODELADO: la calculadora oficial multiplica por los días reales del
 * periodo de pago; la app usa 30.4 días por mes (su convención para el SBC
 * mensual), de modo que el monto puede diferir unos puntos de la línea de
 * captura oficial.
 */

/**
 * Tasas de la cuota de la Modalidad 10, como fracción (0.015 = 1.5 %).
 *
 * Cada rama de la cuota se separa en su parte patronal y su parte obrera: en
 * la Modalidad 10 la persona asegurada cotiza por sí misma y paga las dos
 * partes (el Gobierno Federal no aparece: su aportación es la cuota social del
 * ramo de cesantía y vejez, que el IMSS fondea).
 */
export interface M10CuotaRates {
  /** SEM — cuota fija: 20.40 % de la UMA (parte patronal). */
  semCuotaFijaUmaPct: number;
  /** SEM — cuota excedente patronal: 1.10 % del excedente sobre 3 UMA. */
  semCuotaExcedentePatronalPct: number;
  /** SEM — cuota excedente obrera: 0.40 % del excedente sobre 3 UMA. */
  semCuotaExcedenteObreraPct: number;
  /** SEM — prestaciones en dinero, parte patronal: 0.70 % del SBC. */
  semPrestacionesDineroPatronalPct: number;
  /** SEM — prestaciones en dinero, parte obrera: 0.25 % del SBC. */
  semPrestacionesDineroObreraPct: number;
  /** SEM — gastos médicos para pensionados, parte patronal: 1.05 % del SBC. */
  semGastosMedicosPensionadosPatronalPct: number;
  /** SEM — gastos médicos para pensionados, parte obrera: 0.375 % del SBC. */
  semGastosMedicosPensionadosObreraPct: number;
  /** Seguro de Invalidez y Vida, parte patronal: 1.75 % del SBC. */
  invalidezVidaPatronalPct: number;
  /** Seguro de Invalidez y Vida, parte obrera: 0.625 % del SBC. */
  invalidezVidaObreraPct: number;
  /** Seguro de Guarderías y Prestaciones Sociales: 1.00 % del SBC. */
  guarderiasPrestacionesSocialesPct: number;
  /** Seguro de Retiro: 2.00 % del SBC. */
  retiroPct: number;
  /** Seguro de Cesantía y Vejez, parte obrera: 1.125 % del SBC. */
  cesantiaVejezObreraPct: number;
}

/**
 * Tasas de la Modalidad 10.
 * Fuente: calculadora oficial del IMSS (`calculoCuotas`) y Cuadro A.3 del
 * Anexo A al Informe al Consejo Técnico 2025-2026 (las dos Rates coinciden
 * rama por rama con la tabla del Cuadro).
 */
export const M10_CUOTA_RATES: M10CuotaRates = {
  semCuotaFijaUmaPct: 0.204,
  semCuotaExcedentePatronalPct: 0.011,
  semCuotaExcedenteObreraPct: 0.004,
  semPrestacionesDineroPatronalPct: 0.007,
  semPrestacionesDineroObreraPct: 0.0025,
  semGastosMedicosPensionadosPatronalPct: 0.0105,
  semGastosMedicosPensionadosObreraPct: 0.00375,
  invalidezVidaPatronalPct: 0.0175,
  invalidezVidaObreraPct: 0.00625,
  guarderiasPrestacionesSocialesPct: 0.01,
  retiroPct: 0.02,
  cesantiaVejezObreraPct: 0.01125,
};

/**
 * Excedente sobre el que se cobra la cuota excedente del Seguro de
 * Enfermedades y Maternidad: 3 UMA.
 * Fuente: Cuadro A.3, nota de la cuota excedente ("Total del SBC menos 3 UMA").
 */
export const M10_SEM_EXCEDENTE_UMAS = 3;

/**
 * Aportación al fondo de vivienda que la Modalidad 10 **no** incluye.
 * Es opcional y separada del bolts-and-nuts de la cuota obrero patronal.
 * Fuente: portal del IMSS, Personas Trabajadoras Independientes ("Beneficios
 * INFONAVIT… 5 % de tu ingreso reportado").
 */
export const M10_INFONAVIT_PCT = 0.05;

/**
 * La cuota mostrada NO incluye la aportación opcional a INFONAVIT.
 * Es un ahorro para vivienda, no una prima de financiamiento, y el Art. 228
 * de la LSS vigente ordena reducir la parte proporcional de las prestaciones
 * que se excluyen.
 */
export const MODALIDAD_10_CUOTA_EXCLUDES_INFONAVIT = true;

/**
 * Banda de la tasa de cesantía y vejez, según el nivel salarial.
 *
 * La tasa crece por tramos de salario de referencia (Art. 168 fr. II de la
 * LSS vigente) y el Cuadro A.3 la publica con valores por año.
 */
export interface M10CesantiaBand {
  /** Etiqueta legible de la banda. */
  label: string;
  /**
   * Tasa de cesantía y vejez en % del SBC, por año contado desde
   * `M10_CESANTIA_FIRST_YEAR`.
   */
  rates: number[];
}

/** Primer año con columna publicada en la tabla de cesantía y vejez. */
export const M10_CESANTIA_FIRST_YEAR = 2022;

/**
 * Umbrales de las bandas de cesantía y vejez, en múltiplos de la UMA.
 * El primer umbral abre la banda 1 (la banda 0 es el salario mínimo exacto
 * de la zona) y el último cierra la banda 7.
 */
export const M10_CESANTIA_BAND_THRESHOLDS_UMAS = [1.51, 2.01, 2.51, 3.01, 3.51, 4.01];

/**
 * Tabla de cesantía y vejez de la Modalidad 10.
 *
 * Fuente: calculadora oficial del IMSS (`tablaCPat`, año 2026) y Cuadro A.3
 * del Anexo A al Informe al Consejo Técnico 2025-2026, nota 6 (valores de
 * diciembre de 2025).
 *
 * La columna 0 corresponde a 2022 y la última a 2030. Para los años anteriores
 * a 2022 se usa la columna de 2022 (la más antigua publicada).
 */
export const M10_CESANTIA_BANDS: M10CesantiaBand[] = [
  {
    label: 'Salario mínimo de la zona',
    rates: [3.15, 3.15, 3.15, 3.15, 3.15, 3.15, 3.15, 3.15, 3.15],
  },
  {
    label: 'De 1.01 SM a 1.5 UMA',
    rates: [3.15, 3.281, 3.413, 3.544, 3.676, 3.807, 3.939, 4.07, 4.202],
  },
  {
    label: 'De 1.51 a 2 UMA',
    rates: [3.15, 3.575, 4.0, 4.426, 4.851, 5.276, 5.701, 6.126, 6.552],
  },
  {
    label: 'De 2.01 a 2.5 UMA',
    rates: [3.15, 3.751, 4.353, 4.954, 5.556, 6.157, 6.759, 7.36, 7.962],
  },
  {
    label: 'De 2.51 a 3 UMA',
    rates: [3.15, 3.869, 4.588, 5.307, 6.026, 6.745, 7.464, 8.183, 8.902],
  },
  {
    label: 'De 3.01 a 3.5 UMA',
    rates: [3.15, 3.953, 4.756, 5.559, 6.361, 7.164, 7.967, 8.77, 9.573],
  },
  {
    label: 'De 3.51 a 4 UMA',
    rates: [3.15, 4.016, 4.882, 5.747, 6.613, 7.479, 8.345, 9.211, 10.077],
  },
  {
    label: 'Más de 4 UMA',
    rates: [3.15, 4.241, 5.331, 6.422, 7.513, 8.603, 9.694, 10.784, 11.875],
  },
];
