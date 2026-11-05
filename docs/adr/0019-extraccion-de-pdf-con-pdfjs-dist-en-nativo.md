# ADR-0019 — La extracción del PDF usa pdfjs-dist en web y en nativo

- **Estado**: Aceptada
- **Fecha**: 2026-11-03
- **Ámbito**: `src/services/pdf/`

## Contexto

[ADR-0003](0003-extraccion-local-de-pdf-con-pdfjs-dist.md) decidió que la extracción del PDF
fuera local y con `pdfjs-dist`, pero solo en web. En nativo quedó un **fallback heurístico**
que buscaba cadenas legibles sobre los bytes crudos del archivo, sin decodificar los content
streams comprimidos (`FlateDecode`).

La constancia del IMSS guarda su texto en streams comprimidos, así que en el dispositivo ese
fallback no encontraba las etiquetas del documento: devolvía la estructura del PDF (objetos,
`xref`, bytes del stream) y algún monto suelto. El parser, alimentado con ese ruido, informaba
cosas falsas: que "la constancia no incluye el historial detallado de modificaciones
salariales" (sí lo incluye) y que "el PDF puede estar escaneado" (el PDF está bien; el
extractor no sabía leerlo).

Además, la documentación prometía que un *development build* habilitaría la lectura completa
(ADR-0003 y el banner de la pantalla de importación): no era cierto. La resolución del módulo
es por plataforma, no por tipo de build, así que en iOS con development build seguía el
fallback.

## Decisión

**El texto del PDF se extrae con `pdfjs-dist` en las dos plataformas.** La diferencia está solo
en dónde corre el worker de pdf.js:

| Plataforma | Worker | Archivo |
|---|---|---|
| Web | Web Worker real, servido desde `/public/pdfjs/` | `PdfTextExtractor.web.ts` |
| Nativo | Worker en el hilo principal (*fake worker*) | `PdfTextExtractor.ts` |

pdf.js arranca su worker en el hilo principal cuando recibe el manejador en la variable global
`globalThis.pdfjsWorker` (`PDFWorker._setupFakeWorkerGlobal`). Es el mecanismo que el propio
pdf.js ofrece para los entornos sin Web Workers. Es el **mismo motor y el mismo worker** que en
web, así que el texto extraído es idéntico en las dos plataformas —importa, porque los patrones
de `PersonalDataParser` están calibrados contra ese texto.

Para que pdf.js pueda cargarse en React Native hacen falta dos shims, en
`src/services/pdf/pdfjsEnvironment.ts`:

- **`DOMMatrix`**: Hermes no lo implementa y pdf.js hace `new DOMMatrix()` **al importarse**
  (no solo al renderizar). Sin el shim, importar pdf.js revienta la app al arrancar.
- **`structuredClone`**: pdf.js clona el sobre de cada mensaje con
  `structuredClone(valor, null)` cuando no hay transferencias. El polyfill que instala Expo
  (`@ungap/structured-clone`) no tolera ese `null` y su variante "nativa" se llama a sí misma
  en bucle. El shim comprueba la implementación global y, si no aguanta, instala una propia.

El **fallback heurístico se elimina**. Un lector que devuelve ruido es peor que uno que no
devuelve nada: llenaba el formulario con números inventados.

pdf.js carga su worker con un `import()` dinámico, que Hermes no compila. Como la app siempre
entrega el worker por `globalThis.pdfjsWorker`, esa ruta es código muerto: se elimina con un
parche de `patch-package` (`patches/pdfjs-dist+6.2.108.patch`), que además deja el bundle
compilable. El mismo parche desactiva la carga dinámica del decodificador WASM de imágenes
(JPEG2000/JBIG2), que solo se usa al renderizar y no al extraer texto.

**pdf.js entrega el texto por streaming y React Native no tiene `ReadableStream`.** En la
versión 6, `page.getTextContent()` pide el texto como un `ReadableStream`: React Native no
tiene ese global (ni Hermes ni Expo lo instalan; Metro solo inyecta los polyfills de
`@react-native/js-polyfills`, que no incluyen streams), así que la llamada lanzaba
`Property 'ReadableStream' doesn't exist`, la extracción devolvía cadena vacía y la app
informaba que el PDF "parece estar escaneado". El parche cambia esa ruta por la equivalente
**por promesa** (`sendWithPromise`), que entrega el mismo texto: el worker acumula los trozos
y los devuelve enteros en lugar de encolarlos en un stream.

## Consecuencias

### Positivas

- **iOS extrae igual que web.** Es la diferencia entre importar la constancia en un minuto y
  escribir veinte campos a mano.
- **El parser no cambia.** Mismo motor, mismo texto, mismos patrones.
- **Los avisos vuelven a ser ciertos.** "El PDF parece escaneado" solo aparece cuando el
  documento no tiene texto seleccionable.
- Una sola ruta de extracción que se puede probar de punta a punta.

### Costes

- **El bundle nativo crece** con el worker de pdf.js (≈1.3 MB minificado).
- **En nativo el parseo bloquea el hilo principal**: no hay Web Workers, así que no hay
  paralelismo. Se acepta: el flujo ya muestra un indicador de "Procesando PDF…".
- **Dos shims que la app tiene que mantener** (`DOMMatrix` y `structuredClone`), atados a lo
  que pdf.js y Expo hacen hoy.

## Alternativas descartadas

- **OCR local (ML Kit / VisionKit).** Descartado: exige módulo nativo y varios MB, y resuelve
  un caso (PDF escaneado) que la entrada manual ya cubre.
- **Módulo nativo con PDFKit.** Descartado: solo resuelve iOS, y PDFKit devuelve el texto en
  orden de lectura, no en el orden de dibujado del content stream que asumen los patrones del
  parser.
- **Mantener el fallback heurístico como red de seguridad.** Descartado: devolvía ruido y el
  parser lo tomaba por datos.
- **Subir `pdfjs-dist` a 6.5.x.** La versión nueva mueve el uso de `DOMMatrix` a un campo
  perezoso y hace innecesario ese shim, pero también cambia el texto que produce pdf.js, y los
  patrones de `PersonalDataParser` están calibrados contra el texto de la versión actual.
  Queda como mejora a evaluar por separado, con sus propias pruebas de regresión sobre el
  parser.
- **OCR en la nube.** Descartado por [ADR-0002](0002-cero-backend-todo-en-el-dispositivo.md) y
  [ADR-0009](0009-cero-telemetria-y-cero-servicios-de-terceros.md): la constancia laboral no
  sale del dispositivo.

## Verificación

- `src/__tests__/PdfTextExtractor.test.ts` — extrae el texto de un PDF con contenido
  comprimido (el caso que fallaba en iOS) y de uno sin comprimir; devuelve vacío ante base64
  inválido y ante un archivo que no es PDF, sin lanzar; y **extrae el texto aunque el entorno
  no tenga `ReadableStream`**, que es el caso de React Native.
- `src/__tests__/domMatrixPolyfill.test.ts` — la matriz afín 2D del shim: identidad,
  composición, inversión y copia.
- `src/__tests__/structuredClonePolyfill.test.ts` — el clon: objetos, arreglos, binarios,
  fechas, Map, Set y referencias circulares.
- **Reproducción bajo Hermes real**: el motor que usa la app (`ios/Pods/hermes-engine`) se
  puede ejecutar fuera del teléfono; con el mismo bundle de Metro, el texto extraído del
  PDF es **idéntico** al de Node (mismo largo y mismo checksum). Antes del parche, bajo
  Hermes la extracción devolvía vacío.

Pendiente de verificación en dispositivo físico: la extracción real de la constancia del
IMSS en iOS (el runbook
[04-diagnosticar-un-fallo-de-importacion-de-pdf.md](../runbooks/04-diagnosticar-un-fallo-de-importacion-de-pdf.md)
tiene el procedimiento).
