# ADR-0011 — Sistema de diseño esmeralda con superficies degradadas

- **Estado**: Aceptada
- **Fecha**: 2026-10-26
- **Ámbito**: `src/theme/`, `src/components/`, `src/screens/`
- **Sustituye**: parte de [ADR-0008](0008-tema-material-design-3-claro-y-oscuro.md) (la paleta de
  colores; el resto de ADR-0008 —MD3, modo claro/oscuro, `BANNER_COLORS`, cero hex en
  pantallas— sigue vigente)

## Contexto

La app arrastraba una identidad visual heredada: azul Material (#1565C0) y naranja de
acento (#FF6F00), con superficies planas. El resultado era visualmente genérico y, en
concreto, **el dato más importante de la app no destacaba**: la pensión mensual estimada
competía en el mismo plano visual que un chip informativo o una fila de resumen.

Un rediseño de este tipo se puede hacer de dos maneras: cambiar colores sueltos pantalla
por pantalla, o convertir el color en un **sistema**. La primera produce el problema que
ADR-0008 ya resolvió — hex literales dispersos que se rompen en modo oscuro. La segunda
concentra la decisión en un lugar y hace que la interfaz "se vea profesional" sin
esparcir decisiones.

La app es además un producto financiero: la convención visual del sector (fintech,
seguros, retiro) usa verdes profundos para "crecimiento/ahorro" y reserva los colores
cálidos para advertencias. El azul genérico no comunicaba nada del dominio.

## Decisión

**Una paleta esmeralda con tokens semánticos, más degradados de marca como superficie
protagonista, y componentes compartidos que eliminan el código duplicado de UI.**

### 1. Paleta: esmeralda de marca, violeta secundario, ámbar de acento

- **Primario (marca)**: esmeralda `#047857` (claro) / `#34D399` (oscuro). Es el color de
  la acción principal y de las cifras de dinero.
  **El tono es profundo a propósito**: un esmeralda medio (`#059669`) daba 3.77:1 con
  texto blanco en los botones y 3.22:1 sobre la superficie variante — por debajo del
  4.5:1 de WCAG AA. `#047857` sube a 5.48:1 y 4.87:1, y el texto blanco sobre el
  degradado queda en 5.47:1 en ambos modos.
- **Secundario**: violeta `#7C3AED` / `#A78BFA`. Distingue el *Escenario B* del
  *Escenario A* en el simulador sin recurrir a un color arbitrario.
- **Terciario (acento)**: ámbar `#D97706`. Reservado para "importar PDF" y acciones
  secundarias que no compiten con la principal.
- **Neutros fríos (slate)** en lugar de grises puros: `#0F172A` (texto), `#F6F8FB`
  (fondo), `#94A3B8` (outline). En modo oscuro, azul pizarra profundo (`#0B1120`
  fondo, `#151E31` superficie) en vez del gris `#121212` anterior.

### 2. El degradado de marca es una superficie, no un adorno

`getBrandGradient(isDark)` en `src/theme/index.ts` es el **único** lugar que define el
degradado. Las superficies que lo usan (encabezados de pantalla, tarjeta del resultado
principal, interruptor de Modalidad 40) son las que llevan la jerarquía de la app:

- El **resultado de la pensión** domina la pantalla: degradado y radio amplio (20),
  inmediatamente bajo el aviso legal (que precede a la cifra a propósito: es una
  estimación y el aviso debe leerse antes del número).
- Los **encabezados de pantalla** son degradados (antes: superficies planas de color
  primario), y unifican cuatro pantallas que cada una había reinventado el patrón.
- El degradado usa puntos profundos a propósito: el texto encima es blanco y así se
  mantiene contraste ≥ 4.5:1 (WCAG AA) en ambos modos.

### 3. Componentes compartidos nuevos

Dos pantallas o más que resuelven el mismo problema se extraen a un componente, en lugar
de copiar el `StyleSheet`:

- **`ScreenHeader`**: encabezado degradado de pantalla. Reemplaza el patrón
  `Surface + primary` duplicado en Dashboard, Info, FAQ y PdfImport.
- **`StepProgress`**: indicador de progreso del formulario (contador + `ProgressBar` +
  puntos). Reemplaza el bloque de puntos dibujado a mano en NewSimulation.

Además, `ResultScreen` pasa de un botón "Ver desglose" (que empujaba el contenido hacia
abajo) a un `List.Accordion`: toda la cabecera es táctil, y el contenido plegable es
accesible por teclado y lector de pantalla.

### 4. Diálogos de Paper en vez de `Modal` crudo

`HistoryScreen` usaba un `Modal` de React Native montado dentro de un `Portal`, con
overlay y botones manuales. Se reemplaza por `Dialog` de React Native Paper: hereda el
tema (radio, tipografía, colores) y el foco de accesibilidad de forma nativa.

### 5. Usabilidad en el formulario

- La fila completa de **Modalidad 40** es táctil, no solo el switch: se ajusta a
  `TouchableOpacity` con degradado, y el texto explica el estado ("¿Deseas cotizar…? Toca
  aquí" / "✓ Cotizando en Modalidad 40").
- El campo **edad de retiro** muestra el sufijo "años" (`TextInput.Affix`), igual que los
  campos de dinero usan "$".
- El historial muestra la **pensión mensual en una insignia destacada**
  (`primaryContainer`) en vez de una fila más del montón.
- El simulador **marca con borde de color** la tarjeta del escenario ganador.
- Los botones principales usan radio consistente (12–14) y `contentStyle` con
  `paddingVertical` para una altura de toque cómoda.

### 6. La paleta del PDF exportado se sincroniza

El PDF es un documento de impresión con diseño propio (excepción registrada en
`src/services/export/pdfExport.ts`), pero su paleta se actualiza a mano para que coincida
con la de la app: esmeralda, ámbar y neutros slate, incluido el degradado del bloque de
resultado.

## Consecuencias

### Positivas

- **La cifra que importa destaca de verdad**: la pensión mensual es lo primero que se ve
  en `ResultScreen`, con la jerarquía visual que corresponde.
- **Una sola fuente de verdad para la identidad visual**: cambiar la marca es editar
  `src/theme/index.ts`, no recorrer pantallas. El ADR-0008 sigue vigente: cero hex
  literales en `src/screens/` y `src/components/` (verificable con grep).
- **Menos duplicación**: `ScreenHeader` y `StepProgress` eliminan dos patrones repetidos
  en cuatro y una pantallas respectivamente; `Dialog` elimina el overlay manual.
- **Contraste correcto en ambos modos**, incluido el texto sobre degradado. El color
  primario se eligió por medición, no por gusto: un verde medio se veía bien en la
  maqueta y fallaba en los botones.
- **Accesibilidad**: áreas de toque más grandes, objetivos táctiles más amplios, diálogos
  nativos con foco correcto, `List.Accordion` navegable por lector de pantalla.

### Costes

- Una dependencia nueva de runtime: `expo-linear-gradient` (librería oficial de Expo,
  sin dependencias extra y ya incluida en el SDK).
- `BRAND_ON_COLOR` es un token aparte de `onPrimary`: el texto sobre degradado es blanco
  en ambos modos, y `onPrimary` en modo oscuro es un verde oscuro que no serviría sobre
  un degradado saturado.
- **El tema de Paper no puede expresar un degradado**, así que el degradado vive en el
  tema de la app — misma categoría de coste que la paleta propia que ya tenía ADR-0008.

## Alternativas descartadas

- **Una librería de UI de terceros completa** (NativeWind, Tamagui, Unistyles 3 con
  Tailwind v4). Se descartó porque el repo ya está construido sobre React Native Paper
  + MD3, y una migración de estilos reescribiría toda la capa de UI sin mejorar el
  resultado visible; el problema a resolver —jerarquía visual y coherencia— se resuelve
  con tokens y componentes compartidos, que es lo que se hizo.
- **Degradados solo en el resultado principal.** Se descartó porque la coherencia visual
  exige que el degradado signifique siempre "esto es lo importante", no que aparezca en
  un lugar arbitrario.
- **Mantener el azul Material y cambiar solo los acentos.** Se descartó por no aportar
  identidad de dominio: el azul no distingue esta app de cualquier otra app financiera.
- **Colores hardcodeados por pantalla.** Es exactamente el bug que ADR-0008 corrigió; se
  descartó.
