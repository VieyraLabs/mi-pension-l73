# Specs

Especificaciones de comportamiento. Cada spec describe **qué** hace el sistema, **quién lo
verifica** y **qué queda explícitamente fuera**.

Una spec no explica por qué el sistema es así: eso es trabajo de las
[ADRs](../adr/). Una spec explica qué tiene que ser cierto, y cómo se comprueba.

## Índice

| # | Spec | Verificación |
|---|---|---|
| [01](01-motor-de-calculo-ley-73.md) | Motor de cálculo Ley 73 | `src/__tests__/pensionCalculator.test.ts`, `src/__tests__/legalAge.test.ts`, `src/__tests__/pensionSchema.test.ts`, `src/__tests__/weeksProjection.test.ts` |
| [03](03-importacion-de-constancia-pdf.md) | Importación de la constancia en PDF | `PdfImporter.test.ts`, `PdfTextExtractor.test.ts`, `personalDataParser.test.ts`, `contributionHistory.test.ts`, `ValidationScreen.test.tsx` |
| [04](04-exportacion-del-reporte-en-pdf.md) | Exportación del reporte en PDF | `src/__tests__/pdfExport.test.ts` |
| [05](05-historial-de-simulaciones.md) | Historial de simulaciones | `simulationStorage.test.ts`, `useHistory.test.ts` |
| [06](06-captura-y-validacion-de-datos.md) | Captura y validación de datos | `usePensionForm.test.ts`, `ValidationScreen.test.tsx`, `NewSimulationScreen.test.tsx`, `DateWheelPicker.test.tsx`, `WorkHistoryStep.test.tsx`, `pensionSchema.test.ts` |
| [07](07-historial-de-cotizacion-y-promedio-sbc.md) | Historial de cotización y promedio del SBC | `contributionHistory.test.ts`, `personalDataParser.test.ts`, `ValidationScreen.test.tsx` |
| [08](08-tema-claro-y-oscuro.md) | Tema claro y oscuro | Manual + componentes compartidos |
| [09](09-alcance-de-la-estimacion-y-aviso-legal.md) | Alcance de la estimación y aviso legal | `pdfExport.test.ts` + `EstimationDisclaimerCard` |
| [10](10-actualizaciones-ota.md) | Actualizaciones por OTA | Verificación manual del canal + guardas de los workflows |
| [11](11-identidad-de-la-app.md) | Identidad de la app: nombre visible y nombre del proyecto nativo | `npx expo prebuild` en un directorio limpio + `grep` sobre `ios/` |

## Formato

```markdown
# Spec-NN — Título

- **Estado**: Vigente
- **Ámbito**: módulo o pantalla

## Propósito
## Comportamiento
## Reglas de negocio
## Fuera de alcance
## Verificación
```

## Regla de trazabilidad

Toda regla de negocio de esta spec tiene que poder señalarse a **un caso de prueba
concreto**. Si una regla no tiene caso, no está verificada; si un caso no tiene regla,
está probando algo que no existe.

## Lo que el motor no hace

Los límites conocidos del motor de cálculo —lo que **no** calcula— están inventariados en
[`../deuda-tecnica.md`](../deuda-tecnica.md). Cada spec afectada remite a los ítems que le
corresponden en su sección «Fuera de alcance».
