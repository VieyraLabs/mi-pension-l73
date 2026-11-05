# Architecture Decision Records

Registro de decisiones de arquitectura de **Mi Pensión L73**. Cada ADR documenta el
contexto, la decisión, sus consecuencias y las alternativas que se descartaron.

**Regla de escritura:** un ADR se escribe *después* de que la decisión esté tomada y
verificada en el código. No se escribe un ADR para planear: se escribe para que alguien
—en seis meses— entienda por qué el código es como es, y para que no se deshaga por
ignorancia.

**Regla de estado:** un ADR nunca se borra ni se reescribe en la historia. Si una decisión
cambia, se marca como `Sustituida` y se escribe una nueva que la reemplaza.

## Índice

| # | Decisión | Estado | Fecha |
|---|---|---|---|
| [0001](0001-motor-de-calculo-como-pipeline-de-funciones-puras.md) | El motor de cálculo es un pipeline de funciones puras | Aceptada | 2026-08-01 |
| [0002](0002-cero-backend-todo-en-el-dispositivo.md) | Cero backend: todo el dato del usuario vive en el dispositivo | Aceptada | 2026-08-01 |
| [0003](0003-extraccion-local-de-pdf-con-pdfjs-dist.md) | La extracción de texto del PDF es local, con pdfjs-dist | Sustituida por [0019](0019-extraccion-de-pdf-con-pdfjs-dist-en-nativo.md) | 2026-08-01 |
| [0004](0004-validacion-con-zod-como-fuente-unica.md) | Zod es la fuente única de verdad de la validación | Aceptada | 2026-08-01 |
| [0005](0005-constantes-legales-en-modulos-separados.md) | Las constantes legales viven en módulos separados del código | Aceptada | 2026-08-01 |
| [0006](0006-el-resultado-es-un-desglose-auditable.md) | El resultado es un desglose auditable de pasos, no un número | Aceptada | 2026-08-01 |
| [0007](0007-navegacion-con-react-navigation.md) | React Navigation v7 con Stack y Bottom Tabs | Aceptada | 2026-08-01 |
| [0008](0008-tema-material-design-3-claro-y-oscuro.md) | Tema Material Design 3 con modo claro y oscuro | Aceptada (paleta sustituida por [0011](0011-sistema-de-diseno-esmeralda-y-superficies-degradadas.md)) | 2026-08-01 |
| [0009](0009-cero-telemetria-y-cero-servicios-de-terceros.md) | Cero telemetría y cero servicios de terceros | Aceptada (límite de servicios de terceros ampliado por [0017](0017-el-tag-produce-los-instalables-del-release.md)) | 2026-08-01 |
| [0010](0010-sbc-promedio-desde-el-historial-de-cotizaciones.md) | El SBC promedio se calcula del historial completo de cotizaciones | Aceptada | 2026-08-01 |
| [0011](0011-sistema-de-diseno-esmeralda-y-superficies-degradadas.md) | Sistema de diseño esmeralda con superficies degradadas | Aceptada | 2026-10-26 |
| [0012](0012-proyeccion-de-semanas-hasta-la-edad-de-retiro.md) | El motor proyecta las semanas hasta la edad de retiro y calcula con esas semanas | Sustituida por ADR-0013 | 2026-10-26 |
| [0013](0013-proyeccion-de-semanas-por-fecha.md) | Proyectar semanas por fecha calendario de retiro | Aceptada | 2026-10-28 |
| [0014](0014-modalidad-10-incorporacion-voluntaria-al-régimen-obligatorio.md) | Usar la Modalidad 10 como incorporación voluntaria y proyectar sus meses dentro del SBC promedio | Aceptada | 2026-10-30 |
| [0015](0015-cuota-modalidad-10-con-la-estructura-oficial-del-imss.md) | Calcular la cuota de la Modalidad 10 con la estructura de financiamiento oficial del IMSS | Aceptada | 2026-10-30 |
| [0016](0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md) | Usar el catálogo oficial de ocupaciones del IMSS para la Modalidad 10 | Aceptada | 2026-10-30 |
| [0017](0017-el-tag-produce-los-instalables-del-release.md) | El tag produce los instalables del release | Aceptada | 2026-11-03 |
| [0018](0018-el-nombre-del-proyecto-nativo-deriva-de-expo-name.md) | El nombre del proyecto nativo de iOS se deriva de `expo.name`, y `expo.name` es ASCII | Aceptada | 2026-11-03 |
| [0019](0019-extraccion-de-pdf-con-pdfjs-dist-en-nativo.md) | La extracción del PDF usa pdfjs-dist en web y en nativo | Aceptada | 2026-11-03 |

## Formato

```markdown
# ADR-NNNN — Título en imperativo

- **Estado**: Propuesta | Aceptada | Sustituida por ADR-NNNN
- **Fecha**: AAAA-MM-DD
- **Ámbito**: qué parte del sistema decide

## Contexto
...
## Decisión
...
## Consecuencias
### Positivas
### Costes
## Alternativas descartadas
...
```

## Relación con las specs

Las ADRs explican **por qué**. Las specs ([`../spec/`](../spec/)) explican **qué**: el
comportamiento observable que el sistema debe cumplir y cómo se verifica.
