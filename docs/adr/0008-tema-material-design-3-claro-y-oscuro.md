# ADR-0008 — Tema Material Design 3 con modo claro y oscuro

- **Estado**: Aceptada (la paleta de colores fue sustituida por [ADR-0011](0011-sistema-de-diseno-esmeralda-y-superficies-degradadas.md);
  el resto de esta decisión —MD3, modo claro/oscuro, `BANNER_COLORS`, cero hex en pantallas— sigue vigente)
- **Fecha**: 2026-08-01
- **Ámbito**: `src/theme/`

## Contexto

La app se usa en dos contextos muy distintos: a plena luz en una ventanilla y en el
transporte público de noche. El modo oscuro no es un lujo: en una pantalla OLED a brillo
bajo, un fondo blanco es molesto y consume batería.

El riesgo de un tema dual es siempre el mismo: **los colores hardcodeados**. Si una
pantalla define `#1565C0` en un `<Text>`, en modo oscuro ese azul sobre fondo oscuro puede
quedar ilegible. La app ya pasó por ese bug: el commit `9e996ac` replaces los colores
hardcodeados por colores sensibles al tema.

## Decisión

## Paleta

> La paleta original (azul Material `#1565C0` + naranja `#FF6F00`) fue sustituida por la
> paleta esmeralda de [ADR-0011](0011-sistema-de-diseno-esmeralda-y-superficies-degradadas.md).
> El resto de esta decisión no cambia.

**React Native Paper con los temas Material Design 3 (`MD3LightTheme` y `MD3DarkTheme`),
y una paleta propia declarada en un solo lugar.**

- `src/theme/index.ts` define la paleta (`COLORS`) una vez, y exporta `lightTheme` y
  `darkTheme` como `MD3Theme`.
- `src/theme/useAppTheme.ts` decide el tema activo según el esquema de color del sistema
  (`userInterfaceStyle: "automatic"` en `app.json`).
- **Los pares fondo/texto de los banners viven en `BANNER_COLORS`**, con su variante
  oscura al lado. `getBannerColors(variant, isDark)` es el único lugar que decide el
  contraste de un aviso, y garantiza que la variante oscura exista para cada banner.
- Los componentes consumen `useTheme()` o `getBannerColors()`; **no hay hex literales en
  las pantallas**.

Reglas que acompañan la decisión:

- **El componente `MessageBanner` es el único que pinta avisos** (warning, error,
  success, info). Se consolidó en el commit `c74ca0a` justamente para eliminar
  duplicación de colores y de lógica de aviso.
- `EstimationDisclaimerCard` es un componente propio, no un banner: el aviso legal de
  estimación tiene que verse igual en todas partes donde aparece, y ese componente es
  su punto único de definición.

## Consecuencias

### Positivas

- **El modo oscuro es correcto por construcción**, no por revisión manual: si un color
  no está en el tema, no se usa.
- `BANNER_COLORS` garantiza que cada tipo de aviso tenga su par oscuro, con el
  contraste elegido una vez.
- React Native Paper da componentes accesibles y consistentes (botones, campos,
  listas) sin escribirlos.
- La paleta es la misma en la app y en el PDF exportado, porque ambos salen de las
  mismas constantes.

### Costes

- React Native Paper es una dependencia de runtime y añade peso al bundle.
- **Un componente propio no puede usar los tokens de Paper**, así que hay que
  mantener una paleta propia para los elementos con diseño a medida (filas de resumen,
  tarjetas de resultado).
- El modo oscuro requiere revisar las capturas de pantalla de la app cuando se añade
  una superficie nueva.

## Alternativas descartadas

- **Estilos en cascada con `Appearance` y colores en línea.** Se descartó porque
  reintroduce el bug que ya se corrigió una vez: hex literales que no se adaptan.
- **Solo modo claro.** Se descartó por accesibilidad y por uso real: la app se usa de
  noche.
- **Colores del sistema operativo (Dynamic Type / semantic colors).** Se descartó por
  falta de control sobre la identidad visual y porque el paquete no cubre todos los
  casos de las superficies propias.
- **Un único tema con `prefers-color-scheme` en CSS web sin React Native Paper.** Se
  descartó porque la app es React Native y la variante web es secundaria.
