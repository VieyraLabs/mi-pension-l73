# Spec-08 — Tema claro y oscuro

- **Estado**: Vigente
- **Ámbito**: `src/theme/`, `src/components/`, `src/screens/`, `app.json`

## Propósito

Que la app sea legible en cualquier condición de luz, que el cambio de tema no requiera
tocar las pantallas, y que la identidad visual sea coherente en toda la app.

## Comportamiento

El tema sigue el ajuste del sistema (`userInterfaceStyle: "automatic"` en `app.json`), sin
un interruptor propio: el usuario decide en su sistema operativo y la app lo respeta.

`useAppTheme()` expone el tema activo y `isDark`. Los componentes que necesitan un color
concreto lo piden al tema; los que pintan avisos usan `getBannerColors(variant, isDark)`.

## Sistema de diseño

La identidad visual es **esmeralda de marca**, con violeta secundario y ámbar de acento
(ver [ADR-0011](../adr/0011-sistema-de-diseno-esmeralda-y-superficies-degradadas.md)).

- **El degradado de marca es una superficie semántica**: `getBrandGradient(isDark)` lo
  define una sola vez y lo usan el encabezado de pantalla, la tarjeta del resultado
  principal y el interruptor de Modalidad 10. Significa "esto es lo importante".
- **`BRAND_ON_COLOR` es el color del texto sobre degradado** (blanco en ambos modos). No
  es `onPrimary`: en modo oscuro `onPrimary` es un verde oscuro que no alcanzaría
  contraste sobre un degradado saturado.
- **El resultado de la pensión domina la pantalla de resultado**: degradado y radio amplio,
  inmediatamente bajo el aviso legal. Es la cifra que el usuario busca, y el aviso
  precede a la cifra a propósito: es una estimación y debe leerse antes del número.
- **Los encabezados de pantalla son degradados** (`ScreenHeader`), no superficies planas
  de color primario.
- **Los diálogos de confirmación son `Dialog` de React Native Paper** (eliminar
  simulación, limpiar historial), no `Modal` crudo.

## Reglas de negocio

- **Ningún hex literal en las pantallas.** Todos los colores salen de `src/theme/index.ts`
  o de `useTheme()`. Es la regla que corrigió el bug de legibilidad del commit `9e996ac`.
- **Todo banner tiene su variante oscura.** `BANNER_COLORS` define los cuatro tipos
  (warning, success, error, info) con su par claro y oscuro, y `getBannerColors` es el
  único selector.
- **El aviso legal de estimación se ve siempre igual.** `EstimationDisclaimerCard` es un
  componente propio con su propio diseño, no un banner genérico, porque aparece en
  pantalla de resultado y en el reporte exportado.
- **La paleta del PDF exportado es la de la app.** El HTML del reporte usa los mismos
  colores definidos en el tema, para que el documento se lea como parte de la app.
- **Los componentes de UI compartidos no se duplican por pantalla.** Un patrón de UI que
  aparece en dos o más pantallas vive en un componente (`ScreenHeader`, `StepProgress`).
- **El contraste del texto sobre degradado es ≥ 4.5:1 (WCAG AA)** en modo claro y oscuro.
  Los puntos del degradado son profundos a propósito.
- **El color primario cumple 4.5:1 en los dos sentidos**: con texto blanco encima
  (botones) y como texto de marca sobre superficie clara (pestañas, etiquetas). El
  esmeralda `#047857` da 5.48:1 sobre blanco y 4.87:1 sobre la superficie variante.

## Fuera de alcance

- No hay selector de tema dentro de la app.
- No hay tema de alto contraste adicional.
- No hay personalización de la paleta por el usuario.
- No hay animación de transición entre tema claro y oscuro.

## Verificación

- Verificación manual en ambos modos sobre las ocho pantallas.
- `src/__tests__/ResultScreen.test.tsx` y `ValidationScreen.test.tsx` renderizan
  componentes que dependen del tema, lo que detecta roturas de contrato en la API del
  tema.
- `grep -rn "#[0-9A-Fa-f]\{6\}" src/screens src/components` no debe devolver
  resultados: es la verificación mecánica de la regla de "cero hex en pantallas".
- Auditoría de contraste sobre el DOM renderizado (build web): 0 textos por debajo del
  mínimo de WCAG AA en las tres pantallas de pestañas y en la pantalla de resultado,
  en modo claro y oscuro. La medición es reproducible con
  `npm run audit:contraste` (runbook 08).
