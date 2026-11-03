/**
 * Pruebas de ValidationScreen: humo general + desglose auditable del SBC
 * promedio reconstruido desde el PDF (US-001 / CHG-20261024-001).
 *
 * Los fixtures replican el orden real de extracción de pdfjs-dist (mismo
 * criterio que personalDataParser.test.ts; los datos son sintéticos).
 *
 * Para ejecutar: npm test
 */
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

// El texto se define por prueba (la variable empieza con "mock" para poder
// referenciarse desde la factoría de jest.mock).
let mockExtractedText = '';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { extractedText: mockExtractedText } }),
}));

import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { lightTheme } from '../theme';
import { renderScreen } from '../test-utils/renderScreen';
import ValidationScreen from '../screens/ValidationScreen';

// Constancia SIN tabla de movimientos (solo último SBC por patrón).
const TEXTO_SIN_DETALLE =
  'CURP: PEPJ600101HDFRRN01 NSS 12345678901 Semanas cotizadas: 520 $ 300.00';

// Historial detallado completo: patrón vigente, 2 movimientos → 2 periodos,
// más de 250 semanas cotizadas, sin huecos. Determinista (alta de 2018).
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

// Historial detallado pero CORTO: ~31 semanas cotizadas (< 250) →
// reconstrucción parcial.
const TEXTO_PARCIAL = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
DISTRITO FEDERAL
Fecha de alta 01/06/2019 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 250.0
Nombre del patrón EMPRESA CORTA SA DE CV
Registro Patronal Y500000001
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 01/01/2020 $ 250.0
REINGRESO 01/06/2019 $ 250.0

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:82||`;

// Dos patrones con un hueco sin cotización entre ambos (~2004-06 → 2005-01):
// las 250 semanas se completan pero hay semanas omitidas.
const TEXTO_HUECOS = `Instituto Mexicano del Seguro Social
NSS:
JUAN PEREZ LOPEZ
98765432101
CURP: XEXX010101HNEXXX04
Semanas cotizadas IMSS
Estimado(a),
Tu historia laboral
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
01/01/2000
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

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:312||`;

// Historial detallado con un empleo ANTIGUO (2000-2001) y otro posterior
// (2010-2016). Las 250 semanas cotizadas del promedio caen íntegras dentro
// del empleo posterior: el de 2000 queda FUERA de la ventana y no debe
// mostrarse. Determinista: no hay "Vigente", así que la fecha de referencia
// es la baja más reciente (01/01/2016), no la fecha de hoy.
const TEXTO_FUERA_DE_VENTANA = `Instituto Mexicano del Seguro Social
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
$ 300.0
Nombre del patrón PATRON POSTERIOR SA DE CV
Registro Patronal Y500000001
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 01/01/2016 $ 300.0
REINGRESO 01/01/2010 $ 300.0
* Valor del último salario base de cotización diario en pesos.
01/01/2000
DISTRITO FEDERAL
Fecha de alta 01/01/2000 Fecha de baja Salario Base de Cotización */
Entidad federativa
$ 100.0
Nombre del patrón PATRON ANTIGUO SA DE CV
Registro Patronal Y500000002
Tipo de movimiento Fecha de movimiento Salario Base
BAJA 01/06/2001 $ 100.0
REINGRESO 01/01/2000 $ 100.0
* Valor del último salario base de cotización diario en pesos.

|||Apellido Paterno:PEREZ|Apellido Materno:LOPEZ|Nombre del Asegurado:JUAN|Número total de semanas cotizadas:400||`;

// Dos patrones que SE TRASLAPAN (un trabajo temporal mientras sigue el
// principal): el periodo común debe mostrar el SBC SUMADO y los dos patrones.
// No hay "Vigente": la fecha de referencia del motor es la baja más reciente
// (31/12/2023), así que el resultado no depende del día en que corra la prueba.
const TEXTO_TRASLAPADOS = `Instituto Mexicano del Seguro Social
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
// antiguo sigue en vigor y coexiste con el más reciente, así que el periodo
// más reciente del desglose debe mostrar el SBC SUMADO de los dos.
// Determinista: los dos patrones cotizan desde 2018, así que el periodo
// más reciente y el promedio no dependen de la fecha en que corra la prueba.
const TEXTO_CONCURRENTES_SIN_BAJA = `Instituto Mexicano del Seguro Social
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ValidationScreen', () => {
  test('renderiza sin crashear y precarga los campos detectados', () => {
    mockExtractedText = TEXTO_SIN_DETALLE;
    renderScreen(<ValidationScreen />);

    expect(screen.getByText('Datos personales extraídos')).toBeTruthy();
    expect(screen.getByDisplayValue('520')).toBeTruthy();
    expect(screen.getByDisplayValue('PEPJ600101HDFRRN01')).toBeTruthy();
  });

  test('muestra el último SBC con formato de moneda como dato informativo, no como input editable', () => {
    mockExtractedText = TEXTO_CONCURRENTES_SIN_BAJA;
    renderScreen(<ValidationScreen />);

    const lastSbcLabel = screen.getByText('Último SBC registrado (solo referencia, no es el promedio)');
    const lastSbcRow = within(lastSbcLabel.parent!.parent!.parent!);
    const lastSbcValue = lastSbcRow.getByText('$900.00');
    expect(lastSbcValue).toBeTruthy();
    expect(StyleSheet.flatten(lastSbcValue.props.style)).toMatchObject({
      fontSize: lightTheme.fonts.titleMedium.fontSize,
      lineHeight: lightTheme.fonts.titleMedium.lineHeight,
    });
    expect(lastSbcRow.queryByDisplayValue('900')).toBeNull();
    expect(lastSbcRow.queryByDisplayValue('$900.00')).toBeNull();

    const averageSbcInput = screen.getByDisplayValue('900');
    fireEvent.changeText(averageSbcInput, '901');
    expect(screen.getByDisplayValue('901')).toBeTruthy();
  });

  test('muestra los campos no encontrados como faltantes', () => {
    mockExtractedText = TEXTO_SIN_DETALLE;
    renderScreen(<ValidationScreen />);

    expect(screen.getByText(/Campos no encontrados en el PDF/i)).toBeTruthy();
  });
});

describe('ValidationScreen — desglose del SBC promedio (US-001)', () => {
  test('con historial detallado: tarjeta colapsada por defecto y, al expandirla, periodos y resumen', () => {
    mockExtractedText = TEXTO_DETALLE_COMPLETO;
    renderScreen(<ValidationScreen />);

    // Colapsada por defecto: el título está visible, el contenido no.
    // El recuento es el de los periodos CONSIDERADOS en el promedio: la
    // ventana son las últimas 250 semanas cotizadas, así que el periodo de
    // 2018-2020 queda fuera y no se cuenta.
    expect(screen.getByText('Cómo se calculó tu SBC promedio (1 periodo)')).toBeTruthy();
    expect(screen.queryByText('Periodos SBC considerados en el promedio')).toBeNull();
    // Resumen de una línea bajo el título (mismo promedio que el parser).
    expect(screen.getByText(/\$148\.10\/día · 250 de 250 semanas/)).toBeTruthy();
    // Hint bajo el input del SBC promedio apuntando a la sección.
    expect(screen.getByText(/Despliega «Cómo se calculó tu SBC promedio»/)).toBeTruthy();

    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (1 periodo)'));

    // Periodos SBC considerados (fechas es-MX + $SBC/día).
    expect(screen.getByText('Periodos SBC considerados en el promedio')).toBeTruthy();
    // El periodo vigente (2021 → hoy) entra al promedio; el de 2018-2020 no.
    expect(screen.getByText(/01\/01\/2021 – \d{2}\/\d{2}\/\d{4}/)).toBeTruthy();
    expect(screen.getByText('$148.10/día')).toBeTruthy();
    expect(screen.queryByText('01/07/2018 – 31/12/2020')).toBeNull();
    expect(screen.queryByText('$103.23/día')).toBeNull();

    // Resumen de las últimas 250 semanas cotizadas.
    expect(screen.getByText('Resumen de las últimas 250 semanas cotizadas')).toBeTruthy();
    expect(screen.getByText('Semanas usadas en el promedio')).toBeTruthy();
    expect(screen.getByText('250 de 250')).toBeTruthy();
    expect(screen.getByText('Semanas cotizadas del historial')).toBeTruthy();
    expect(screen.getByText('Semanas sin cotización en la ventana del promedio')).toBeTruthy();
    expect(screen.getByText('Ventana de fechas usada')).toBeTruthy();

    // Historial completo y sin huecos: sin marca de parcialidad.
    expect(screen.queryByText(/Reconstrucción parcial/)).toBeNull();
    expect(screen.queryByText(/Se omitieron/)).toBeNull();
  });

  test('muestra solo los nombres de los patrones en la descripción y conserva las fechas del periodo', () => {
    mockExtractedText = TEXTO_DETALLE_COMPLETO.replace(
      'EMPRESA DE PRUEBA SA DE CV\nRegistro Patronal Y584460910\nTipo de movimiento Fecha de movimiento',
      'EMPRESA DE PRUEBA SA DE CV Registro Patronal Y584460910 Tipo de movimiento Fecha de movimiento',
    );
    renderScreen(<ValidationScreen />);

    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (1 periodo)'));

    expect(screen.getByText('EMPRESA DE PRUEBA SA DE CV')).toBeTruthy();
    expect(screen.queryByText(/EMPRESA DE PRUEBA SA DE CV \+/)).toBeNull();
    expect(screen.queryByText(/Registro Patronal|Fecha de movimi/i)).toBeNull();
    expect(screen.getByText(/01\/01\/2021 – \d{2}\/\d{2}\/\d{4}/)).toBeTruthy();
  });

  test('muestra la marca de reconstrucción parcial cuando el historial no alcanza las 250 semanas', () => {
    mockExtractedText = TEXTO_PARCIAL;
    renderScreen(<ValidationScreen />);

    expect(screen.getByText('Cómo se calculó tu SBC promedio (1 periodo)')).toBeTruthy();
    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (1 periodo)'));

    expect(screen.getByText(/Reconstrucción parcial: tu historial solo registra \d+ semanas cotizadas/)).toBeTruthy();
    // Sin huecos en este caso: no debe aparecer la nota de semanas omitidas.
    expect(screen.queryByText(/Se omitieron/)).toBeNull();
  });

  test('marca las semanas omitidas cuando hay huecos sin patrón aunque las 250 semanas estén completas', () => {
    mockExtractedText = TEXTO_HUECOS;
    renderScreen(<ValidationScreen />);

    expect(screen.getByText('Cómo se calculó tu SBC promedio (2 periodos)')).toBeTruthy();
    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (2 periodos)'));

    // El resumen limita el recuento de huecos a la ventana del promedio.
    expect(screen.getByText(/\d+ semanas sin cotización dentro de la ventana del promedio; no cuentan para el promedio/)).toBeTruthy();
    // Las 250 semanas sí se completaron: sin marca de parcialidad.
    expect(screen.queryByText(/Reconstrucción parcial/)).toBeNull();
    expect(screen.getByText('250 de 250')).toBeTruthy();
  });

  test('lista los periodos SBC de más reciente a más antigua', () => {
    // Los dos periodos de este historial caen dentro de la ventana de las 250
    // semanas cotizadas, así que ambos se listan.
    mockExtractedText = TEXTO_HUECOS;
    renderScreen(<ValidationScreen />);

    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (2 periodos)'));

    // La lista de periodos se lee como una línea de tiempo: el periodo
    // reciente (2005) va antes que el de 2000. Se compara la posición
    // relativa de ambos, y no la de un índice fijo: la fila «Ventana de
    // fechas usada» del resumen también es un rango de fechas.
    const rangos = screen
      .getAllByText(/^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}$/)
      .map((n) => String(n.props.children));
    const posReciente = rangos.findIndex((r) => r.startsWith('01/01/2005 – '));
    const posAntiguo = rangos.findIndex((r) => r.startsWith('01/01/2000 – '));

    expect(posReciente).toBeGreaterThanOrEqual(0);
    expect(posAntiguo).toBeGreaterThanOrEqual(0);
    expect(posReciente).toBeLessThan(posAntiguo);
    expect(rangos[posAntiguo]).toBe('01/01/2000 – 01/06/2004');
  });

  test('muestra solo los periodos considerados en el promedio (N en el título)', () => {
    mockExtractedText = TEXTO_FUERA_DE_VENTANA;
    renderScreen(<ValidationScreen />);

    // El recuento del título es el de los periodos CONSIDERADOS: el empleo de
    // 2000 queda fuera de la ventana de las 250 semanas y no se cuenta.
    expect(screen.getByText('Cómo se calculó tu SBC promedio (1 periodo)')).toBeTruthy();
    expect(screen.queryByText('Cómo se calculó tu SBC promedio (2 periodos)')).toBeNull();

    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (1 periodo)'));

    // El subtítulo describe la lista como una línea de tiempo de periodos
    // considerados.
    expect(screen.getByText('Periodos SBC considerados en el promedio')).toBeTruthy();

    // Solo se lista el periodo que entra al promedio.
    expect(screen.getByText('01/01/2010 – 01/01/2016')).toBeTruthy();
    expect(screen.getByText('$300.00/día')).toBeTruthy();
    // El empleo de 2000 NO aparece.
    expect(screen.queryByText('01/01/2000 – 01/06/2001')).toBeNull();
    expect(screen.queryByText('$100.00/día')).toBeNull();
  });

  test('muestra el periodo traslapado con el SBC SUMADO y los dos patrones', () => {
    mockExtractedText = TEXTO_TRASLAPADOS;
    renderScreen(<ValidationScreen />);

    // El título cuenta los PERIODOS del desglose (no los periodos por patrón).
    expect(screen.getByText('Cómo se calculó tu SBC promedio (3 periodos)')).toBeTruthy();

    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (3 periodos)'));

    // El periodo común (2022-2023) muestra el SBC EFECTIVO: la suma de los dos
    // patrones concurrentes ($600 + $300 = $900).
    expect(screen.getByText('01/01/2022 – 30/06/2023')).toBeTruthy();
    expect(screen.getByText('$900.00/día')).toBeTruthy();
    // Y los DOS patrones quedan visibles.
    expect(screen.getByText('• EMPRESA A SA DE CV')).toBeTruthy();
    expect(screen.getByText('• EMPRESA B SA DE CV')).toBeTruthy();
    expect(screen.queryByText(/EMPRESA A SA DE CV \+ EMPRESA B SA DE CV/)).toBeNull();

    // Los dos periodos con un solo patrón y el desglose individual de A en el
    // periodo concurrente muestran $600/día.
    expect(screen.getAllByText('$600.00/día')).toHaveLength(3);

    // La nota que explica la regla aparece UNA sola vez y usa el mismo
    // vocabulario que el resto de la sección: "periodo" (nunca "tramo").
    expect(
      screen.getAllByText(
        'Cuando tuviste más de un patrón a la vez, el SBC del periodo es la suma de ambos, pero las semanas cuentan una sola vez.',
      ),
    ).toHaveLength(1);
    expect(screen.queryByText(/tramo/i)).toBeNull();
  });

  test('el periodo traslapado limpia encabezados IMSS separados por espacios Unicode', () => {
    mockExtractedText = TEXTO_TRASLAPADOS.replace(
      'Nombre del patrón EMPRESA B SA DE CV\nRegistro Patronal Y500000002\nTipo de movimiento Fecha de movimiento Salario Base',
      'Nombre del patrón EMPRESA B SA DE CV Registro\u00A0Patronal Y500000002 Tipo\u00A0de\u00A0movimiento Fecha\u00A0de\u00A0movimiento Salario Base',
    );
    renderScreen(<ValidationScreen />);

    fireEvent.press(screen.getByText('Cómo se calculó tu SBC promedio (3 periodos)'));

    expect(screen.getByText('01/01/2022 – 30/06/2023')).toBeTruthy();
    expect(screen.getByText('$900.00/día')).toBeTruthy();
    expect(screen.getByText('• EMPRESA A SA DE CV')).toBeTruthy();
    expect(screen.getByText('• EMPRESA B SA DE CV')).toBeTruthy();
    expect(screen.queryByText(/EMPRESA A SA DE CV \+ EMPRESA B SA DE CV/)).toBeNull();
    expect(screen.queryByText(/Registro\s+Patronal|Fecha\s+de\s+movimi/i)).toBeNull();
  });

  test('el periodo más reciente con patrones simultáneos muestra el SBC SUMADO', () => {
    mockExtractedText = TEXTO_CONCURRENTES_SIN_BAJA;
    renderScreen(<ValidationScreen />);

    fireEvent.press(screen.getByText(/^Cómo se calculó tu SBC promedio \(/));

    // El periodo más reciente es el común a los dos patrones: su SBC es la
    // suma ($600 + $300) y los DOS patrones quedan visibles.
    expect(screen.getByText('$900.00/día')).toBeTruthy();
    const employerA = screen.getByText('• EMPRESA A SA DE CV');
    const employerB = screen.getByText('• EMPRESA B SA DE CV');
    const salaryA = screen.getByText('$600.00/día');
    const salaryB = screen.getByText('$300.00/día');
    const nearestView = (node: typeof employerA) => {
      let parent = node.parent;
      while (parent && parent.type !== View) parent = parent.parent;
      return parent;
    };
    expect(nearestView(salaryA) === nearestView(employerA)).toBe(true);
    expect(nearestView(salaryB) === nearestView(employerB)).toBe(true);
    expect(employerA.props.numberOfLines).toBe(1);
    expect(employerA.props.ellipsizeMode).toBe('tail');
    expect(employerB.props.numberOfLines).toBe(1);
    expect(employerB.props.ellipsizeMode).toBe('tail');
    expect(screen.queryByText(/EMPRESA A SA DE CV \+ EMPRESA B SA DE CV/)).toBeNull();
  });

  test('pasa el historial detallado agregado al iniciar una simulación', () => {
    mockExtractedText = TEXTO_CONCURRENTES_SIN_BAJA;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Continuar')?.onPress?.();
    });

    try {
      renderScreen(<ValidationScreen />);
      fireEvent.press(screen.getByText('Confirmar y continuar'));

      expect(mockNavigate).toHaveBeenCalledWith('NewSimulation', expect.objectContaining({
        importedData: expect.objectContaining({
          sbcPeriods: expect.arrayContaining([expect.objectContaining({ sbc: 900 })]),
        }),
      }));
    } finally {
      alertSpy.mockRestore();
    }
  });

  test('muestra salarios individuales para patrones concurrentes con el mismo nombre', () => {
    mockExtractedText = TEXTO_CONCURRENTES_SIN_BAJA.replace(
      'EMPRESA A SA DE CV',
      'EMPRESA B SA DE CV',
    );
    renderScreen(<ValidationScreen />);

    fireEvent.press(screen.getByText(/^Cómo se calculó tu SBC promedio \(/));

    expect(screen.getByText('$900.00/día')).toBeTruthy();
    expect(screen.getAllByText('• EMPRESA B SA DE CV')).toHaveLength(2);
    expect(screen.getByText('$300.00/día')).toBeTruthy();
    expect(screen.getByText('$600.00/día')).toBeTruthy();
  });

  test('sin historial detallado: la sección no se muestra y se conserva el aviso de captura manual', () => {
    mockExtractedText = TEXTO_SIN_DETALLE;
    renderScreen(<ValidationScreen />);

    expect(screen.queryByText(/Cómo se calculó tu SBC promedio/)).toBeNull();
    expect(screen.queryByText(/Despliega «Cómo se calculó tu SBC promedio»/)).toBeNull();
    expect(screen.getByText(/no incluye el historial de modificaciones salariales/i)).toBeTruthy();
    // La corrección manual sigue disponible.
    expect(screen.getByDisplayValue('520')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('520'), '530');
    expect(screen.getByDisplayValue('530')).toBeTruthy();
  });
});
