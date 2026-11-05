# ADR-0003 — La extracción de texto del PDF es local, con pdfjs-dist

- **Estado**: Sustituida por [ADR-0019](0019-extraccion-de-pdf-con-pdfjs-dist-en-nativo.md)
- **Fecha**: 2026-08-01
- **Ámbito**: `src/services/pdf/`

> **Sustituida.** La decisión de que la extracción fuera local y con `pdfjs-dist` sigue en pie,
> pero solo se aplicaba a web: en nativo quedó un fallback heurístico que no podía leer
> documentos comprimidos. [ADR-0019](0019-extraccion-de-pdf-con-pdfjs-dist-en-nativo.md) extiende
> `pdfjs-dist` a nativo y elimina ese fallback. Este documento se conserva como registro de la
> decisión original.

## Contexto

El usuario puede capturar su historial de cotización a partir de la *Constancia de
Semanas Cotizadas* del IMSS, que es un PDF. El atajo de captura (importar el documento y
que la app rellene los datos) es la diferencia entre un formulario de veinte campos y una
experiencia de un minuto.

Extraer texto de un PDF en móvil tiene un problema conocido: **no existe un parser de PDF
en JavaScript puro que funcione en nativo dentro de Expo Go**. `pdfjs-dist` funciona en
web, pero en nativo requiere un *development build* o un módulo nativo.

El documento además tiene dos formatos: el PDF digital con texto seleccionable y el PDF
escaneado como imagen. El segundo no tiene texto que extraer y no se puede resolver sin
OCR.

## Decisión

**La extracción es local y tiene dos rutas según la plataforma**, seleccionadas por la
resolución de módulo de Metro:

| Plataforma | Implementación | Archivo |
|---|---|---|
| Web | `pdfjs-dist` decodifica streams comprimidos y fuentes embebidas | `PdfTextExtractor.web.ts` |
| Nativo | Fallback heurístico: escaneo de cadenas legibles sobre los bytes | `PdfTextExtractor.ts` |

Reglas que acompañan la decisión:

- **Ningún servicio externo.** La extracción no sale del dispositivo
  (ver [ADR-0002](0002-cero-backend-todo-en-el-dispositivo.md)). Un OCR en la nube
  mandaría la constancia laboral a un tercero: descartado.
- **El fallback nativo se declara como fallback, no como soporte.** Su docstring dice
  explícitamente que no decodifica streams `FlateDecode` y que solo funciona con PDFs no
  comprimidos.
- **Fallo explícito, no silencio.** Si el texto extraído es menor a 50 caracteres, la app
  informa que el documento parece escaneado y pide la captura manual. Nunca rellena
  campos con valores inventados.
- **El parser es defensivo.** `PersonalDataParser.ts` trabaja sobre texto extraído, cuyo
  orden de columnas cambia entre versiones del documento del IMSS; por eso los patrones
  son tolerantes a variaciones y hay un parser dedicado por tipo de dato.
- **`pdfjs-dist` se actualizó por CVE** en el upgrade de Expo SDK 52 → 57
  (commit `011a738`). La dependencia se mantiene al día por seguridad, no por comodidad.

## Consecuencias

### Positivas

- **Privacidad garantizada por construcción**: la constancia nunca sale del dispositivo.
- El flujo de importación funciona en web con calidad real (`pdfjs-dist`).
- El fallback nativo degrada con honestidad: el usuario sabe qué puede y qué no puede
  hacer, en vez de recibir datos silenciosamente incorrectos.
- El parser es puro y está aislado: se puede probar con cadenas de texto sin necesidad de
  un PDF real.

### Costes

- **En nativo sin development build la extracción automática es limitada.** La ruta
  soportada de forma fiable es la web, o el development build de Expo.
- **El parser depende del formato del documento del IMSS.** Cuando el IMSS cambia el
  layout de la constancia, hay que actualizar los patrones. Se documenta en
  [`../runbooks/04-diagnosticar-un-fallo-de-importacion-de-pdf.md`](../runbooks/04-diagnosticar-un-fallo-de-importacion-de-pdf.md).
- Hay dos implementaciones de la misma función (`PdfTextExtractor.ts` y
  `PdfTextExtractor.web.ts`) que pueden divergir. Se mitiga con el caso de test
  compartido y con el comentario de cada archivo que explica por qué existe.

## Alternativas descartadas

- **OCR en la nube (Google Vision, AWS Textract, Azure Document Intelligence).** Se
  descartó porque enviaría la constancia de cotización a un tercero y porque introduce
  costo por uso, latencia de red y una dependencia de disponibilidad.
- **OCR local con ML Kit / VisionKit.** Se descartó porque requiere un módulo nativo
  (development build) y pesa varios megabytes en el binario para resolver un caso que la
  entrada manual cubre.
- **Parser de PDF en JavaScript puro (`pdf.js` portado a nativo).** Se descartó por
  volumen de dependencias y por mantenimiento en un entorno nativo que Expo no cubre.
- **No importar PDFs en absoluto.** Se descartó: es la diferencia entre una app que
  exige veinte campos y una que se usa en un minuto.
