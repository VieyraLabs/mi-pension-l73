# Runbook-08 — Auditar el contraste de la interfaz

## Cuándo se usa

- Después de cambiar cualquier color del tema (`src/theme/index.ts`).
- Después de añadir o cambiar una superficie con degradado.
- Antes de una publicación, junto con la revisión previa (runbook 06).
- Cuando alguien diga "el texto no se lee bien": primero se mide, luego se discute.

## Antes de empezar

- Node 24 y el toolchain verificado (runbook 07).
- El navegador de Playwright instalado: `npx playwright install chromium`.
  Sin esto el script falla con un error de binario ausente.

## Por qué existe este runbook

El tema claro y oscuro **no se puede revisar a ojo**. Un verde de marca se ve bien en la
maqueta y falla en los botones: el texto blanco encima da 3.77:1 cuando WCAG AA pide
4.5:1. Eso es exactamente lo que pasó con `#059669` antes de cambiarlo a `#047857`
(ver [ADR-0011](../adr/0011-sistema-de-diseno-esmeralda-y-superficies-degradadas.md)).

La captura de pantalla miente: en una imagen el texto blanco sobre verde medio "se ve
legible", pero el cálculo dice que no. Este runbook mide en el DOM real.

## Pasos

1. Ejecuta la auditoría:

   ```bash
   npm run audit:contraste
   ```

   El script hace todo solo: exporta la app a web (`expo export`), la sirve en un puerto
   libre, abre las cuatro pestañas en modo claro y oscuro y calcula el ratio de cada
   texto contra su fondo efectivo.

2. Lee la salida. El script **falla con exit 1** si hay texturas por debajo del mínimo,
   así que sirve como control en CI:

   ```
   3/3 Auditando contraste en claro y oscuro…
       [light / Inicio] 2 falla(s):
         3.77 (min 4.5) 10px/400 color=rgb(5, 150, 105) bg=rgb(255, 255, 255) — "Inicio"
   ❌ Contraste: 2 falla(s).
   ```

3. Si hay fallas, **corrige el color en `src/theme/index.ts`**, nunca en la pantalla
   (ADR-0008: el color sale del tema). Repite el paso 1.

4. Si cambiaste el color primario, actualiza también:
   - `src/services/export/pdfExport.ts` — la paleta del PDF está sincronizada a mano.
   - `app.json` — el `backgroundColor` del icono adaptativo de Android.
   - La paleta documentada en el ADR-0011 y en la spec 08.

## Verificación

El comando termina con una de estas dos líneas:

```
✅ Contraste: 0 fallas de WCAG AA.
```

Esa línea es la prueba. Si el script falla por otro motivo (puerto ocupado, binario
ausente), no cuenta como verificación: no hubo medición.

## Si algo falla

| Síntoma | Causa | Qué hacer |
|---|---|---|
| `Error: listen EADDRINUSE` | Ya hay un servidor en el puerto | El script usa un puerto libre automático; si persiste, cierra el proceso anterior |
| `Executable doesn't exist` | Falta el navegador de Playwright | `npx playwright install chromium` |
| `Cannot find module 'playwright'` | No se instalaron las devDependencies | `npm install` |
| Falla en un texto con `sobreDegradado` | El degradado tapa el color de fondo y el texto no tiene contraste | Oscurecer los tonos del degradado en `getBrandGradient` |
| Falla en la etiqueta de una pestaña | El color primario se usa como texto sobre superficie clara | Oscurecer `COLORS.brand` hasta llegar a 4.5:1 |

### Lectura de la salida

| Campo | Significado |
|---|---|
| `ratio` | Contraste real medido |
| `min` | Mínimo exigido: 4.5:1, o 3:1 si el texto es grande (≥24px, o ≥18.66px en negrita) |
| `color` / `bg` | Color del texto y fondo efectivo, para saber qué corregir |
| `sobreDegradado` | El texto está sobre un degradado: se midió contra su **tono peor**, no contra el punto medio |
