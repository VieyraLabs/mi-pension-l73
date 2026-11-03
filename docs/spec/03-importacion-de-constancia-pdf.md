# Spec-03 — Importación de la constancia en PDF

- **Estado**: Vigente
- **Ámbito**: `src/services/pdf/`, `src/screens/PdfImportScreen.tsx`, `src/screens/ValidationScreen.tsx`

## Propósito

Permitir que el usuario capture sus datos de cotización y salario directamente desde la
*Constancia de Semanas Cotizadas* del IMSS, en lugar de escribirlos a mano en un formulario
de veinte campos.

## Comportamiento

El flujo tiene cuatro etapas:

1. **Selección.** `importPdf()` abre el selector de documentos del sistema filtrado a
   `application/pdf`, con `copyToCacheDirectory: true` y `base64: true`.
2. **Lectura.** En web se toma el contenido del `data:` URL; en nativo se lee el archivo
   con `expo-file-system/legacy`. Antes de leer, se verifica que el archivo exista y no
   mida cero bytes.
3. **Extracción.** `extractPdfText(base64)` devuelve el texto. En web usa `pdfjs-dist`;
   en nativo, el fallback heurístico (ver
   [ADR-0003](../adr/0003-extraccion-local-de-pdf-con-pdfjs-dist.md)).
4. **Parsing y validación.** `PersonalDataParser` extrae nombre, CURP, NSS, semanas
   cotizadas, SBC y movimientos salariales. La pantalla de validación muestra lo
   extraído y deja corregirlo antes de confirmar.

## Reglas de negocio

- **Un archivo sin texto utilizable no produce campos inventados.** Si el texto extraído
  tiene menos de 50 caracteres, la app informa que el documento parece escaneado, declara
  los campos que faltan (`Nombre`, `CURP`, `NSS`, `Semanas cotizadas`, `SBC`) y pide la
  entrada manual.
- **El archivo nunca sale del dispositivo.** No hay envío a ningún servidor
  ([ADR-0002](../adr/0002-cero-backend-todo-en-el-dispositivo.md)).
- **Un archivo de 0 bytes produce un mensaje específico**, no un error genérico: es el
  caso de un PDF en iCloud Drive que aún no se descargó al dispositivo, y el mensaje le
  dice al usuario que lo abra antes en la app de Archivos.
- **LaCURP puede derivar la fecha de nacimiento** cuando el documento no la incluye
  (commit `67c086d`).
- **El parser tolera variaciones de formato.** El orden de las columnas cambia entre
  versiones del documento del IMSS; los patrones aceptan columnas en distinta posición.
- **El parser reconoce todos los tipos de movimiento que emite el IMSS:** `REINGRESO`,
  `ALTA` (el alta original de un empleo, con su SBC inicial), `MODIFICACION DE SALARIO` y
  `BAJA`. Un tipo que falte no es inocuo: su monto se colaría en la lista de SBC de
  encabezado, el emparejamiento por patrón dejaría de cuadrar y **todo** el historial se
  descartaría — el documento que sí trae la tabla completa terminaría sin SBC promedio.
- **El SBC de encabezado de cada patrón se ancla a SU etiqueta** ("Salario Base de
  Cotización"), no se identifica contando todos los montos `$` del documento. Así, un monto
  que no se sabe a qué pertenece no destruye la reconstrucción: se reporta como **monto sin
  atribuir** y la persona lo ve en el aviso. La etiqueta se reconoce con o sin tilde y con o
  sin el asterisco; la nota al pie ("…último salario base de cotización diario en pesos.")
  no cuenta como etiqueta.
- **El parser abandona la reconstrucción solo cuando la ESTRUCTURA no cuadra** (faltan o
  sobran altas, nombres o montos de encabezado). Ahí no se adivina a qué patrón pertenece
  cada dato: se deja el SBC promedio en blanco y se pide la captura manual.
- **El aviso distingue los dos fallos.** Cuando el documento **no** trae la tabla de
  movimientos, se dice que no la trae y se pide la constancia correcta. Cuando **sí** la
  trae pero no se pudo reconstruir, se dice eso: descargar otro documento no lo arregla.
- **Nada se descarta al confirmar.** Los datos importados que el usuario corrige se
  conservan: el flujo `Validación → Confirmar` propaga el input editado
  (commit `6ec5784`).
- **El detalle SBC que se expone queda acotado a la ventana del promedio.** El parser
  entrega en `data.sbcPeriods` solo los periodos que **solapan** la ventana de las
  últimas 250 semanas cotizadas (los que el `ContributionSummary` reporta como
  `firstWeekUsed`–`lastWeekUsed`), ordenados de más reciente a más antigua. Un empleo
  anterior a esa ventana no pesa en el cálculo del SBC promedio y por eso no se expone.
  El filtro acota lo que se MUESTRA: el promedio se sigue calculando con el historial
  completo, que es lo que permite saltar los huecos laborales y alcanzar las 250 semanas
  cotizadas (ver [Spec-07](07-historial-de-cotizacion-y-promedio-sbc.md) y
  [ADR-0010](../adr/0010-sbc-promedio-desde-el-historial-de-cotizaciones.md)).
- **El detalle SBC que se expone son periodos con SBC EFECTIVO, no periodos por patrón.**
  `data.sbcPeriods` entrega `SBCPeriodSegment`: cada elemento es un intervalo en el que el
  conjunto de patrones concurrentes es el mismo, y su `sbc` es la **suma** de los SBC de esos
  patrones (integración de salarios por empleo simultáneo). Los patrones concurrentes se
  nombran en `employerNames`. El parser construye los segmentos con
  `buildContributionSegments` y los acota con `selectSegmentsInAverageWindow`; el promedio
  se calcula con el mismo barrido por intervalos sobre esos segmentos, así que el número
  que se muestra es el número que se promedia. No cambia la cifra del promedio: solo cambia
  cómo se desglosa.

## Fuera de alcance

- **OCR.** No hay reconocimiento óptico de caracteres: un PDF escaneado requiere captura
  manual (ver [ADR-0003](../adr/0003-extraccion-local-de-pdf-con-pdfjs-dist.md)).
- No se importan otros documentos que no sean la constancia de semanas cotizadas.
- No se guardan los archivos importados: solo el texto derivado y, si el usuario lo
  confirma, la simulación.

## Verificación

- `src/__tests__/PdfImporter.test.ts` — selección cancelada, archivo inexistente,
  archivo de 0 bytes, base64 inválido.
- `src/__tests__/PdfTextExtractor.test.ts` — extracción nativa y su fallback.
- `src/__tests__/personalDataParser.test.ts` — extracción de cada campo, incluyendo los
  casos en que el formato del documento cambió (los casos que motivaron los commits
  `683b3b2`, `5d39f60`, `cd5786a`); **la fila de movimiento `ALTA`** (una constancia real
  con esa fila llegaba sin SBC promedio porque su monto descuadraba el emparejamiento por
  patrón); un monto sin atribuir no descarta el historial pero se advierte; el parser sigue
  sin adivinar cuando la estructura del documento no cuadra; la etiqueta del SBC de
  encabezado se lee con o sin tilde y con o sin asterisco, y la nota al pie no cuenta como
  etiqueta; orden de los periodos SBC expuestos y acotación de la lista a la ventana del
  promedio, sin que el promedio cambie; **periodos con SBC efectivo**: el periodo común a
  dos patrones vale la suma de sus SBC y los nombra, y el promedio no cambia por desglosar
  en periodos.
- `src/__tests__/ValidationScreen.test.tsx` — presentación y confirmación de los datos
  extraídos; lista de los periodos SBC CONSIDERADOS en el promedio; el periodo traslapado
  se muestra con el SBC **sumado** y con los dos patrones, y una nota explica la regla.
