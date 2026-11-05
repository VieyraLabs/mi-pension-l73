/**
 * PdfTextExtractor (nativo) — extracción real de texto de un PDF con pdfjs-dist.
 *
 * En web (`PdfTextExtractor.web.ts`) pdf.js corre su worker en un Web Worker.
 * React Native no tiene Web Workers, así que aquí se le entrega el manejador
 * del worker para que trabaje en el hilo principal: pdf.js lo detecta por
 * `globalThis.pdfjsWorker` y arranca en modo "fake worker".
 *
 * Es el mismo motor y el mismo worker que en web, así que el texto sale igual
 * en las dos plataformas — importa, porque los patrones de
 * `PersonalDataParser` están calibrados contra ese texto.
 *
 * La build "legacy" de pdfjs-dist se usa a propósito: es la que trae los
 * polyfills que Hermes no garantiza (por ejemplo `Promise.withResolvers`).
 */
// Los shims de pdf.js (DOMMatrix, structuredClone) DEBEN instalarse antes de
// cargar pdf.js: pdf.js los necesita al importarse. Ver el archivo del shim.
import './pdfjsEnvironment';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// pdf.js busca aquí el manejador del worker cuando no puede crear un Web
// Worker real. Es la vía que el propio pdf.js ofrece para los entornos que
// no tienen Web Workers (React Native, Node).
globalThis.pdfjsWorker = pdfjsWorker;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extrae el texto de un PDF codificado en base64.
 *
 * Devuelve cadena vacía cuando el archivo no se puede leer o no contiene
 * texto: el llamador decide qué informar. Nunca lanza, para que un PDF
 * corrupto no deje el flujo de importación a medias.
 */
export async function extractPdfText(base64: string): Promise<string> {
  try {
    const bytes = base64ToUint8Array(base64);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    const textByPage: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      textByPage.push(text);
    }

    return textByPage.join('\n').replace(/[ \t]+/g, ' ').trim();
  } catch {
    return '';
  }
}
