/**
 * Constantes de la Ley del Seguro Social de 1973 para el cálculo de pensiones.
 *
 * FUENTE PRINCIPAL: Ley del Seguro Social de 1973 (texto vigente al abrogarse),
 * Diario Oficial de la Federación, y criterios operativos del IMSS.
 *
 * NOTA LEGAL: Toda la información aquí contenida es de referencia. La resolución
 * oficial de pensiones corresponde exclusivamente al IMSS conforme a sus
 * procedimientos institucionales. Los resultados de esta aplicación son ESTIMACIONES.
 *
 * PROVENANCIA DOCUMENTAL (CHG-20261024-002 / US-005): cada constante exportada
 * lleva comentario de fuente (artículo de la Ley o Reglamento, publicación DOF
 * de origen) y vigencia aplicable. Al agregar o modificar una constante, ese
 * registro es un paso OBLIGATORIO del procedimiento: ver
 * docs/runbooks/05-actualizar-uma-y-constantes-legales.md (paso 5).
 */

import type { RiskClass } from '../models';

// ─────────────────────────────────────────────
// Tabla del Artículo 167 LSS 1973
// Cuantía básica e incrementos anuales por rango salarial
// ─────────────────────────────────────────────

/**
 * Entrada de la tabla del Art. 167 LSS 1973.
 * El SBC se expresa como múltiplos del Salario Mínimo General (SMG) diario.
 *
 * NOTA: La tabla del Art. 167 históricamente usa el SMG para determinar el rango.
 * El tope de cotización se aplica por separado (25 UMA desde reforma 2016).
 */
export interface Art167TableEntry {
  /** Límite inferior del rango (en veces el SMG diario) */
  rangeMin: number;
  /** Límite superior del rango (en veces el SMG diario). Infinity = sin límite */
  rangeMax: number;
  /**
   * Cuantía básica: porcentaje del SBC promedio (últimas 250 semanas)
   * correspondiente a 500 semanas de cotización.
   * Fuente: Tabla del Art. 167 LSS 1973.
   * ESTIMACIÓN: porcentajes interpolados de tabla oficial; verificar con IMSS.
   */
  basicQuantityPct: number;
  /**
   * Incremento por cada 52 semanas cotizadas adicionales a las 500 mínimas.
   * Fuente: Art. 167 LSS 1973, párrafo de incrementos anuales.
   * ESTIMACIÓN: verificar con IMSS.
   */
  annualIncrementPct: number;
}

/**
 * Tabla del Art. 167 LSS 1973 — Cuantía básica e incrementos anuales.
 *
 * Porcentajes conforme a la tabla del Art. 167 LSS 1973 para pensiones de
 * invalidez, vejez y cesantía en edad avanzada: cuantía básica para 500
 * semanas e incrementos anuales por cada 52 semanas excedentes.
 *
 * Fuente de referencia:
 * - Ley del Seguro Social 1973, Art. 167
 * - "Manual de Prestaciones" IMSS (versión vigente al 2023)
 */
export const ART167_TABLE: readonly Art167TableEntry[] = [
  {
    rangeMin: 0,
    rangeMax: 1.0,
    basicQuantityPct: 80.0,
    annualIncrementPct: 0.563,
  },
  {
    rangeMin: 1.01,
    rangeMax: 1.25,
    basicQuantityPct: 77.11,
    annualIncrementPct: 0.814,
  },
  {
    rangeMin: 1.26,
    rangeMax: 1.5,
    basicQuantityPct: 58.18,
    annualIncrementPct: 1.178,
  },
  {
    rangeMin: 1.51,
    rangeMax: 1.75,
    basicQuantityPct: 49.23,
    annualIncrementPct: 1.43,
  },
  {
    rangeMin: 1.76,
    rangeMax: 2.0,
    basicQuantityPct: 42.67,
    annualIncrementPct: 1.615,
  },
  {
    rangeMin: 2.01,
    rangeMax: 2.25,
    basicQuantityPct: 37.65,
    annualIncrementPct: 1.756,
  },
  {
    rangeMin: 2.26,
    rangeMax: 2.5,
    basicQuantityPct: 33.68,
    annualIncrementPct: 1.868,
  },
  {
    rangeMin: 2.51,
    rangeMax: 2.75,
    basicQuantityPct: 30.48,
    annualIncrementPct: 1.958,
  },
  {
    rangeMin: 2.76,
    rangeMax: 3.0,
    basicQuantityPct: 27.83,
    annualIncrementPct: 2.033,
  },
  {
    rangeMin: 3.01,
    rangeMax: 3.25,
    basicQuantityPct: 25.6,
    annualIncrementPct: 2.096,
  },
  {
    rangeMin: 3.26,
    rangeMax: 3.5,
    basicQuantityPct: 23.7,
    annualIncrementPct: 2.149,
  },
  {
    rangeMin: 3.51,
    rangeMax: 3.75,
    basicQuantityPct: 22.07,
    annualIncrementPct: 2.195,
  },
  {
    rangeMin: 3.76,
    rangeMax: 4.0,
    basicQuantityPct: 20.65,
    annualIncrementPct: 2.235,
  },
  {
    rangeMin: 4.01,
    rangeMax: 4.25,
    basicQuantityPct: 19.39,
    annualIncrementPct: 2.271,
  },
  {
    rangeMin: 4.26,
    rangeMax: 4.5,
    basicQuantityPct: 18.29,
    annualIncrementPct: 2.302,
  },
  {
    rangeMin: 4.51,
    rangeMax: 4.75,
    basicQuantityPct: 17.3,
    annualIncrementPct: 2.33,
  },
  {
    rangeMin: 4.76,
    rangeMax: 5.0,
    basicQuantityPct: 16.41,
    annualIncrementPct: 2.355,
  },
  {
    rangeMin: 5.01,
    rangeMax: 5.25,
    basicQuantityPct: 15.61,
    annualIncrementPct: 2.377,
  },
  {
    rangeMin: 5.26,
    rangeMax: 5.5,
    basicQuantityPct: 14.88,
    annualIncrementPct: 2.398,
  },
  {
    rangeMin: 5.51,
    rangeMax: 5.75,
    basicQuantityPct: 14.22,
    annualIncrementPct: 2.416,
  },
  {
    rangeMin: 5.76,
    rangeMax: 6.0,
    basicQuantityPct: 13.62,
    annualIncrementPct: 2.433,
  },
  {
    rangeMin: 6.01,
    rangeMax: Infinity,
    basicQuantityPct: 13.0,
    annualIncrementPct: 2.45,
  },
] as const;

/**
 * Días promedio por mes para conversión mensual de UMA.
 * Fuente: Ley para Determinar el Valor de la UMA, Art. 9 (el valor mensual se
 * obtiene multiplicando el diario por 30.4).
 * Publicación: DOF 27-ene-2016. Vigente — factor fijado por la propia ley.
 */
export const AVERAGE_DAYS_PER_MONTH = 30.4;

/**
 * Días por año para cálculo anual de UMA.
 * Fuente: Ley para Determinar el Valor de la UMA, Art. 9 (el valor anual se
 * obtiene multiplicando el diario por 365).
 * Publicación: DOF 27-ene-2016. Vigente — factor fijado por la propia ley.
 */
export const DAYS_PER_YEAR_UMA = 365;

/**
 * Meses por año para cálculo anual de pensión.
 * Fuente: constante aritmética — sin fundamento normativo (conversión de la
 * cuantía mensual a anual). Aplica para todo año de calendario.
 */
export const MONTHS_PER_YEAR = 12;

// ─────────────────────────────────────────────
// Factores de edad — Cesantía en Edad Avanzada
// Art. 171 LSS 1973
// ─────────────────────────────────────────────

/**
 * Factor de reducción por retiro anticipado (Cesantía en Edad Avanzada).
 *
 * Art. 171 LSS 1973: "Cuantía de la pensión expresada en % de la cuantía de la
 * pensión de vejez que le hubiera correspondido al asegurado de haber alcanzado
 * 65 años": 60 → 75 %, 61 → 80 %, 62 → 85 %, 63 → 90 %, 64 → 95 %.
 *
 * Párrafo final del mismo artículo (DOF 12-mar-1973): "Se aumentará un año a
 * los cumplidos cuando la edad los exceda en seis meses." Esa regla la aplica
 * el motor al calcular la EDAD LEGAL (ver `calculateLegalAge` en utils/date.ts).
 *
 * Fuente: Art. 171 LSS 1973 (DOF 12-mar-1973 y sus reformas).
 */
export const CESANTIA_AGE_FACTORS: Readonly<Record<number, number>> = {
  60: 0.75,
  61: 0.8,
  62: 0.85,
  63: 0.9,
  64: 0.95,
  65: 1.0, // Pensión de vejez = 100%
} as const;

/**
 * Edad mínima para Cesantía en Edad Avanzada.
 * Fuente: Art. 145 LSS 1973 (500 semanas cotizadas, 60 años cumplidos y estar
 * privado de trabajo). Publicación: DOF 12-mar-1973 (LSS 1973 y reformas).
 * Vigencia: régimen de transición (asegurados en el régimen Ley 73 — alcance
 * explícito de esta app).
 */
export const MINIMUM_CESANTIA_AGE = 60;

/**
 * Edad para Pensión de Vejez.
 * Fuente: Art. 138 LSS 1973 (500 semanas cotizadas y 65 años cumplidos).
 * Publicación: DOF 12-mar-1973 (LSS 1973 y reformas).
 * Vigencia: régimen de transición (alcance de esta app).
 */
export const VEJEZ_AGE = 65;

// ─────────────────────────────────────────────
// Semanas mínimas de cotización
// ─────────────────────────────────────────────

/**
 * Semanas mínimas de cotización para Pensión de Vejez.
 * Fuente: Art. 138 LSS 1973. Publicación: DOF 12-mar-1973 (y reformas).
 * Vigencia: régimen de transición (alcance de esta app).
 */
export const MINIMUM_WEEKS_VEJEZ = 500;

/**
 * Semanas mínimas de cotización para Cesantía en Edad Avanzada.
 * Fuente: Art. 145 LSS 1973. Publicación: DOF 12-mar-1973 (y reformas).
 * Vigencia: régimen de transición (alcance de esta app).
 */
export const MINIMUM_WEEKS_CESANTIA = 500;

/**
 * Semanas consideradas para el promedio del SBC (últimas 250 semanas cotizadas
 * dentro de los 5 años anteriores a la fecha de referencia).
 * Fuente: Art. 167 LSS 1973. Publicación: DOF 12-mar-1973 (y reformas).
 */
export const SBC_AVERAGE_WEEKS = 250;

/**
 * Semanas que representan un año cotizado (base de los incrementos anuales).
 * Fuente: Art. 167 LSS 1973 — el incremento procede "por cada año completo"
 * de cotización excedente, entendido como 52 semanas (criterio operativo IMSS).
 * Publicación: DOF 12-mar-1973 (y reformas).
 */
export const WEEKS_PER_YEAR = 52;

/**
 * Semanas promedio por mes (52 ÷ 12), para proyectar meses de Modalidad 40 a semanas.
 * Fuente: derivada de WEEKS_PER_YEAR (52 semanas/año, criterio operativo IMSS,
 * Art. 167 LSS 1973). No es un valor normativo independiente.
 */
export const WEEKS_PER_MONTH = WEEKS_PER_YEAR / 12;

// ─────────────────────────────────────────────
// Asignaciones familiares y ayuda asistencial
// Arts. 163–165 LSS 1973
// ─────────────────────────────────────────────

/**
 * Asignación familiar por cónyuge o concubina/o (15% de la cuantía).
 * Fuente: Art. 164, fracción I, LSS 1973.
 * Publicación: DOF 12-mar-1973 (y reformas). Vigencia: régimen de transición.
 */
export const SPOUSE_ALLOWANCE_PCT = 0.15;

/**
 * Asignación familiar por cada hijo menor (hasta 16 años, o sin límite si incapacitado)
 * — 10% de la cuantía por hijo.
 * Fuente: Art. 164, fracción II, LSS 1973.
 * Publicación: DOF 12-mar-1973 (y reformas). Vigencia: régimen de transición.
 */
export const CHILD_ALLOWANCE_PCT = 0.10;

/**
 * Asignación familiar por cada ascendiente dependiente económico (10% de la
 * cuantía por ascendiente, cuando no hay cónyuge ni hijos).
 * Fuente: Art. 164, fracción III, LSS 1973.
 * Publicación: DOF 12-mar-1973 (y reformas). Vigencia: régimen de transición.
 */
export const PARENT_ALLOWANCE_PCT = 0.10;

/**
 * Ayuda asistencial (15% de la cuantía) cuando no hay beneficiarios con derecho
 * a asignación familiar.
 * Fuente: Art. 165 LSS 1973.
 * Publicación: DOF 12-mar-1973 (y reformas). Vigencia: régimen de transición.
 */
export const ASSISTANCE_AID_NO_BENEFICIARIES_PCT = 0.15;

/**
 * Ayuda asistencial (10% de la cuantía) cuando el pensionado tiene cónyuge pero
 * no hijos.
 * Fuente: Art. 165 LSS 1973. Nota: aplica en ausencia de los beneficiarios
 * mencionados en Art. 164.
 * Publicación: DOF 12-mar-1973 (y reformas). Vigencia: régimen de transición.
 */
export const ASSISTANCE_AID_SPOUSE_NO_CHILDREN_PCT = 0.10;

// ─────────────────────────────────────────────
// Límites
// ─────────────────────────────────────────────

/**
 * Tope máximo del SBC en veces UMA (diaria).
 * Fuente: Art. 28 LSS vigente (reforma DOF 27-ene-2016, derogación de referencias al SMG).
 * La cotización máxima es de 25 UMA diarias.
 */
export const SBC_CAP_TIMES_UMA = 25;

/**
 * La pensión mínima garantizada equivale al salario mínimo general vigente.
 * Art. 170 LSS 1973. Se actualiza conforme al SMG en vigor.
 * Publicación: DOF 12-mar-1973 (y reformas). Vigencia: régimen de transición.
 *
 * NOTA: El IMSS usa el SMG de la zona del trabajador.
 * Para efectos de estimación se usa el SMG de CDMX (más alto).
 */
export const PMG_EQUALS_SMG = true;

// ─────────────────────────────────────────────
// Conservación de derechos
// ─────────────────────────────────────────────

/**
 * Período de conservación de derechos (Art. 182 LSS 1973).
 * Si el asegurado tiene 500+ semanas y deja de cotizar, conserva el derecho
 * durante un período igual a la cuarta parte del tiempo cotizado.
 * Máximo: 60 semanas (salvo disposición específica).
 *
 * Este cálculo aplica para determinar vigencia de la pensión.
 * Publicación: DOF 12-mar-1973 (y reformas). Vigencia: régimen de transición.
 */
export const RIGHTS_PRESERVATION_FRACTION = 0.25;
// 60 semanas — criterio operativo IMSS de referencia (el Art. 182 fija la
// fórmula; el tope práctico de 60 semanas no proviene de un texto legal directo).
export const RIGHTS_PRESERVATION_MAX_WEEKS = 60;

// ─────────────────────────────────────────────
// Incremento del 11% (Decreto DOF 2001/2004)
// ─────────────────────────────────────────────

/**
 * Incremento del 11% aplicado a la cuantía de la pensión Ley 73
 * (cuantía básica + incrementos anuales), previo al factor de edad.
 *
 * Fuente: Decreto por el que se reforman y adicionan los artículos Décimo
 * Cuarto y Vigésimo Cuarto Transitorios del Decreto que reforma y adiciona
 * diversas disposiciones de la Ley del Seguro Social.
 * DOF: 20 de diciembre de 2001. Modificación: DOF 5 de enero de 2004.
 * https://www.diputados.gob.mx/LeyesBiblio/ref/lss/LSS_ref04_05ene04.pdf
 */
export const DECREE_11_INCREMENT = 0.11;

// ─────────────────────────────────────────────
// Incremento anual post-retiro por inflación (comparativa M10 vs pensionarse antes)
// ─────────────────────────────────────────────

/**
 * Incremento anual post-retiro por inflación (promedio INPC 2022–2026).
 *
 * Las pensiones del régimen de la Ley 73 en curso de pago se incrementan
 * cada febrero conforme a la inflación (INPC) del año anterior. Para la
 * comparativa «contratar Modalidad 10 vs pensionarse lo antes posible» se
 * usa una constante fija: el promedio aritmético simple de los incrementos
 * de los últimos 5 años (febrero 2022 a febrero 2026) ≈ 5.55% anual.
 *
 * ⚠️ ESTIMACIÓN: valor de modelado; NO es una proyección neutral ni una
 * garantía de los próximos años. El dato de 2025 (+3.69%) queda pendiente de
 * confirmación contra el INPC publicado por INEGI (NOTE-004).
 *
 * Fuente: docs/investigacion/incremento-anual-pensiones-ley73-decretos.md.
 * Vigencia: referencia a la serie 2022–2026; revisar anualmente según el
 * runbook 05 (docs/runbooks/05-actualizar-uma-y-constantes-legales.md).
 */
export const ANNUAL_POST_RETIREMENT_INCREMENT = 0.0555; // ESTIMACIÓN

// ─────────────────────────────────────────────
// Modalidad 10 — incorporación voluntaria al régimen obligatorio
// ─────────────────────────────────────────────

/**
 * Fundamento de la Modalidad 10: la incorporación voluntaria al régimen
 * obligatorio, que se hace por convenio (capítulo IX de la LSS vigente,
 * Arts. 222 a 233) y cuyos sujetos son los del Art. 13 fr. I — trabajadores
 * independientes o por cuenta propia (fracción reformada DOF 01-dic-2023).
 *
 * La base de las cuotas son los ingresos reportados por la persona
 * asegurada, acotados por los límites del Art. 28 (Art. 227 fr. I).
 *
 * Fuente: Ley del Seguro Social vigente, texto de la Cámara de Diputados,
 * última reforma DOF 15-ene-2026.
 */
export const MODALIDAD_10_ARTICLE = 'Art. 222 LSS vigente (incorporación voluntaria)';

/**
 * El SBC de la Modalidad 10 no puede ser inferior al salario mínimo general
 * del área geográfica del trabajador.
 * Fuente: Art. 28 LSS vigente — "…estableciéndose como límite superior el
 * equivalente a veinticinco veces el salario mínimo general que rija en el
 * Distrito Federal y como límite inferior el salario mínimo general del área
 * geográfica respectiva". La misma regla aparece en el Art. 33 LSS 1973.
 *
 * NOTA: el piso real depende de la zona geográfica. La app no la conoce y usa
 * el SMG de la Zona A (CDMX), que es el más alto y por tanto el piso más
 * restrictivo — el mismo criterio que ya se aplica a la pensión mínima
 * garantizada (`PMG_EQUALS_SMG`).
 */
export const MODALIDAD_10_MINIMUM_IS_SMG_OF_ZONE = true;

/**
 * Tope máximo del SBC de la Modalidad 10: 25 UMA diarias, el mismo límite de
 * cotización del régimen obligatorio.
 * Fuente: Art. 28 LSS vigente (límite superior) y Art. 227 fr. I (los límites
 * del Art. 28 aplican al cálculo de las cuotas de la incorporación voluntaria).
 */
export const MODALIDAD_10_CAP_TIMES_UMA = 25;

/**
 * Prima de Riesgos de Trabajo por clase laboral (Art. 71 LSS vigente, tabla de
 * primas de RT). Es el componente de la cuota de Modalidad 10 que varía según
 * la ocupación de la persona asegurada. Valores oficiales.
 *
 * La estructura completa de la cuota (tasas por ramo, excedente sobre 3 UMA y
 * tabla de cesantía y vejez) vive en `src/constants/modalidad10Cuota.ts`.
 */
export const MODALIDAD_10_RT_PRIMA: Record<RiskClass, number> = {
  1: 0.0054355,
  2: 0.0113065,
  3: 0.025984,
  4: 0.0465325,
  5: 0.0758875,
};

/** Etiquetas legibles de cada clase de riesgo laboral. */
export const MODALIDAD_10_RISK_CLASS_LABELS: Record<RiskClass, string> = {
  1: 'Clase I — riesgo mínimo',
  2: 'Clase II — riesgo bajo',
  3: 'Clase III — riesgo medio',
  4: 'Clase IV — riesgo alto',
  5: 'Clase V — riesgo máximo',
};

/**
 * Contexto normativo (no altera el cálculo de esta app): el Acuerdo
 * ACDO.AS2.HCT.101026/302.P.DG del Consejo Técnico del IMSS, aprobado el
 * 10-oct-2026 y publicado en el DOF el 21-oct-2026 (vigente desde el
 * 22-oct-2026), endureció las nuevas inscripciones a la Modalidad 40 —salario
 * de cotización igual al último registrado o hasta una UMA por encima— y
 * prohibió los pagos retroactivos.
 *
 * Ese acuerdo NO modifica la Modalidad 10; sí explica por qué el asegurado
 * del régimen anterior conviene a la Modalidad 10 y por qué esta app no ofrece
 * meses retroactivos (la cotización arranca el mes siguiente a la fecha de
 * referencia, Art. 224 LSS vigente).
 */
