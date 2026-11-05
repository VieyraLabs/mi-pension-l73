/**
 * Declaraciones de los paquetes que no publican tipos.
 *
 * `pdfjs-dist/legacy/build/pdf.mjs` sí trae `pdf.d.mts`, pero el worker no.
 *
 * Este archivo NO es un módulo a propósito: las declaraciones `declare
 * module` solo son Ambient cuando el archivo no tiene imports/exports.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
