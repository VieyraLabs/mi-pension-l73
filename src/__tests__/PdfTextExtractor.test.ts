/**
 * Pruebas del extractor de texto nativo (pdfjs-dist con el worker en el hilo
 * principal). El caso central es el PDF con contenido COMPRIMIDO: es el
 * formato de la constancia del IMSS y el que fallaba en iOS cuando el
 * extractor solo buscaba cadenas legibles sobre los bytes del archivo.
 *
 * Para ejecutar: npm test
 */
import { extractPdfText } from '../services/pdf/PdfTextExtractor';
import { buildPdfFixture, toBase64 } from '../test-utils/pdfFixture';

const CONSTANCIA_LINES = [
  'Constancia de Semanas Cotizadas',
  'IMSS - Instituto Mexicano del Seguro Social',
  'Nombre del asegurado: JUAN CARLOS PEREZ LOPEZ',
  'CURP: PEJL900101HDFRPN09  NSS: 12345678901',
  'Semanas cotizadas: 480',
  'Nombre del patron: EMPRESA SA DE CV',
  'Fecha de alta 01/03/2015  Salario Base de Cotizacion $ 12,345.60',
  'Tipo de movimiento  Fecha de movimiento  Salario Base',
  'ALTA 01/03/2015 $ 10,000.00',
  'MODIFICACION DE SALARIO 01/03/2018 $ 11,500.25',
];

describe('extractPdfText (nativo)', () => {
  test('extrae el texto de un PDF con contenido comprimido (FlateDecode)', async () => {
    const pdf = buildPdfFixture(CONSTANCIA_LINES);

    const result = await extractPdfText(toBase64(pdf));

    expect(result).toContain('Constancia de Semanas Cotizadas');
    expect(result).toContain('Semanas cotizadas: 480');
    expect(result).toContain('Salario Base de Cotizacion');
    expect(result).toContain('MODIFICACION DE SALARIO');
  });

  test('extrae el texto de un PDF sin comprimir', async () => {
    const pdf = buildPdfFixture(CONSTANCIA_LINES, { compress: false });

    const result = await extractPdfText(toBase64(pdf));

    expect(result).toContain('Constancia de Semanas Cotizadas');
    expect(result).toContain('Semanas cotizadas: 480');
  });

  test('devuelve cadena vacía ante un base64 inválido, sin lanzar', async () => {
    await expect(extractPdfText('no-es-base64-válido-!!!')).resolves.toBe('');
  });

  test('devuelve cadena vacía si el archivo no es un PDF válido, sin lanzar', async () => {
    const notAPdf = Buffer.from('esto no es un PDF', 'latin1');

    await expect(extractPdfText(toBase64(notAPdf))).resolves.toBe('');
  });

  test('extrae el texto aunque el entorno NO tenga ReadableStream (React Native no lo tiene)', async () => {
    // pdf.js entrega el texto por streaming y Hermes no trae `ReadableStream`:
    // sin el parche (patches/pdfjs-dist+6.2.108.patch) la extracción devolvía
    // vacío en el dispositivo y la app decía que el PDF estaba escaneado.
    const original = globalThis.ReadableStream;
    delete (globalThis as { ReadableStream?: unknown }).ReadableStream;

    try {
      // Si el global no se pudo quitar, la prueba no probaría nada.
      expect(globalThis.ReadableStream).toBeUndefined();

      // pdf.js resuelve `ReadableStream` al USARLO (no al cargarse), así que
      // basta con que el global no exista cuando se extrae.
      const pdf = buildPdfFixture(CONSTANCIA_LINES);
      const result = await extractPdfText(toBase64(pdf));

      expect(result).toContain('Constancia de Semanas Cotizadas');
      expect(result).toContain('Semanas cotizadas: 480');
    } finally {
      globalThis.ReadableStream = original;
    }
  });
});
