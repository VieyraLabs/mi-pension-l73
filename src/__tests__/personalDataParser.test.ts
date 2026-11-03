/**
 * Pruebas del parser de datos personales de la Constancia de Semanas
 * Cotizadas del IMSS.
 *
 * El texto de prueba replica el orden real de extracción de pdfjs-dist
 * para este documento (orden de dibujado del content stream, NO el orden
 * visual de lectura): el nombre aparece intercalado entre "NSS:" y su
 * valor, y texto no relacionado (incluyendo fechas) puede intercalarse
 * entre la etiqueta de SBC y su monto — por eso el SBC se busca anclado al
 * signo "$" en vez de a la etiqueta. Los datos (nombre, CURP, NSS) son
 * sintéticos.
 */
import { ConstanciaIMSSParser } from '../services/pdf/parsers/PersonalDataParser';
import { summarizeLastContributedWeeks } from '../services/pension/history';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

const TEXTO_CONSTANCIA = `Instituto Mexicano del Seguro Social
DD MM YYYY
Tu detalle de semanas cotizadas
Constancia de Semanas Cotizadas en el IMSS e
historial de registros afiliatorios de la persona asegurada
800
NSS:
PEREZ LOPEZ JUAN
12345678901
CURP: XEXX010101HNEXXX04
Semanas Reintegradas (+) Semanas Descontadas
(por disposición de recursos) (-)
800 0 0
Semanas cotizadas IMSS
Estimado(a),
Total de semanas cotizadas
Fecha de emisión del reporte
29 / 05 / 2025
Tu historia laboral
Vigente
CIUDAD DE MÉXICO
Fecha de alta 16/01/2021 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 500.0
Nombre del patrón EMPRESA DE PRUEBA SA DE CV
Registro Patronal Y549999940
/* Valor del último salario base de cotización diario en pesos.
15/01/2021
CIUDAD DE MÉXICO
Fecha de alta 01/07/2018 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 200.0
Nombre del patrón OTRA EMPRESA SA DE CV
Registro Patronal Y584460910

|||Origen de Trámite:Móvil (M)|Tipo Trámite:CONSTANCIA DE SEMANAS COTIZADAS|Fecha:29 de mayo 2025, 09:45:29|Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Folio:17485335292831411793011|Número total de semanas cotizadas:800||`;

describe('ConstanciaIMSSParser', () => {
  test('extrae el nombre desde los campos de la cadena original, no desde "Nombre del patrón"', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.data?.name).toBe('JUAN PEREZ LOPEZ');
  });

  test('extrae un "Nombre del Asegurado" de más de una palabra completo (no solo la primera)', () => {
    const conNombreCompuesto = TEXTO_CONSTANCIA.replace(
      'Nombre del Asegurado:JUAN',
      'Nombre del Asegurado:ALAN FERNANDO',
    );
    const result = ConstanciaIMSSParser.parse(conNombreCompuesto);
    expect(result.data?.name).toBe('ALAN FERNANDO PEREZ LOPEZ');
  });

  test('extrae el NSS aunque el nombre esté intercalado antes del valor', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.data?.nss).toBe('12345678901');
  });

  test('extrae el CURP', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.data?.curp).toBe('XEXX010101HNEXXX04');
  });

  test('extrae las semanas cotizadas totales', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.data?.totalWeeks).toBe(800);
  });

  test('extrae el último SBC (el del registro más reciente) aunque "Entidad federativa" se intercale antes del monto', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.data?.lastSBC).toBe(500);
  });

  test('extrae el último SBC aunque una fecha quede entre la etiqueta y el monto (no confunde el día con el SBC)', () => {
    // Orden en el que la etiqueta antecede a la fecha (en vez de sucederla),
    // como ocurrió en un caso real: sin anclar al signo "$", una búsqueda
    // "primer número después de la etiqueta" capturaría "16" de la fecha.
    const textoConFechaTrasEtiqueta = `Vigente
CIUDAD DE MÉXICO
Salario Base de Cotización */
Fecha de alta 16/01/2021 Fecha de baja
Entidad federativa
$ 2172.0
Nombre del patrón EMPRESA DE PRUEBA SA DE CV`;
    const result = ConstanciaIMSSParser.parse(textoConFechaTrasEtiqueta);
    expect(result.data?.lastSBC).toBe(2172);
  });

  test('deriva la fecha de nacimiento del CURP cuando el documento no la incluye directamente', () => {
    // CURP de prueba "XEXX010101...": los primeros 6 dígitos (AAMMDD) son
    // 01/01/01 → como este documento no trae un campo explícito de fecha de
    // nacimiento, se deriva del CURP en vez de quedar como faltante.
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.missingFields).not.toContain('Fecha de nacimiento');
    expect(result.data?.birthDate?.getFullYear()).toBe(2001);
    expect(result.data?.birthDate?.getMonth()).toBe(0);
    expect(result.data?.birthDate?.getDate()).toBe(1);
    expect(result.warnings.some((a) => /fecha de nacimiento.*curp/i.test(a))).toBe(true);
  });

  test('marca Fecha de nacimiento como faltante cuando tampoco hay CURP para derivarla', () => {
    const sinCurp = TEXTO_CONSTANCIA.replace('CURP: XEXX010101HNEXXX04', '');
    const result = ConstanciaIMSSParser.parse(sinCurp);
    expect(result.missingFields).toContain('Fecha de nacimiento');
  });

  test('no confunde "Nombre del patrón" con el nombre del asegurado cuando no hay cadena original', () => {
    const sinCadenaOriginal = TEXTO_CONSTANCIA.split('|||Origen de Trámite')[0] ?? '';
    const result = ConstanciaIMSSParser.parse(sinCadenaOriginal);
    expect(result.data?.name).not.toMatch(/patrón|EMPRESA/i);
  });
});

// ─────────────────────────────────────────────
// Historial laboral y SBC promedio (aproximado)
// ─────────────────────────────────────────────
//
// Nota sobre determinismo: estas pruebas usan una fecha de alta fija muy en
// el pasado (16/01/2021) para el patrón "Vigente", cuya antigüedad ya supera
// las 250 semanas y seguirá superándolas siempre (el pasado no cambia), así
// que el resultado no depende de la fecha real en la que corra la prueba.

describe('ConstanciaIMSSParser — historial laboral y SBC promedio', () => {
  test('reconstruye el historial laboral infiriendo la fecha de baja de cada patrón', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    const relaciones = result.data?.employmentRelations ?? [];
    expect(relaciones).toHaveLength(2);

    expect(relaciones[0]?.employerName).toBe('EMPRESA DE PRUEBA SA DE CV');
    expect(relaciones[0]?.contributionBaseSalary).toBe(500);
    expect(relaciones[0]?.startDate.toISOString().split('T')[0]).toBe('2021-01-16');
    // Vigente: sin patrón más reciente después, la fecha de baja es "hoy".

    expect(relaciones[1]?.employerName).toBe('OTRA EMPRESA SA DE CV');
    expect(relaciones[1]?.contributionBaseSalary).toBe(200);
    expect(relaciones[1]?.startDate.toISOString().split('T')[0]).toBe('2018-07-01');
    // Inferida como un día antes del alta del siguiente patrón (16/01/2021).
    expect(relaciones[1]?.endDate?.toISOString().split('T')[0]).toBe('2021-01-15');
  });

  test('no calcula ningún SBC promedio cuando la constancia no trae el historial detallado de modificaciones', () => {
    // Sin la tabla de movimientos (REINGRESO/MODIFICACIÓN/BAJA) por patrón,
    // no se debe inventar un número aproximado: se deja en blanco y se pide
    // la constancia correcta.
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.data?.averageSBC).toBeUndefined();
    expect(result.missingFields).toContain('SBC promedio (250 semanas)');
    expect(
      result.warnings.some((a) => /no incluye el historial detallado de modificaciones salariales/i.test(a)),
    ).toBe(true);
    expect(
      result.warnings.some((a) =>
        a.includes('Constancia de Semanas Cotizadas e Historial de Registros Afiliatorios'),
      ),
    ).toBe(true);
    // El aviso no debe incrustar una URL cruda — solo el nombre del documento a solicitar.
    expect(result.warnings.some((a) => a.includes('http'))).toBe(false);
  });

  test('omite el patrón más reciente del cálculo si no está marcado "Vigente" (no se sabe cuándo terminó)', () => {
    const sinVigente = TEXTO_CONSTANCIA.replace('Vigente\n', '');
    const result = ConstanciaIMSSParser.parse(sinVigente);
    const relaciones = result.data?.employmentRelations ?? [];

    expect(relaciones).toHaveLength(1);
    expect(relaciones[0]?.employerName).toBe('OTRA EMPRESA SA DE CV');
    expect(
      result.warnings.some((a) => /no se pudo determinar cuándo terminó tu empleo más reciente/i.test(a)),
    ).toBe(true);
  });

  test('un monto que no corresponde a ningún patrón ni movimiento NO descarta el historial: se advierte', () => {
    // El SBC de cada patrón se ancla a SU etiqueta ("Salario Base de
    // Cotización *"), así que un monto suelto —p. ej. la fila de un tipo de
    // movimiento que el parser todavía no conoce— ya no tira el historial
    // completo: se reporta como monto sin atribuir. Antes este caso
    // abandonaba la reconstrucción por completo.
    const textoConMontoExtra = TEXTO_CONSTANCIA.replace('$ 500.0', '$ 500.0\n$ 999.0');
    const result = ConstanciaIMSSParser.parse(textoConMontoExtra);

    expect(result.data?.employmentRelations).toHaveLength(2);
    expect(
      result.warnings.some((a) => /no correspondieron ni a un patrón ni a un movimiento/i.test(a)),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Historial detallado (tabla de modificaciones salariales)
// ─────────────────────────────────────────────
//
// Algunas constancias traen, por patrón, una tabla "Tipo de movimiento /
// Fecha de movimiento / Salario Base" (REINGRESO / MODIFICACIÓN DE SALARIO /
// BAJA) con el historial completo de cambios de SBC. Cuando está disponible,
// se usa para un cálculo más preciso en vez de la aproximación de un solo
// SBC por patrón.

describe('ConstanciaIMSSParser — historial detallado de modificaciones salariales', () => {
  test('usa el SBC de la última modificación (no el del encabezado) cuando ya cubre las 250 semanas', () => {
    // El encabezado trae un SBC ($999, deliberadamente distinto) que NO debe
    // usarse: la tabla de movimientos indica que el SBC vigente desde
    // 01/01/2018 es $200, y esa fecha ya es lo bastante antigua para cubrir
    // por sí sola las 250 semanas — las modificaciones anteriores (2010,
    // 2012) quedan fuera de la ventana y no deben afectar el promedio.
    const texto = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
Vigente
CIUDAD DE MÉXICO
Fecha de alta 01/01/2010 Fecha de baja Salario Base de Cotización *
Entidad federativa
$ 999.0
Nombre del patrón EMPRESA DE PRUEBA SA DE CV
Registro Patronal Y549999940
Fecha de movimiento Tipo de movimiento Salario Base
01/01/2018 MODIFICACION DE SALARIO $ 200.0
01/01/2012 MODIFICACION DE SALARIO $ 75.0
01/01/2010 REINGRESO $ 50.0
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:500||`;

    const result = ConstanciaIMSSParser.parse(texto);
    expect(result.data?.averageSBC).toBe(200);
    expect(result.warnings.some((a) => /historial detallado de modificaciones salariales/i.test(a))).toBe(true);
    expect(result.warnings.some((a) => /APROXIMADO/i.test(a))).toBe(false);
  });

  test('detecta periodos traslapados entre dos patrones distintos y lo advierte', () => {
    // PATRON B (vigente, alta 01/06/2015) por sí solo ya cubre las 250
    // semanas, así que domina el promedio — pero PATRON A (01/01/2015 a
    // 01/06/2016) se traslapa con él (01/06/2015–01/06/2016), como el caso
    // real de empleos simultáneos que el propio IMSS reconoce como válido.
    const texto = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
Vigente
CIUDAD DE MÉXICO
Fecha de alta 01/06/2015 Fecha de baja Salario Base de Cotización *
Entidad federativa
$ 999.0
Nombre del patrón PATRON B SA DE CV
Registro Patronal Y549999940
Fecha de movimiento Tipo de movimiento Salario Base
01/06/2015 REINGRESO $ 999.0
* Valor del último salario base de cotización diario en pesos.
01/01/2015
CIUDAD DE MÉXICO
Fecha de alta 01/01/2015 Fecha de baja Salario Base de Cotización *
Entidad federativa
$ 500.0
Nombre del patrón PATRON A SA DE CV
Registro Patronal Y584460910
Fecha de movimiento Tipo de movimiento Salario Base
01/06/2016 BAJA $ 500.0
01/01/2015 REINGRESO $ 500.0
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:500||`;

    const result = ConstanciaIMSSParser.parse(texto);
    expect(result.data?.averageSBC).toBe(999);
    expect(
      result.warnings.some((a) => /periodos con más de un patrón simultáneo/i.test(a)),
    ).toBe(true);
  });

  test('no advierte traslape cuando los patrones son contiguos', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);
    expect(result.warnings.some((a) => /patrón simultáneo/i.test(a))).toBe(false);
  });

  test('reconoce la tabla de movimientos cuando el orden real es "TIPO FECHA $MONTO" (no solo "FECHA TIPO $MONTO")', () => {
    // Regresión: una Constancia de Semanas Cotizadas real trajo la tabla de
    // movimientos en este orden (columna "Tipo de movimiento" antes que
    // "Fecha de movimiento" en el texto extraído), lo cual hacía que el
    // regex de movimientos nunca hiciera match — todos los "$" de la tabla
    // se contaban entonces como si fueran el encabezado del patrón, el
    // conteo no cuadraba, y el parser abandonaba sin calcular el promedio.
    // "Vigente" + alta muy antigua, sin fila BAJA (igual que otras pruebas
    // de este bloque), para que el resultado no dependa de la fecha en que
    // corra la prueba: la última modificación (01/01/2021) ya es lo bastante
    // antigua para cubrir por sí sola las 250 semanas.
    const texto = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
Vigente
DISTRITO FEDERAL
Fecha de alta 01/07/2018 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 999.0
Nombre del patrón EMPRESA DE PRUEBA SA DE CV
Registro Patronal Y584460910
Tipo de movimiento Fecha de movimiento Salario Base
MODIFICACION DE SALARIO 01/01/2021 $ 148.1
MODIFICACION DE SALARIO 01/01/2020 $ 128.79
MODIFICACION DE SALARIO 01/01/2019 $ 107.32
REINGRESO 01/07/2018 $ 103.23

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:1048||`;

    const result = ConstanciaIMSSParser.parse(texto);

    expect(result.data?.employmentRelations).toHaveLength(1);
    // El SBC de la última modificación (148.1), no el del encabezado (999).
    expect(result.data?.averageSBC).toBe(148.1);
    expect(result.missingFields).not.toContain('SBC promedio (250 semanas)');
  });

  test('ancla la ventana de 250 semanas a la fecha de baja más reciente cuando el patrón no está "Vigente"', () => {
    // Regresión: con la misma constancia real del caso anterior, el único
    // patrón registrado terminó (BAJA) mucho antes de "hoy" (más de 250
    // semanas), así que usar "hoy" como referencia de la ventana no
    // encontraba ningún periodo dentro de ella y el promedio fallaba pese a
    // tener el historial detallado completo. La referencia debe ser la
    // fecha de baja más reciente, no "hoy".
    const texto = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
DISTRITO FEDERAL
Fecha de alta 01/01/2010 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 999.0
Nombre del patrón EMPRESA ANTIGUA SA DE CV
Registro Patronal Y500000000
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 01/01/2020 $ 300.0
REINGRESO 01/01/2010 $ 300.0

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:521||`;

    const result = ConstanciaIMSSParser.parse(texto);

    expect(result.data?.averageSBC).toBe(300);
    expect(result.missingFields).not.toContain('SBC promedio (250 semanas)');
    expect(
      result.warnings.some((a) => /no indica que sigas cotizando actualmente/i.test(a)),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Fila de movimiento ALTA (regresión del PDF real)
// ─────────────────────────────────────────────
//
// El IMSS emite una fila "ALTA" para el alta original de un empleo (con su
// SBC inicial). El parser no la reconocía, y el efecto era total: su monto
// no contaba como movimiento, se colaba en la lista de SBC de encabezado, el
// conteo de montos ya no cuadraba con el número de patrones y el parser
// descartaba TODO el historial — el documento que trae la tabla completa
// terminaba sin SBC promedio.
//
// El fixture reproduce el bloque real del patrón "GEMA DIAZ MEZA, A. EN P."
// (página 8 de la constancia): ALTA del 19/06/1990 con $8.78, y un patrón
// más reciente que cierra con BAJA.
//
// Determinista: no hay "Vigente", así que la fecha de referencia es la BAJA
// más reciente (01/09/2026) y el resultado no depende del día en que corra
// la prueba. La ventana de 250 semanas cae entera en el periodo de $131.77
// del patrón reciente.
const TEXTO_FILA_ALTA = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
01/09/2003
VERACRUZ DE IGNACIO DE LA LLAVE
Salario Base de Cotización *
Fecha de alta Fecha de baja 19/06/1990
Entidad federativa
$ 51.64
Nombre del patrón GEMA DIAZ MEZA, A. EN P.
Registro Patronal F542391410
Tipo de movimiento Fecha de movimiento Salario Base
01/09/2003 BAJA $ 51.64
01/06/2003 MODIFICACION DE SALARIO $ 51.64
16/11/1990 MODIFICACION DE SALARIO $ 13.45
19/06/1990 ALTA $ 8.78
* Valor del último salario base de cotización diario en pesos.
01/04/2017
VERACRUZ DE IGNACIO DE LA LLAVE
Salario Base de Cotización *
Fecha de alta Fecha de baja 01/04/2017
Entidad federativa
$ 449.27
Nombre del patrón COMERCIALIZADORA FARMACEUTICA DE CHIAPAS, SAPI DE CV
Registro Patronal F545700510
Tipo de movimiento Fecha de movimiento Salario Base
01/09/2026 BAJA $ 449.27
01/09/2026 MODIFICACION DE SALARIO $ 449.27
01/04/2017 REINGRESO $ 131.77
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:1892||`;

describe('ConstanciaIMSSParser — fila de movimiento ALTA', () => {
  test('reconstruye el historial y calcula el SBC promedio aunque la constancia traiga una fila ALTA', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_FILA_ALTA);

    expect(result.missingFields).not.toContain('SBC promedio (250 semanas)');
    expect(result.data?.employmentRelations).toHaveLength(2);
    expect(result.data?.averageSBC).toBe(131.77);
    expect(result.data?.contributionSummary?.selectedWeeks).toBe(250);
    expect(result.data?.contributionSummary?.isComplete).toBe(true);

    // La fila ALTA abre un periodo: el historial empieza el 19/06/1990 (el
    // alta original), no el 16/11/1990 (la primera modificación de salario).
    expect(result.data?.employmentRelations[0]?.employerName).toBe('GEMA DIAZ MEZA, A. EN P.');
    expect(result.data?.employmentRelations[0]?.startDate.toISOString().split('T')[0]).toBe(
      '1990-06-19',
    );
    expect(result.data?.contributionSummary?.totalWeeksInHistory).toBe(1889);
  });

  test('el monto de la fila ALTA no se confunde con el SBC de encabezado de un patrón', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_FILA_ALTA);

    // El encabezado del patrón dice $51.64; el $8.78 de la fila ALTA es un
    // movimiento, no otro encabezado.
    expect(result.data?.employmentRelations[0]?.contributionBaseSalary).toBe(51.64);
    expect(result.data?.employmentRelations[1]?.contributionBaseSalary).toBe(449.27);
    // Ningún monto del documento queda sin atribuir.
    expect(
      result.warnings.some((a) => /no correspondieron ni a un patrón ni a un movimiento/i.test(a)),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Exposición del detalle SBC en ExtractedData (CHG-20261024-001 / US-001)
// ─────────────────────────────────────────────
//
// El parser ya calculaba los periodos y el ContributionSummary internamente;
// ahora los expone en data.sbcPeriods / data.contributionSummary para que la
// UI los muestre sin recalcular (una sola fuente de verdad).

// Historial detallado completo: un patrón vigente con 2 movimientos →
// 2 periodos (el último termina "hoy"), más de 250 semanas cotizadas,
// sin huecos. Determinista: el alta de 2018 ya cubre las 250 semanas.
const TEXTO_DETALLE_COMPLETO = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
Vigente
DISTRITO FEDERAL
Fecha de alta 01/07/2018 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 999.0
Nombre del patrón EMPRESA DE PRUEBA SA DE CV
Registro Patronal Y584460910
Tipo de movimiento Fecha de movimiento Salario Base
MODIFICACION DE SALARIO 01/01/2021 $ 148.1
REINGRESO 01/07/2018 $ 103.23

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:1048||`;

// ─────────────────────────────────────────────
// Estructura del documento: el parser sigue sin adivinar
// ─────────────────────────────────────────────
//
// El emparejamiento por patrón abandonaba la reconstrucción cuando los
// CONTEOS no cuadraban. Ahora el SBC de encabezado se ancla a su etiqueta, así
// que un monto suelto no la tumba; pero cuando la ESTRUCTURA del documento no
// se entiende (faltan altas, nombres o montos de encabezado), el parser
// sigue sin adivinar a qué patrón pertenece cada dato.
describe('ConstanciaIMSSParser — estructura del documento', () => {
  const textoConEstructuraRota = TEXTO_DETALLE_COMPLETO.replace('Fecha de alta 01/07/2018 ', '');

  test('no reconstruye el historial si las etiquetas del patrón no cuadran (no adivina)', () => {
    const result = ConstanciaIMSSParser.parse(textoConEstructuraRota);

    expect(result.data?.employmentRelations).toEqual([]);
    expect(result.data?.averageSBC).toBeUndefined();
    expect(result.missingFields).toContain('SBC promedio (250 semanas)');
  });

  test('no acusa al documento de no traer el historial cuando sí lo trae', () => {
    const result = ConstanciaIMSSParser.parse(textoConEstructuraRota);

    // El aviso de siempre ("no incluye el historial detallado…") solo aplica
    // a los documentos que de verdad no traen la tabla de movimientos: aquí
    // el documento sí la trae y lo que falló fue nuestra lectura de él.
    expect(result.warnings.some((a) => /no incluye el historial detallado/i.test(a))).toBe(false);
    expect(result.warnings.some((a) => /sí trae el historial de movimientos/i.test(a))).toBe(true);
  });

  test('lee el encabezado aunque la etiqueta venga sin acento y sin asterisco', () => {
    // Algunas constancias escriben "Salario Base de Cotizacion" (sin tilde y
    // sin el asterisco que remite a la nota al pie). El SBC de encabezado se
    // ancla a esa etiqueta, así que si el anclaje la exige con asterisco, el
    // historial completo se descarta y el documento "parece" no traer datos.
    const textoSinAcentoNiAsterisco = TEXTO_DETALLE_COMPLETO.replace(
      'Salario Base de Cotización *',
      'Salario Base de Cotizacion',
    ).replace('Nombre del patrón', 'Nombre del patron');

    const result = ConstanciaIMSSParser.parse(textoSinAcentoNiAsterisco);

    expect(result.data?.employmentRelations).toHaveLength(1);
    expect(result.data?.averageSBC).toBe(148.1);
    expect(result.missingFields).not.toContain('SBC promedio (250 semanas)');
  });

  test('la nota al pie no cuenta como una etiqueta de encabezado', () => {
    // "* Valor del último salario base de cotización diario en pesos." repite
    // la palabra "cotización" una vez por patrón: si contara como etiqueta,
    // el conteo de encabezados no quadraría con el de patrones.
    const texto = `${TEXTO_DETALLE_COMPLETO}
* Valor del último salario base de cotización diario en pesos.`;

    const result = ConstanciaIMSSParser.parse(texto);

    expect(result.data?.employmentRelations).toHaveLength(1);
    expect(result.data?.averageSBC).toBe(148.1);
  });

  test('no reconstruye el historial si un encabezado no trae su monto (no adivina)', () => {
    const textoSinMonto = TEXTO_DETALLE_COMPLETO.replace('$ 999.0', 'monto no disponible');

    const result = ConstanciaIMSSParser.parse(textoSinMonto);

    expect(result.data?.employmentRelations).toEqual([]);
    expect(result.data?.averageSBC).toBeUndefined();
  });
});

describe('ConstanciaIMSSParser — exposición del detalle SBC (CHG-20261024-001)', () => {
  test('expone sbcPeriods y contributionSummary cuando la constancia trae historial detallado', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_DETALLE_COMPLETO);

    const periods = result.data?.sbcPeriods;
    expect(Array.isArray(periods)).toBe(true);
    expect(periods?.length ?? 0).toBeGreaterThan(0);

    const summary = result.data?.contributionSummary;
    expect(summary).toBeDefined();
    // Solo se exponen los periodos CONSIDERADOS en el promedio: cada uno
    // solapa la ventana de las 250 semanas cotizadas.
    for (const period of periods ?? []) {
      expect(period.endDate.getTime()).toBeGreaterThanOrEqual(summary!.firstWeekUsed.getTime());
      expect(period.startDate.getTime()).toBeLessThan(
        summary!.lastWeekUsed.getTime() + MS_PER_WEEK,
      );
    }
    // El periodo más reciente (el vigente) es el primero de la lista y
    // siempre entra al promedio: la lista se lee hacia atrás en el tiempo.
    expect(periods?.[0]?.startDate.toISOString().split('T')[0]).toBe('2021-01-01');
    expect(periods?.[0]?.sbc).toBe(148.1);

    // Ventana completa de 250 semanas cotizadas, sin huecos (patrón continuo).
    expect(summary?.selectedWeeks).toBe(250);
    expect(summary?.isComplete).toBe(true);
    expect(summary?.skippedWeeks).toBe(0);
    expect(summary?.contributedWeeks).toBeGreaterThanOrEqual(250);
    // Misma fuente de verdad: el promedio expuesto es el del resumen.
    expect(summary?.averageSalary).toBe(result.data?.averageSBC);
    expect(summary?.firstWeekUsed.getTime()).toBeLessThanOrEqual(summary?.lastWeekUsed.getTime() ?? Infinity);

    expect(result.missingFields).not.toContain('SBC promedio (250 semanas)');
    // El detalle extra no debe activar el aviso de "PDF escaneado".
    expect(result.warnings.some((a) => /escaneado/i.test(a))).toBe(false);
  });

  test('sin historial detallado: sbcPeriods y contributionSummary quedan undefined y se conserva la degradación', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_CONSTANCIA);

    expect(result.data?.sbcPeriods).toBeUndefined();
    expect(result.data?.contributionSummary).toBeUndefined();
    expect(result.data?.averageSBC).toBeUndefined();
    expect(result.missingFields).toContain('SBC promedio (250 semanas)');
    expect(
      result.warnings.some((a) =>
        a.includes('Constancia de Semanas Cotizadas e Historial de Registros Afiliatorios'),
      ),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Orden de los periodos SBC expuestos a la UI
// ─────────────────────────────────────────────
//
// El desglose «Cómo se calculó tu SBC promedio» se lee como una línea de
// tiempo: los periodos van de MÁS RECIENTE A MÁS ANTIGUA. El orden no se
// hereda del texto extraído del PDF (no es confiable) ni de la agrupación por
// patrón: se fija explícitamente en el parser.
//
// El fixture lista el patrón MÁS ANTIGUO primero (así lo entrega el PDF en
// algunas constancias). Antes del orden explícito, la lista conservaba ese
// orden y se veía desordenada: 2000 primero y 2005 al final.
const TEXTO_ORDEN_INVERSO = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
Vigente
DISTRITO FEDERAL
Fecha de alta 01/01/2000 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 200.0
Nombre del patrón PATRON B SA DE CV
Registro Patronal Y500000002
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 01/06/2004 $ 200.0
REINGRESO 01/01/2000 $ 200.0
* Valor del último salario base de cotización diario en pesos.
01/01/2005
DISTRITO FEDERAL
Fecha de alta 01/01/2005 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 600.0
Nombre del patrón PATRON A SA DE CV
Registro Patronal Y500000001
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 01/12/2005 $ 600.0
REINGRESO 01/01/2005 $ 600.0
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:312||`;

describe('ConstanciaIMSSParser — orden de los periodos SBC', () => {
  test('los periodos se entregan de más reciente a más antigua, aunque el PDF los liste al revés', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_ORDEN_INVERSO);

    const periods = result.data?.sbcPeriods;
    expect(periods).toBeDefined();
    expect(periods).toHaveLength(2);

    // Del más reciente al más antiguo: 2005 → 2000 (el PDF los lista al revés).
    expect(periods?.[0]?.startDate.toISOString().split('T')[0]).toBe('2005-01-01');
    expect(periods?.[0]?.sbc).toBe(600);
    expect(periods?.[1]?.startDate.toISOString().split('T')[0]).toBe('2000-01-01');
    expect(periods?.[1]?.sbc).toBe(200);

    // Las fechas de inicio nunca crecen al recorrer la lista.
    for (let i = 1; i < periods!.length; i++) {
      expect(periods![i]!.startDate.getTime()).toBeLessThanOrEqual(
        periods![i - 1]!.startDate.getTime(),
      );
    }
  });

  test('el orden de la lista no altera el SBC promedio calculado', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_ORDEN_INVERSO);

    // El promedio es el mismo que el del resumen (una sola fuente de verdad)
    // y no depende del orden en que se recorren los periodos.
    expect(result.data?.averageSBC).toBe(result.data?.contributionSummary?.averageSalary);
    expect(result.data?.contributionSummary?.selectedWeeks).toBe(250);
  });
});

// ─────────────────────────────────────────────
// Periodos SBC expuestos: solo los que entran al promedio
// ─────────────────────────────────────────────
//
// La ventana del promedio son las últimas 250 semanas COTIZADAS: un empleo
// viejo que queda fuera de esa ventana no se muestra, porque no pesa en el
// cálculo que la persona usuaria está revisando. El filtro vive en el
// PARSER (fuente de verdad); la UI solo muestra lo que recibe.
//
// El fixture tiene dos patrones: uno de 2000-2004 (fuera de la ventana) y
// otro vigente desde 2005 (dentro). El primero se elimina de `sbcPeriods`,
// pero NO del cálculo del promedio.
const TEXTO_ANTIGUO_Y_RECIENTE = `Instituto Mexicano delSeguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
Vigente
DISTRITO FEDERAL
Fecha de alta 01/01/2005 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 300.0
Nombre del patrón PATRON RECIENTE SA DE CV
Registro Patronal Y500000001
Tipo de movimiento Fecha de movimiento Salario Base
REINGRESO 01/01/2005 $ 300.0
* Valor del último salario base de cotización diario en pesos.
01/01/2000
DISTRITO FEDERAL
Fecha de alta 01/01/2000 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 100.0
Nombre del patrón PATRON ANTIGUO SA DE CV
Registro Patronal Y500000002
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 01/06/2004 $ 100.0
REINGRESO 01/01/2000 $ 100.0
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:1200||`;

// ─────────────────────────────────────────────
// Tramos con SBC efectivo (empleos simultáneos)
// ─────────────────────────────────────────────
//
// Dos patrones que SE TRASLAPAN en el tiempo (el caso real de un trabajo
// temporal mientras sigue el principal). El desglose debe mostrar el TRAMO
// común con el SBC SUMADO y el nombre de los DOS patrones.
//
// No hay "Vigente": la fecha de referencia del motor es la baja más reciente
// (31/12/2023), así que la ventana de las 250 semanas queda anclada a una
// fecha FIJA y el resultado no depende del día en que corra la prueba.
const TEXTO_PATRONES_TRASLAPADOS = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
DISTRITO FEDERAL
Fecha de alta 01/01/2018 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 600.0
Nombre del patrón EMPRESA A SA DE CV
Registro Patronal Y500000001
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 31/12/2023 $ 600.0
REINGRESO 01/01/2018 $ 600.0
* Valor del último salario base de cotización diario en pesos.
01/01/2022
DISTRITO FEDERAL
Fecha de alta 01/01/2022 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 300.0
Nombre del patrón EMPRESA B SA DE CV
Registro Patronal Y500000002
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 30/06/2023 $ 300.0
REINGRESO 01/01/2022 $ 300.0
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:600||`;

// Dos patrones CONCURRENTES en los que NINGUNO registra baja (la constancia
// no dice que ninguno terminó) y el documento marca "Vigente": el patrón más
// antiguo sigue en vigor y coexiste con el más reciente, así que el tramo más
// reciente debe mostrar el SBC SUMADO de los dos.
// Determinista: los dos patrones cotizan desde 2018, así que TODAS las semanas
// cotizadas del historial valen $900 (600 + 300) y el resultado no depende de
// la fecha en que corra la prueba.
const TEXTO_PATRONES_CONCURRENTES_SIN_BAJA = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
Vigente
DISTRITO FEDERAL
Fecha de alta 01/01/2018 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 300.0
Nombre del patrón EMPRESA B SA DE CV
Registro Patronal Y500000001
Tipo de movimiento Fecha de movimiento Salario Base
REINGRESO 01/01/2018 $ 300.0
* Valor del último salario base de cotización diario en pesos.
01/01/2018
DISTRITO FEDERAL
Fecha de alta 01/01/2018 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 600.0
Nombre del patrón EMPRESA A SA DE CV
Registro Patronal Y500000002
Tipo de movimiento Fecha de movimiento Salario Base
REINGRESO 01/01/2018 $ 600.0
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:600||`;

describe('ConstanciaIMSSParser — tramos con SBC efectivo', () => {
  test('expone TRAMOS: el tramo común con dos patrones vale la suma y los nombra', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_PATRONES_TRASLAPADOS);

    const tramos = result.data?.sbcPeriods;
    expect(tramos).toBeDefined();
    // Tres tramos: solo A (2018-2021), el común (2022-2023) y solo A (2023).
    expect(tramos).toHaveLength(3);

    const comun = tramos!.find((tramo) => tramo.employerNames.length === 2)!;
    expect(comun.employerNames).toEqual(['EMPRESA A SA DE CV', 'EMPRESA B SA DE CV']);
    // SBC EFECTIVO: la suma de los dos patrones concurrentes.
    expect(comun.sbc).toBe(900);
    expect(comun.startDate.toISOString().split('T')[0]).toBe('2022-01-01');
    expect(comun.endDate.toISOString().split('T')[0]).toBe('2023-06-30');

    // Los tramos con un solo patrón muestran el SBC de ese patrón.
    const deUnSoloPatron = tramos!.filter((tramo) => tramo.employerNames.length === 1);
    expect(deUnSoloPatron).toHaveLength(2);
    for (const tramo of deUnSoloPatron) {
      expect(tramo.employerNames).toEqual(['EMPRESA A SA DE CV']);
      expect(tramo.sbc).toBe(600);
    }
  });

  test('conserva un nombre empresarial que contiene REGISTRO PATRIMONIAL', () => {
    const nombreEmpresa = 'OPERADORA REGISTRO PATRIMONIAL DEL CENTRO SA DE CV';
    const texto = TEXTO_PATRONES_CONCURRENTES_SIN_BAJA.replace(
      'Nombre del patrón EMPRESA A SA DE CV',
      `Nombre del patrón ${nombreEmpresa}`,
    );
    const result = ConstanciaIMSSParser.parse(texto);

    expect(result.data?.employmentRelations?.map((relation) => relation.employerName)).toContain(
      nombreEmpresa,
    );
  });

  test('limpia un encabezado Registro Patr truncado al límite de 80 caracteres', () => {
    const nombreLargo = `EMPRESA ${'N'.repeat(58)}`;
    expect(`${nombreLargo} Registro Patr`).toHaveLength(80);

    const texto = TEXTO_PATRONES_TRASLAPADOS.replace(
      'Nombre del patrón EMPRESA B SA DE CV\nRegistro Patronal Y500000002\nTipo de movimiento Fecha de movimiento Salario Base',
      `Nombre del patrón ${nombreLargo} Registro Patronal Y500000002 Tipo de movimiento Fecha de movimiento Salario Base`,
    );
    const result = ConstanciaIMSSParser.parse(texto);
    const comun = result.data?.sbcPeriods?.find((period) => period.employerNames.length === 2);

    expect(comun?.employerNames).toContain(nombreLargo);
    expect(comun?.employerNames.some((name) => name.includes('Registro Patr'))).toBe(false);
    expect(comun?.sbc).toBe(900);
    expect(comun?.startDate.toISOString().split('T')[0]).toBe('2022-01-01');
    expect(comun?.endDate.toISOString().split('T')[0]).toBe('2023-06-30');
  });

  test('un patrón sin baja registrada sigue en vigor: el tramo más reciente suma los N patrones', () => {
    // Ninguno de los dos patrones registra BAJA (la constancia no dice que
    // ninguno terminó) y el documento marca "Vigente": el patrón más antiguo
    // sigue en vigor y coexiste con el más reciente.
    const result = ConstanciaIMSSParser.parse(TEXTO_PATRONES_CONCURRENTES_SIN_BAJA);

    const tramos = result.data?.sbcPeriods;
    expect(tramos).toBeDefined();

    // El tramo más reciente es el COMÚN a los dos patrones: su SBC efectivo
    // es la SUMA de los dos salarios ($600 + $300), no el de uno solo.
    const reciente = tramos![0]!;
    expect(reciente.employerNames).toEqual(['EMPRESA A SA DE CV', 'EMPRESA B SA DE CV']);
    expect(reciente.sbc).toBe(900);
    expect(result.data?.lastSBC).toBe(reciente.sbc);

    // El promedio refleja la misma suma.
    expect(result.data?.averageSBC).toBe(900);
    expect(result.data?.contributionSummary?.averageSalary).toBe(900);
  });

  test('el promedio NO cambia: se sigue calculando con los periodos por patrón', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_PATRONES_TRASLAPADOS);

    // El motor calcula el promedio sobre los PERIODOS por patrón (el historial
    // completo es lo que permite saltar los huecos y alcanzar las 250
    // semanas); el desglose por tramos solo cambia lo que se MUESTRA.
    const periodosPorPatron = [
      { startDate: new Date(2018, 0, 1), endDate: new Date(2023, 11, 31), sbc: 600 },
      { startDate: new Date(2022, 0, 1), endDate: new Date(2023, 5, 30), sbc: 300 },
    ];
    const esperado = summarizeLastContributedWeeks(periodosPorPatron, new Date(2023, 11, 31))!;

    expect(result.data?.averageSBC).toBe(esperado.averageSalary);
    expect(result.data?.contributionSummary?.averageSalary).toBe(esperado.averageSalary);
    expect(result.data?.contributionSummary?.selectedWeeks).toBe(250);
  });
});

describe('ConstanciaIMSSParser — periodos considerados en el promedio', () => {
  test('solo expone los periodos que solapan la ventana de las 250 semanas', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_ANTIGUO_Y_RECIENTE);

    const periods = result.data?.sbcPeriods;
    expect(periods).toBeDefined();
    // El patrón de 2000-2004 queda fuera de la ventana: no se expone.
    expect(periods).toHaveLength(1);
    expect(periods?.[0]?.startDate.toISOString().split('T')[0]).toBe('2005-01-01');
    expect(periods?.[0]?.sbc).toBe(300);

    // Y el patrón antiguo no aparece en ninguna forma.
    const inicioDePeriodos = (periods ?? []).map((p) =>
      p.startDate.toISOString().split('T')[0],
    );
    expect(inicioDePeriodos).not.toContain('2000-01-01');
  });

  test('el promedio NO cambia: se sigue calculando con el historial completo', () => {
    const result = ConstanciaIMSSParser.parse(TEXTO_ANTIGUO_Y_RECIENTE);

    // El motor calcula el promedio sobre TODOS los periodos (el historial
    // completo es lo que permite saltar los huecos y alcanzar las 250
    // semanas); el filtro solo afecta lo que se expone.
    const periodosCompletos = [
      { startDate: new Date(2005, 0, 1), endDate: new Date(), sbc: 300 },
      { startDate: new Date(2000, 0, 1), endDate: new Date(2004, 5, 1), sbc: 100 },
    ];
    const esperado = summarizeLastContributedWeeks(periodosCompletos, new Date())!;

    expect(result.data?.contributionSummary?.averageSalary).toBe(esperado.averageSalary);
    expect(result.data?.averageSBC).toBe(esperado.averageSalary);
    // Las 250 semanas del promedio están todas en el patrón reciente.
    expect(esperado.averageSalary).toBe(300);
    expect(result.data?.contributionSummary?.selectedWeeks).toBe(250);
    expect(result.data?.contributionSummary?.isComplete).toBe(true);
  });
});
