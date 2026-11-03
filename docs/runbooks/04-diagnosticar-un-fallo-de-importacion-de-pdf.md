# Runbook-04 — Diagnosticar un fallo de importación de PDF

## Cuándo se usa

Cuando el usuario reporta que la app **no extrae los datos** de su constancia, o que extrae
datos equivocados. Es el fallo más frecuente de la app, porque depende del formato de un
documento emitido por el IMSS.

## Antes de empezar

Ten a mano:

- [ ] El PDF de la constancia con el que falla (el usuario debe compartirlo).
- [ ] La salida de `extractPdfText` con el texto crudo. La app tiene un paso de depuración
      para esto (commit `105c8d7`, "add debug view for raw extracted text").

## Pasos

### 1. Determinar en qué etapa falla

La importación tiene cuatro etapas y cada una falla de forma distinta:

| Síntoma | Etapa | Causa probable |
|---|---|---|
| "No se pudo abrir el selector de archivos" | Selección | Permisos del sistema |
| "No se seleccionó ningún archivo" | Selección | El usuario canceló |
| "No se descargó por completo al dispositivo" | Lectura | PDF en iCloud/Drive sin descargar |
| "No se pudo leer el archivo PDF" | Lectura | Archivo corrupto o base64 inválido |
| "El PDF parece estar escaneado" | Extracción | Sin texto seleccionable |
| Los campos salen vacíos o mal | Parsing | Cambió el formato del documento |

### 2. Verificar la extracción

En web, el flujo usa `pdfjs-dist` y debería extraer texto de cualquier PDF digital. En
nativo sin development build, el fallback heurístico **no decodifica streams
comprimidos** (`FlateDecode`): solo encuentra texto en PDFs no comprimidos. Si el
problema es específico de nativo, esa es casi seguro la causa.

### 3. Comparar el texto extraído con el esperado

Leer el texto crudo y localizar el campo que falla. Los casos que ya se han resuelto
documentan el patrón:

- `683b3b2` — faltaban NSS y SBC, y el nombre se extraía mal.
- `5d39f60` — el "último SBC" tomaba una fecha en vez del monto.
- `cd5786a` — los regex de historial y movimientos no coincidían con el orden real de
  columnas de `pdfjs-dist`.
- `4bf9a86` — detección de la columna de movimiento salarial y ventana de referencia del
  SBC promedio.
- Fila de movimiento `ALTA` — el IMSS emite un `ALTA` (el alta original de un empleo, con
  su SBC inicial) que el parser no reconocía. Su monto se colaba en la lista de SBC de
  encabezado, el conteo no cuadraba con el número de patrones y **todo** el historial se
  descartaba: el PDF traía la tabla completa y la app decía que no la traía. Al agregarlo
  se corrige además la fragilidad de fondo: el SBC de encabezado se ancla a su etiqueta, así
  que un monto desconocido ya no tumba la reconstrucción.

**El orden de las columnas del documento cambia entre versiones.** No se arregla con un
regex más permisivo sin más: se mira qué emite el IMSS ahora y se ajusta el parser.

**Un tipo de movimiento que no se reconoce es un fallo total, no parcial.** Antes de tocar
el regex, cuenta los tipos de movimiento que aparecen en la columna del documento (en el
texto crudo, los valores de esa columna) y compáralos con los que el parser acepta
(`REINGRESO`, `ALTA`, `MODIFICACION DE SALARIO`, `BAJA`). Si hay uno de más, ese es el
fallo.

### 4. Ajustar el parser

`src/services/pdf/parsers/PersonalDataParser.ts`. Puntos de atención:

- Los patrones deben tolerar la variación de **orden** de columnas, no solo de espacios.
- Cada campo tiene su propio patrón; no se depende de un único regex global.
- Un campo que no se encuentra debe quedar **sin valor**, no con un valor aproximado.
- El SBC de encabezado de cada patrón se **ancla a su etiqueta**, no se identifica contando
  montos sueltos: si se cuenta, cualquier dato que no se sepa a qué pertenece descuadra el
  emparejamiento y tumba el historial completo.
- El emparejamiento por patrón solo se abandona por **estructura** (altas, nombres o
  montos de encabezado que no cuadran). Un monto sin atribuir se advierte, no se tira todo.

### 5. Probar con el texto real

El parser es una función pura: se puede probar con una cadena de texto, sin PDF.

```bash
npx jest src/__tests__/personalDataParser.test.ts
```

Añadir el caso con el texto real que falló, con el valor esperado. **El caso de prueba
del fallo es lo que evita la regresión.**

### 6. Verificar el final

```bash
npm run typecheck && npm run lint && npm run test:run
```

## Verificación

- [ ] El PDF que fallaba extrae ahora los campos correctos.
- [ ] El caso de prueba del fallo quedó en la suite.
- [ ] Un PDF escaneado sigue produciendo el mensaje honesto y la entrada manual.

## Si algo falla

**El texto sale vacío pero el PDF sí tiene texto.** En nativo, el fallback heurístico no
decodifica streams comprimidos. Es una limitación conocida y documentada, no un bug de
parsing. La ruta soportada es la web o un development build.

**El texto sale con los caracteres mal codificados.** La constancia usa una codificación
distinta a UTF-8. Ajustar la decodificación en `PdfTextExtractor`.

**El texto sale bien pero los campos no.** El problema está en el parser, no en la
extracción. Volver al paso 3 y comparar el texto crudo con los patrones.
