/**
 * Constructor de PDFs mínimos para las pruebas de extracción de texto.
 *
 * Reproduce lo que hace la constancia del IMSS: el texto vive en un content
 * stream COMPRIMIDO (FlateDecode). Es el caso que broke la extracción en
 * iOS cuando el extractor solo buscaba cadenas legibles sobre los bytes del
 * archivo: el texto comprimido no se ve en los bytes.
 *
 * Solo se usa en pruebas: el archivo se arma en memoria, no se versiona.
 */
import zlib from 'zlib';

export interface PdfFixtureOptions {
  /** Comprime el content stream con FlateDecode (por defecto: sí). */
  compress?: boolean;
  /** Tamaño de página en puntos. */
  pageSize?: { width: number; height: number };
}

/**
 * Arma un PDF de una sola página con una línea de texto por renglón.
 */
export function buildPdfFixture(lines: string[], options: PdfFixtureOptions = {}): Buffer {
  const { compress = true, pageSize = { width: 612, height: 792 } } = options;

  const textOps = lines
    .map((line, index) => {
      const escaped = line.replace(/([()\\])/g, '\\$1');
      const y = pageSize.height - 52 - index * 20;
      return `BT /F1 11 Tf 40 ${y} Td (${escaped}) Tj ET`;
    })
    .join('\n');

  const raw = Buffer.from(textOps, 'latin1');
  const streamData = compress ? zlib.deflateSync(raw) : raw;
  const filter = compress ? '/Filter /FlateDecode ' : '';

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageSize.width} ${pageSize.height}] ` +
    '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>';
  objects[4] = `<< ${filter}/Length ${streamData.length} >>\nstream\n${streamData.toString('latin1')}\nendstream`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

/** Codifica un buffer en base64, como lo hace `expo-document-picker`. */
export function toBase64(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('base64');
}
