/**
 * Parser de datos personales de la Constancia de Semanas Cotizadas del IMSS.
 * Implementa el patrón Strategy para permitir agregar otros parsers de documentos.
 *
 * NOTA: El IMSS puede cambiar el formato del documento. Este parser se basa
 * en los patrones comunes observados en constancias digitales (no escaneadas).
 */
import type { ExtractedData, ParseResult, DocumentType, EmploymentRelation } from '../../../models';
import {
  buildContributionSegments,
  selectSegmentsInAverageWindow,
  summarizeLastContributedWeeks,
  type SBCPeriod,
} from '../../pension/history';

/** Interfaz común para todos los parsers de documentos. */
export interface DocumentParser<T> {
  readonly documentType: DocumentType;
  canHandle(text: string): boolean;
  parse(text: string): ParseResult<T>;
}

/** Parser de la Constancia de Semanas Cotizadas IMSS. */
export const ConstanciaIMSSParser: DocumentParser<ExtractedData> = {
  documentType: 'constancia_semanas_imss',

  canHandle(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('imss') &&
      (lower.includes('semanas cotizadas') || lower.includes('constancia'))
    );
  },

  parse(text: string): ParseResult<ExtractedData> {
    const warnings: string[] = [];
    const missingFields: string[] = [];

    const data: ExtractedData = {
      employmentRelations: [],
    };

    // ─── Nombre ───────────────────────────────────────────
    // NOTA IMPORTANTE: el orden de texto que entrega la extracción de PDF
    // (pdfjs-dist) sigue el orden de dibujado del content stream, NO el
    // orden visual de lectura. En la Constancia de Semanas Cotizadas, el
    // nombre del asegurado puede aparecer intercalado entre otras etiquetas
    // (p. ej. entre "NSS:" y el número de NSS) en vez de justo después de
    // un rótulo "Nombre:". Por eso se prueban varias estrategias en orden
    // de confiabilidad, en vez de asumir adyacencia estricta.
    data.name = extractName(text) ?? undefined;
    if (!data.name) {
      missingFields.push('Nombre');
    }

    // ─── CURP ───────────────────────────────────────────
    const curpMatch = text.match(/\b([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)\b/);
    if (curpMatch?.[1]) {
      data.curp = curpMatch[1];
    } else {
      missingFields.push('CURP');
    }

    // ─── NSS ───────────────────────────────────────────
    // El valor no siempre está inmediatamente después de la etiqueta (puede
    // haber otro texto intercalado por el orden de extracción); se busca en
    // una ventana posterior a la etiqueta en vez de exigir adyacencia.
    const nssValue = findValueAfterLabel(text, /(?:nss|n\.s\.s\.|número de seguridad social)/i, /\b(\d{10,11})\b/);
    if (nssValue) {
      data.nss = nssValue;
    } else {
      missingFields.push('NSS');
    }

    // ─── Fecha de nacimiento ───────────────────────────────────────────
    const birthDateMatch = text.match(
      /(?:fecha de nacimiento|nacimiento)[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/i,
    );
    if (birthDateMatch?.[1]) {
      const dateStr = birthDateMatch[1];
      const date = new Date(dateStr + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        data.birthDate = date;
      }
    } else if (data.curp) {
      // La Constancia de Semanas Cotizadas no incluye un campo explícito de
      // fecha de nacimiento, pero el CURP la codifica en sus primeros 6
      // dígitos (AAMMDD).
      const dateFromCurp = birthDateFromCurp(data.curp);
      if (dateFromCurp) {
        data.birthDate = dateFromCurp;
        warnings.push(
          'La fecha de nacimiento se infirió del CURP (este documento no la incluye directamente). Verifícala.',
        );
      } else {
        missingFields.push('Fecha de nacimiento');
      }
    } else {
      missingFields.push('Fecha de nacimiento');
    }

    // ─── Semanas cotizadas ───────────────────────────────────────────
    const weeksMatch = text.match(
      /(?:semanas\s+(?:cotizadas|reconocidas|acreditadas))[:\s]*(\d{1,5})/i,
    );
    if (weeksMatch?.[1]) {
      data.totalWeeks = parseInt(weeksMatch[1]);
    } else {
      missingFields.push('Semanas cotizadas');
    }

    // ─── Último SBC ───────────────────────────────────────────
    // No se ancla a la etiqueta "Salario Base de Cotización": el orden de
    // extracción de pdfjs-dist puede intercalar una fecha (también
    // numérica, p. ej. "16/01/2021") entre la etiqueta y su monto, y una
    // búsqueda sin el signo "$" puede capturar el día/mes de esa fecha en
    // vez del monto real. En este documento el signo "$" solo antecede a
    // montos de SBC, así que se busca directamente en todo el texto. Se
    // asume que el primer monto encontrado corresponde al registro más
    // reciente (los patrones se listan en orden reverso-cronológico).
    const sbcMatch = text.match(/\$\s*(\d{1,6}(?:[.,]\d{1,4})?)/);
    if (sbcMatch?.[1]) {
      const value = parseFloat(sbcMatch[1].replace(',', '.'));
      if (!isNaN(value) && value > 0) {
        data.lastSBC = value;
      } else {
        missingFields.push('Último SBC');
      }
    } else {
      missingFields.push('Último SBC');
    }

    // ─── SBC promedio (últimas 250 semanas) ───────────────────────────────
    // Solo se calcula cuando la constancia trae, por cada patrón, la tabla
    // de movimientos (REINGRESO / ALTA / MODIFICACIÓN DE SALARIO / BAJA) con el
    // historial completo de cambios salariales. Sin esa tabla, la única
    // alternativa sería aproximar con el último SBC de cada patrón — pero
    // eso puede diferir mucho del promedio real, así que se prefiere no
    // inventar un número y en cambio pedir la constancia correcta.
    const workHistoryResult = extractWorkHistory(text);
    data.employmentRelations = workHistoryResult.relations;
    if (workHistoryResult.omittedMostRecent) {
      warnings.push(
        'No se pudo determinar cuándo terminó tu empleo más reciente (no aparece marcado como "Vigente"), ' +
          'así que no se incluyó en el cálculo del SBC promedio. Verifica el promedio manualmente.',
      );
    }
    if (workHistoryResult.unattributedAmounts > 0) {
      // Montos que no sabemos a qué patrón ni a qué movimiento pertenecen:
      // casi siempre es una fila de un tipo de movimiento que el parser aún
      // no conoce. Se dice en voz alta en vez de ignorarlo en silencio.
      const cuantos = workHistoryResult.unattributedAmounts;
      warnings.push(
        `Detectamos ${cuantos} ${cuantos === 1 ? 'monto' : 'montos'} del documento que no correspondieron ni a un patrón ni a un movimiento reconocido; ` +
          'es posible que la constancia traiga un tipo de movimiento que la app todavía no conoce. Verifica el SBC promedio.',
      );
    }
    if (workHistoryResult.usedDetailedData) {
      // Exponer el detalle ya reconstruido: la UI lo muestra tal cual, sin
      // recalcularlo (una sola fuente de verdad — RNF-013, ADR-0010).
      //
      // CONTRATO de `data.sbcPeriods`: expone los TRAMOS del desglose (cada
      // uno con el SBC EFECTIVO: la suma de los patrones concurrentes) que
      // entran al promedio de las últimas 250 semanas cotizadas, de MÁS
      // RECIENTE A MÁS ANTIGUA. Un empleo anterior a esa ventana (p. ej. uno
      // de 2000) no pesa en el cálculo y por eso no se muestra. El CÁLCULO, en
      // cambio, sigue usando TODOS los periodos reconstruidos: el historial
      // completo es lo que permite saltar los huecos laborales y alcanzar las
      // 250 semanas cotizadas.
      data.sbcPeriods = buildContributionSegments(workHistoryResult.periods);
      // Últimas 250 semanas COTIZADAS (Art. 167 LSS 1973): los periodos sin
      // cotización se saltan y el recorrido sigue hacia atrás, en vez de
      // tomar las últimas 250 semanas calendario.
      const summary = summarizeLastContributedWeeks(
        workHistoryResult.periods,
        workHistoryResult.referenceDate,
      );
      if (summary) {
        data.sbcPeriods = selectSegmentsInAverageWindow(data.sbcPeriods, summary);
        if (data.sbcPeriods.length > 0) {
          data.lastSBC = data.sbcPeriods[0]!.sbc;
        }
        data.averageSBC = summary.averageSalary;
        data.contributionSummary = summary;
        warnings.push(
          `SBC promedio de las últimas 250 semanas cotizadas: $${data.averageSBC.toFixed(2)} (calculado a partir del historial detallado de modificaciones salariales de tus patrones). Verifica este valor.` +
            (summary.isComplete
              ? ''
              : ` Tu historial solo registra ${summary.contributedWeeks} semanas cotizadas, menos de las 250 que exige el cálculo; el promedio se obtuvo con las disponibles.`) +
            (summary.skippedWeeks > 0
              ? ` Se omitieron ${summary.skippedWeeks} semanas sin cotización (periodos sin patrón), que no cuentan para el promedio.`
              : '') +
            (workHistoryResult.hadOverlap
              ? ' Detectamos periodos con más de un patrón simultáneo; para esos días se sumaron los SBC de los patrones, sin duplicar las semanas cotizadas.'
              : '') +
            (workHistoryResult.usesPastReferenceDate
              ? ` Como tu historial no indica que sigas cotizando actualmente, se usó tu fecha de baja más reciente (${workHistoryResult.referenceDate.toLocaleDateString('es-MX')}) como referencia en vez de la fecha de hoy.`
              : ''),
        );
      } else {
        missingFields.push('SBC promedio (250 semanas)');
        warnings.push(
          'El historial detallado de modificaciones salariales de tus patrones no registra ninguna semana cotizada; ' +
            'no fue posible calcular el SBC promedio. Complétalo manualmente.',
        );
      }
    } else {
      missingFields.push('SBC promedio (250 semanas)');
      if (workHistoryResult.hasMovementTable) {
        // El documento SÍ trae la tabla de movimientos: no lo rechazó el
        // formato del archivo, lo rechazó nuestra lectura de él. Decirle a
        // la persona que descargue otro documento la haría descargar de nuevo
        // un PDF que sí servía.
        warnings.push(
          'El documento sí trae el historial de movimientos salariales, pero no pudimos reconstruirlo: ' +
            'las etiquetas de cada patrón no cuadran entre sí. ' +
            'Revisa el SBC promedio o complétalo manualmente.',
        );
      } else {
        warnings.push(
          'Esta constancia no incluye el historial detallado de modificaciones salariales por patrón, solo el último SBC de cada uno. ' +
            'No es posible calcular tu SBC promedio de forma confiable con estos datos. ' +
            'Descarga la "Constancia de Semanas Cotizadas e Historial de Registros Afiliatorios" en el portal del IMSS para obtenerlo automáticamente, o complétalo manualmente.',
        );
      }
    }

    // ─── Último patrón ───────────────────────────────────────────
    const employerMatch = text.match(/(?:último patrón|patrón)[:\s]+([^\n\r]{5,80})/i);
    if (employerMatch?.[1]) {
      data.lastEmployer = employerMatch[1].trim();
    }

    const fieldsFound = Object.values(data).filter(
      (v) => v !== undefined && v !== '' && v !== null && (Array.isArray(v) ? v.length > 0 : true),
    ).length;

    // "SBC promedio (250 semanas)" ya tiene su propia advertencia detallada
    // más arriba (con la sugerencia de qué constancia descargar); no repetir
    // el mismo campo en este resumen genérico.
    const missingFieldsForSummary = missingFields.filter((c) => c !== 'SBC promedio (250 semanas)');
    if (missingFieldsForSummary.length > 0) {
      warnings.push(
        `No se pudieron extraer automáticamente: ${missingFieldsForSummary.join(', ')}. Por favor completa estos campos manualmente.`,
      );
    }

    if (fieldsFound < 3) {
      warnings.push(
        'El PDF puede estar escaneado o en formato no compatible con la extracción automática. ' +
          'Por favor completa todos los campos manualmente.',
      );
    }

    return {
      ok: true,
      data,
      warnings,
      missingFields,
    };
  },
};

/**
 * Busca la primera ocurrencia de `labelRegex` y, dentro de una ventana de
 * texto posterior a ella (no necesariamente adyacente), busca `valueRegex`.
 * Necesario porque el orden de extracción de pdfjs-dist sigue el orden de
 * dibujado del PDF, que puede intercalar texto no relacionado entre una
 * etiqueta y su valor.
 */
function findValueAfterLabel(
  text: string,
  labelRegex: RegExp,
  valueRegex: RegExp,
  searchWindow = 200,
): string | null {
  const labelMatch = text.match(labelRegex);
  if (!labelMatch || labelMatch.index === undefined) return null;

  const start = labelMatch.index + labelMatch[0].length;
  const windowText = text.slice(start, start + searchWindow);
  return windowText.match(valueRegex)?.[1]?.trim() ?? null;
}

/**
 * Deriva la fecha de nacimiento a partir de los primeros 6 dígitos del CURP
 * (AAMMDD). El siglo no está codificado en el CURP, así que se infiere
 * comparando los 2 dígitos del año con el año actual (heurística estándar
 * de validadores de CURP): si son mayores al año actual de 2 dígitos, se
 * asume 19XX; si no, 20XX.
 */
function birthDateFromCurp(curp: string): Date | null {
  const match = curp.match(/^[A-Z]{4}(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;

  const year2d = parseInt(match[1] as string, 10);
  const month = parseInt(match[2] as string, 10);
  const day = parseInt(match[3] as string, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const currentYear2d = new Date().getFullYear() % 100;
  const century = year2d > currentYear2d ? 1900 : 2000;
  const date = new Date(century + year2d, month - 1, day);

  // new Date hace "rollover" de días inválidos (ej. 30 de febrero); si el
  // mes resultante no coincide, la fecha original no era válida.
  if (isNaN(date.getTime()) || date.getMonth() !== month - 1) return null;
  return date;
}

interface WorkHistoryParseResult {
  relations: EmploymentRelation[];
  /** Periodos (con su propio SBC) listos para calculateWeightedAverageSBC, de más reciente a más antigua. */
  periods: SBCPeriod[];
  /** Si el empleo más reciente no se pudo incluir por no saber su fecha de baja. */
  omittedMostRecent: boolean;
  /** Si al menos un patrón usó su tabla de movimientos (cálculo preciso) en vez de la aproximación. */
  usedDetailedData: boolean;
  /** Si se detectaron periodos de más de un patrón traslapados en el tiempo. */
  hadOverlap: boolean;
  /**
   * Fecha hasta la cual se conoce el historial de cotización: "hoy" si el
   * patrón más reciente está marcado "Vigente", o la fecha de baja más
   * reciente en caso contrario. Ancla la ventana de las últimas 250 semanas
   * — usar siempre "hoy" haría que el promedio fallara para cualquiera cuyo
   * último empleo registrado haya terminado hace más de ~4.8 años.
   */
  referenceDate: Date;
  /** Si `referenceDate` es una fecha pasada (no "hoy") — para poder avisarlo. */
  usesPastReferenceDate: boolean;
  /**
   * Si el documento trae la tabla de movimientos. Distingue "esta constancia
   * no trae el historial detallado" (el aviso de siempre) de "sí lo trae pero
   * no pudimos reconstruirlo": el segundo caso exige un aviso distinto, porque
   * descargar otro documento no lo arregla.
   */
  hasMovementTable: boolean;
  /**
   * Montos del documento que no correspondieron ni al SBC de un patrón ni a
   * una fila de movimiento reconocida. Suelen ser filas de un tipo de
   * movimiento que el parser todavía no conoce.
   */
  unattributedAmounts: number;
}

interface SalaryMovement {
  /**
   * `ALTA` es el alta original de un empleo: abre un periodo salarial igual
   * que `REINGRESO`. `BAJA` es la única que cierra el historial.
   */
  type: 'REINGRESO' | 'ALTA' | 'MODIFICACION' | 'BAJA';
  date: Date;
  salary: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Agrupa las filas de la tabla "Tipo de movimiento / Fecha de movimiento /
 * Salario Base" (REINGRESO, ALTA, MODIFICACIÓN DE SALARIO, BAJA) por patrón,
 * asignando cada fila al patrón cuyo "Nombre del patrón" la antecede más de
 * cerca en el texto. No se asume que las 3 columnas de una fila queden
 * adyacentes por posición de columna vs. fila (el orden de dibujado del PDF
 * puede variar); en cambio, cada fila "TIPO/FECHA $MONTO" sí se observa
 * consistentemente junta, pero el orden relativo de TIPO y FECHA varía entre
 * constancias reales (algunas traen "FECHA TIPO $MONTO", otras "TIPO FECHA
 * $MONTO" — el orden de la tabla visual "Tipo de movimiento | Fecha de
 * movimiento | Salario Base" no siempre coincide con el orden de dibujado
 * del PDF). Por eso el regex acepta ambos órdenes.
 *
 * La lista de tipos es la que emite el IMSS en la columna "Tipo de movimiento":
 * REINGRESO, ALTA (el alta original de un empleo, con su SBC inicial),
 * MODIFICACION DE SALARIO y BAJA. Un tipo que falte aquí NO es inocuo: su
 * monto se cuela en la lista de SBC de encabezado, el emparejamiento por
 * patrón deja de cuadrar y el parser descarta TODO el historial.
 */
const MOVEMENT_REGEX =
  /(?:(?<day1>\d{2})\/(?<month1>\d{2})\/(?<year1>\d{4})\s+(?<type1>REINGRESO|ALTA|MODIFICACION DE SALARIO|BAJA)|(?<type2>REINGRESO|ALTA|MODIFICACION DE SALARIO|BAJA)\s+(?<day2>\d{2})\/(?<month2>\d{2})\/(?<year2>\d{4}))\s+\$\s*(?<amount>\d{1,6}(?:[.,]\d{1,4})?)/gi;

/** Extrae las filas crudas de la tabla de movimientos en todo el documento. */
function extractRawMovements(text: string): RegExpMatchArray[] {
  return [...text.matchAll(MOVEMENT_REGEX)];
}

function groupMovementsByEmployer(
  movements: RegExpMatchArray[],
  employers: RegExpMatchArray[],
): SalaryMovement[][] {
  const groupsByEmployer: SalaryMovement[][] = employers.map(() => []);

  for (const movement of movements) {
    if (movement.index === undefined) continue;

    let employerIdx = -1;
    for (const [i, employer] of employers.entries()) {
      if (employer.index !== undefined && employer.index <= movement.index) {
        employerIdx = i;
      } else {
        break;
      }
    }
    if (employerIdx === -1) continue;

    const m = movement.groups;
    const day = m?.day1 ?? m?.day2;
    const month = m?.month1 ?? m?.month2;
    const year = m?.year1 ?? m?.year2;
    const amountRaw = m?.amount;
    if (!day || !month || !year || !amountRaw) continue;

    const typeRaw = (m?.type1 ?? m?.type2 ?? '').toUpperCase();
    const type: SalaryMovement['type'] = typeRaw.startsWith('REINGRESO')
      ? 'REINGRESO'
      : typeRaw.startsWith('BAJA')
        ? 'BAJA'
        : typeRaw.startsWith('ALTA')
          ? 'ALTA'
          : 'MODIFICACION';
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    const salary = parseFloat(amountRaw.replace(',', '.'));
    if (isNaN(salary) || salary <= 0) continue;

    groupsByEmployer[employerIdx]?.push({ type, date, salary });
  }

  for (const group of groupsByEmployer) {
    group.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return groupsByEmployer;
}

/**
 * Construye los periodos de SBC de un patrón a partir de su tabla de
 * movimientos (ya ordenada cronológicamente). Cada evento de tipo
 * REINGRESO/ALTA/MODIFICACIÓN abre un periodo que termina donde empieza el
 * siguiente; el último periodo termina en la fecha de la fila BAJA (si
 * existe) o "hoy" (si el patrón está vigente). Devuelve [] si no hay
 * eventos utilizables o si no se puede determinar cuándo termina el último
 * periodo (sin BAJA y sin estar vigente).
 */
function periodsFromMovements(movements: SalaryMovement[], isActive: boolean, today: Date): SBCPeriod[] {
  const events = movements.filter((m) => m.type !== 'BAJA');
  if (events.length === 0) return [];

  const terminationRow = movements.find((m) => m.type === 'BAJA');
  const periods: SBCPeriod[] = [];

  for (const [i, current] of events.entries()) {
    const next = events[i + 1];
    let end: Date;
    if (next) {
      end = new Date(next.date.getTime() - DAY_MS);
    } else if (terminationRow) {
      end = terminationRow.date;
    } else if (isActive) {
      end = today;
    } else {
      // Sin evento siguiente, sin fila BAJA y sin estar vigente: no se sabe
      // cuándo terminó este último periodo salarial. Se omite por seguridad
      // en vez de adivinar.
      continue;
    }
    if (end.getTime() < current.date.getTime()) continue;
    periods.push({ startDate: current.date, endDate: end, sbc: current.salary });
  }

  return periods;
}

/** Detecta si algún par de periodos (de distintos patrones) se traslapa en el tiempo. */
function detectOverlap(periods: SBCPeriod[]): boolean {
  const sorted = [...periods].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  let maxEnd = -Infinity;
  for (const period of sorted) {
    if (period.startDate.getTime() < maxEnd) return true;
    maxEnd = Math.max(maxEnd, period.endDate.getTime());
  }
  return false;
}

/**
 * SBC de encabezado de cada patrón, anclado a SU ETIQUETA ("Salario Base de
 * Cotización *").
 *
 * Antes se identificaba contando todo monto "$" del documento que no
 * estuviera dentro de una fila de movimiento. Eso hace que el parser dependa
 * de adivinar qué montos son encabezados: un solo tipo de movimiento que no
 * se reconozca (la fila "ALTA" que emite el IMSS, por ejemplo) se cuela en
 * esa lista, el conteo deja de cuadrar con el número de patrones y el
 * historial COMPLETO se descarta — un solo dato desconocido tumbaba el
 * cálculo del SBC promedio. Con el anclaje, cada encabezado toma su propio
 * monto y un monto que no sabemos a qué pertenece ya no destruye nada: se
 * reporta aparte como monto sin atribuir.
 *
 * La ventana de búsqueda se acota al siguiente "Nombre del patrón" (o 200
 * caracteres) porque más allá hay datos que no son el SBC de este patrón, y
 * los montos que caen dentro de una fila de movimiento se descartan: si el
 * encabezado no trae monto, se devuelve null y el emparejamiento se rechaza
 * por estructura (no se adivina).
 *
 * La etiqueta se reconoce sin exigir el asterisco (algunas constancias no lo
 * traen) y se EXCLUYE la nota al pie ("* Valor del último salario base de
 * cotización diario en pesos"), que repetiría la etiqueta una vez por
 * patrón y descuadraría el conteo.
 */
function extractHeaderSbc(
  text: string,
  isInsideMovement: (index: number) => boolean,
): { amounts: (number | null)[]; indexes: number[] } {
  const amounts: (number | null)[] = [];
  const indexes: number[] = [];

  for (const label of text.matchAll(/salario base de cotizaci[oó]n(?!\s*diario)/gi)) {
    if (label.index === undefined) continue;
    const start = label.index + label[0].length;

    const nextEmployer = /nombre del patr[oó]n/i.exec(text.slice(start));
    const end =
      nextEmployer?.index !== undefined
        ? Math.min(start + nextEmployer.index, start + 200)
        : Math.min(text.length, start + 200);

    const found = [...text.slice(start, end).matchAll(/\$\s*(\d{1,6}(?:[.,]\d{1,4})?)/g)].find(
      (amount) => !isInsideMovement(start + amount.index),
    );

    const monto = found?.[1];
    if (!found || found.index === undefined || monto === undefined) {
      amounts.push(null);
      indexes.push(-1);
      continue;
    }
    amounts.push(parseFloat(monto.replace(',', '.')));
    indexes.push(start + found.index);
  }

  return { amounts, indexes };
}

/**
 * Montos del documento que no correspondieron ni al SBC de un patrón ni a una
 * fila de movimiento reconocida. Suelen ser filas de un tipo de movimiento
 * que el parser todavía no conoce: se informan en vez de ignorarse en
 * silencio.
 */
function countUnattributedAmounts(
  text: string,
  isInsideMovement: (index: number) => boolean,
  headerIndexes: number[],
): number {
  return [...text.matchAll(/\$\s*(\d{1,6}(?:[.,]\d{1,4})?)/g)].filter(
    (amount) =>
      amount.index !== undefined &&
      !isInsideMovement(amount.index) &&
      !headerIndexes.includes(amount.index),
  ).length;
}

/**
 * Reconstruye el historial laboral (patrón, fechas, SBC) a partir de la
 * Constancia de Semanas Cotizadas, y los periodos de SBC para el promedio
 * ponderado de las últimas 250 semanas.
 *
 * Para cada patrón se intenta primero la reconstrucción PRECISA a partir de
 * su tabla de movimientos (REINGRESO / ALTA / MODIFICACIÓN DE SALARIO / BAJA),
 * cuando el documento la incluye. Si no está disponible, se cae a una
 * APROXIMACIÓN de un solo periodo con el SBC del encabezado del patrón (ese
 * encabezado solo trae el ÚLTIMO SBC registrado, no el historial completo).
 *
 * Estrategia para el encabezado de cada patrón: "Fecha de alta", el SBC de
 * encabezado y "Nombre del patrón" quedan de forma fiable en el mismo orden
 * relativo en el texto extraído (a diferencia de "Fecha de baja", cuyo
 * valor puede quedar intercalado en cualquier parte por el orden de
 * dibujado del PDF). Se toman esas listas en orden y se emparejan por
 * posición; en la aproximación, la fecha de baja de cada patrón (salvo el
 * más reciente) se infiere como el día anterior al alta del patrón
 * siguiente, asumiendo que no hubo huecos entre empleos. El patrón más
 * reciente se considera vigente (baja = hoy) solo si el texto contiene la
 * palabra "Vigente"; si no, se omite del historial reconstruido por no
 * poder determinar cuándo terminó.
 */
function extractWorkHistory(text: string): WorkHistoryParseResult {
  // "Fecha de alta" puede venir seguido directamente de su fecha, o de la
  // etiqueta "Fecha de baja" (sin valor propio, ver nota de la función) antes
  // de la fecha — que en ambos casos es la de alta.
  const hireDates = [...text.matchAll(/fecha de alta(?:\s+fecha de baja)?\s+(\d{2})\/(\d{2})\/(\d{4})/gi)];
  const employers = [...text.matchAll(/nombre del patr[oó]n\s+([^\n\r]{2,80})/gi)];
  const registrationNumbers = [...text.matchAll(/registro patronal\s+(\S+)/gi)];

  const rawMovements = extractRawMovements(text);
  const movementRanges = rawMovements
    .filter((m): m is RegExpMatchArray & { index: number } => m.index !== undefined)
    .map((m) => [m.index, m.index + m[0].length] as const);
  const isInsideMovement = (index: number) => movementRanges.some(([start, end]) => index >= start && index < end);

  // SBC de encabezado de cada patrón, anclado a su propia etiqueta.
  const headerSbc = extractHeaderSbc(text, isInsideMovement);
  const sbcAmounts = headerSbc.amounts;
  const unattributedAmounts = countUnattributedAmounts(text, isInsideMovement, headerSbc.indexes);
  const hasMovementTable = /tipo\s+de\s+movimiento/i.test(text);

  const count = employers.length;
  if (
    count === 0 ||
    hireDates.length !== count ||
    sbcAmounts.length !== count ||
    sbcAmounts.some((amount) => amount === null)
  ) {
    // La ESTRUCTURA no cuadra: el documento no tiene la forma que el parser
    // entiende (faltan o sobran altas, nombres o montos de encabezado). Se
    // abandona la reconstrucción en vez de adivinar a qué patrón pertenece
    // cada dato. Un monto suelto que no sabemos a qué pertenece NO dispara
    // este abandono: se reporta aparte.
    return {
      relations: [],
      periods: [],
      omittedMostRecent: false,
      usedDetailedData: false,
      hadOverlap: false,
      referenceDate: new Date(),
      usesPastReferenceDate: false,
      hasMovementTable,
      unattributedAmounts,
    };
  }

  const movementsByEmployer = groupMovementsByEmployer(rawMovements, employers);
  const isCurrentlyActiveGlobal = /\bvigente\b/i.test(text);
  const today = new Date();
  const hireDateOf = (m: RegExpMatchArray) =>
    new Date(parseInt(m[3] as string, 10), parseInt(m[2] as string, 10) - 1, parseInt(m[1] as string, 10));

  const relations: EmploymentRelation[] = [];
  const periods: SBCPeriod[] = [];
  let omittedMostRecent = false;
  let usedDetailedData = false;

  for (let i = 0; i < count; i++) {
    const hireMatch = hireDates[i];
    const sbcHeader = sbcAmounts[i];
    const employerMatch = employers[i];
    if (!hireMatch || sbcHeader === null || sbcHeader === undefined || !employerMatch) continue;

    const hireDate = hireDateOf(hireMatch);
    const isActive = i === 0 && isCurrentlyActiveGlobal;
    const employerName =
      employerMatch[1]?.split(/\s+(?=registro\s+patronal\b|registro\s+patr\s*$|tipo\s+de\s+movimiento\b|fecha\s+de\s+movimi)/i)[0]?.trim() ?? '';

    const employerMovements = movementsByEmployer[i] ?? [];
    // Un patrón cuya tabla de movimientos NO registra BAJA sigue en vigor: la
    // constancia no dice que terminó. Si además el documento marca "Vigente",
    // ese empleo continúa hasta hoy y puede solaparse con otro patrón
    // (empleos simultáneos), así que el tramo común debe sumar los salarios de
    // ambos. Antes solo el primer patrón del documento podía extenderse hasta
    // hoy: un patrón simultáneo anterior se truncaba justo antes del alta del
    // siguiente, el traslape se perdía y el periodo más reciente mostraba un
    // solo salario en vez de la suma de los N patrones.
    const hasTerminationRow = employerMovements.some((m) => m.type === 'BAJA');
    const isInForce = isCurrentlyActiveGlobal && (i === 0 || !hasTerminationRow);

    const detailedPeriods = periodsFromMovements(employerMovements, isInForce, today);

    let employerPeriods: SBCPeriod[];
    let terminationDate: Date | undefined;

    if (detailedPeriods.length > 0) {
      usedDetailedData = true;
      employerPeriods = detailedPeriods;
      terminationDate = detailedPeriods[detailedPeriods.length - 1]?.endDate;
    } else {
      if (isActive) {
        terminationDate = today;
      } else if (i === 0) {
        omittedMostRecent = true;
        continue;
      } else {
        const previousHire = hireDates[i - 1];
        if (!previousHire) continue;
        terminationDate = new Date(hireDateOf(previousHire).getTime() - DAY_MS);
      }
      if (isNaN(sbcHeader) || sbcHeader <= 0) continue;
      employerPeriods = [{ startDate: hireDate, endDate: terminationDate, sbc: sbcHeader }];
    }

    // Cada periodo se etiqueta con el patrón al que pertenece: es lo que
    // permite mostrar en el desglose qué patrones coexistían en cada tramo.
    employerPeriods = employerPeriods.map((period) => ({ ...period, employerName }));

    periods.push(...employerPeriods);

    const registrationMatch = registrationNumbers[i];
    relations.push({
      employerName,
      employerRegistrationNumber: registrationMatch?.[1] ?? '',
      startDate: hireDate,
      endDate: terminationDate,
      contributionBaseSalary: !isNaN(sbcHeader) && sbcHeader > 0 ? sbcHeader : employerPeriods[employerPeriods.length - 1]!.sbc,
      movementType: '',
      contributedDays: terminationDate ? Math.max(0, Math.round((terminationDate.getTime() - hireDate.getTime()) / DAY_MS)) : 0,
    });
  }

  // Los periodos se entregan de MÁS RECIENTE A MÁS ANTIGUA. El recorrido
  // anterior los agrupaba por patrón (el primero del PDF, luego el segundo)
  // y la lista se veía desordenada: el usuario lee el desglose como una línea
  // de tiempo, no como un índice de patrones. Además, el orden del texto
  // extraído del PDF no es confiable (ver nota del llamador), así que el
  // orden se fija explícitamente y no se hereda del parseo.
  // El cálculo del promedio no depende de este orden: el barrido por
  // intervalos trabaja con las fronteras de cada periodo.
  periods.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  // Si el patrón más reciente no está "Vigente", el historial conocido
  // termina en la fecha de baja más reciente, no en "hoy" — de lo
  // contrario, la ventana de las últimas 250 semanas nunca tocaría ningún
  // periodo real para alguien que dejó de cotizar hace tiempo.
  const mostRecentEnd = periods.reduce<Date | undefined>(
    (latest, p) => (!latest || p.endDate.getTime() > latest.getTime() ? p.endDate : latest),
    undefined,
  );
  const referenceDate = isCurrentlyActiveGlobal || !mostRecentEnd ? today : mostRecentEnd;

  return {
    relations,
    periods,
    omittedMostRecent,
    usedDetailedData,
    hadOverlap: detectOverlap(periods),
    referenceDate,
    usesPastReferenceDate: referenceDate !== today,
    hasMovementTable,
    unattributedAmounts,
  };
}

/** Normaliza un candidato a nombre y descarta los que claramente no lo son. */
function cleanNameCandidate(candidate: string | undefined): string | null {
  if (!candidate) return null;
  const cleaned = candidate.split('\n')[0]?.trim().replace(/\s+/g, ' ') ?? '';
  if (cleaned.length < 5 || cleaned.length > 80) return null;
  if (/patr[oó]n|registro|entidad|federativa/i.test(cleaned)) return null;
  return cleaned.toUpperCase();
}

/**
 * Extrae el nombre del asegurado probando varias estrategias en orden de
 * confiabilidad, ya que el orden de texto extraído no es fiable como
 * indicador de adyacencia visual (ver nota en el llamador).
 */
function extractName(text: string): string | null {
  // 1. Campos estructurados de la "cadena original" del sello digital
  //    (Apellido Paterno / Apellido Materno / Nombre del Asegurado).
  //    Es la fuente más confiable cuando está presente.
  // NOTA: la clase de caracteres incluye espacio — "Nombre del Asegurado"
  // puede traer más de una palabra (ej. "ALAN FERNANDO"), y sin espacio la
  // captura se cortaba en la primera.
  const paternalSurname = text.match(/apellido\s*paterno\s*:\s*([a-záéíóúñ ]+?)(?=\s*[|\n]|$)/i)?.[1];
  const maternalSurname = text.match(/apellido\s*materno\s*:\s*([a-záéíóúñ ]+?)(?=\s*[|\n]|$)/i)?.[1];
  const insuredName = text.match(/nombre\s*del\s*asegurado\s*:\s*([a-záéíóúñ ]+?)(?=\s*[|\n]|$)/i)?.[1];
  if (insuredName || paternalSurname || maternalSurname) {
    const full = [insuredName, paternalSurname, maternalSurname].filter(Boolean).join(' ');
    const cleaned = cleanNameCandidate(full);
    if (cleaned) return cleaned;
  }

  // 2. El nombre puede aparecer intercalado entre la etiqueta "NSS:" y su
  //    valor numérico (ver nota en el llamador sobre el orden de extracción).
  const betweenNssAndValue = text.match(/nss[:\s]*\n?\s*([a-záéíóúñü ]{5,60})\n?\s*\d{10,11}/i)?.[1];
  const nssCandidate = cleanNameCandidate(betweenNssAndValue);
  if (nssCandidate) return nssCandidate;

  // 3. Saludo "Estimado(a), NOMBRE" (formato de constancia de semanas).
  const greeting = text.match(/estimado\(a\)[,:]?\s*([a-záéíóúñü ]{5,60})/i)?.[1];
  const greetingCandidate = cleanNameCandidate(greeting);
  if (greetingCandidate) return greetingCandidate;

  // 4. Etiqueta explícita "Nombre:" / "Trabajador:" (otros tipos de
  //    documento). Se excluye "Nombre del patrón" para no confundir el
  //    nombre del asegurado con el de un empleador.
  const label = text.match(/\b(?:nombre|trabajador)\b(?!\s*del\s*patr)[:\s]+([a-záéíóúñü ]{5,60})/i)?.[1];
  const labelCandidate = cleanNameCandidate(label);
  if (labelCandidate) return labelCandidate;

  return null;
}
