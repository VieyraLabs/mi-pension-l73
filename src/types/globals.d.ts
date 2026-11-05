/**
 * Variables globales que la app define para librerías de terceros.
 *
 * `pdfjsWorker` es la variable que pdf.js revisa para encontrar el manejador
 * de su worker cuando el entorno no tiene Web Workers (React Native): sin
 * ella, pdf.js no puede arrancar su worker en hilo principal.
 */
declare global {
  var pdfjsWorker: typeof import('pdfjs-dist/legacy/build/pdf.worker.mjs') | undefined;
}

export {};
