# Spec-09 — Alcance de la estimación y aviso legal

- **Estado**: Vigente
- **Ámbito**: `src/services/pension/PensionCalculator.ts`, `src/components/EstimationDisclaimerCard.tsx`, `src/constants/infoLegal.ts`

## Propósito

Declarar sin ambigüedad **qué es** lo que la app calcula y **qué no**, para que nadie la
use como si su resultado fuera una resolución oficial.

## Comportamiento

Toda estimación producida por la app lleva tres marcas:

1. `isEstimate: true` en el `PensionResult`.
2. Una advertencia fija que dice que el resultado es una estimación con fines informativos
   y que la resolución oficial de la pensión corresponde exclusivamente al IMSS conforme a
   sus procedimientos institucionales.
3. La tarjeta `EstimationDisclaimerCard`, visible en la pantalla de resultado.

El PDF exportado repite la advertencia en el pie y marca cada paso estimado en su propia
fila.

## Reglas de negocio

- **El aviso legal es parte del resultado, no un elemento opcional de la interfaz.** El
  motor lo agrega a `warnings[]`, de modo que no se puede mostrar un resultado sin él.
- **Cada supuesto se declara donde ocurre.** Un paso estimado lleva su propio
  `assumption` (por ejemplo, el promedio con meses de Modalidad 10), que se muestra en la
  fila del desglose y no en un aviso genérico al final.
- **Los porcentajes de la tabla del Art. 167 están marcados como referencia
  bibliográfica** en el propio archivo de constantes. La app no afirma tener la tabla
  oficial verificada.
- **La cuota de la Modalidad 10 tiene fuente primaria y la app lo dice.** La estructura
  reproducida es la de la calculadora oficial del IMSS para Personas Trabajadoras
  Independientes y la del Cuadro A.3 del Anexo A al Informe al Consejo Técnico 2025-2026;
  la clase de riesgo también viene del catálogo oficial de ocupaciones del IMSS
  ([ADR-0015](../adr/0015-cuota-modalidad-10-con-la-estructura-oficial-del-imss.md),
  [ADR-0016](../adr/0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md)). Lo que la
  app **no** afirma es que el grupo elegido por la persona sea el correcto: de eso depende
  la prima, y el IMSS lo determina con su expediente.
- **La diferencia entre la cuota mostrada y la línea de captura del IMSS está declarada.**
  La calculadora oficial multiplica por los días reales del mes de pago y la app usa 30.4
  días por mes (su convención para el SBC mensual). La fórmula se comprobó contra una
  línea de captura real de 30 días (25 UMA, clase III): $18,584.02 contra los $18,584
  observados; con los 30.4 días de la app la cuota es $18,831.81.
- **El texto educativo de la sección de información** (`infoLegal.ts`) explica el marco
  normativo y los conceptos que la app usa (UMA, SMG, Modalidad 10, pensión de vejez),
  incluida la duda de si el salario del patrón y el de la Modalidad 10 se suman en el
  promedio de las 250 semanas.

## Fuera de alcance

- La app **no** gestiona trámites ante el IMSS.
- La app **no** ofrece protección legal ni puede usarse como evidencia en un proceso.
- La app **no** sustituye la consulta oficial. La sección de preguntas frecuentes lo dice
  de forma explícita.

## Verificación

- `src/__tests__/pdfExport.test.ts` — el aviso legal aparece en el HTML del reporte.
- `src/__tests__/pensionCalculator.test.ts` — `isEstimate` es `true` y la advertencia
  legal está presente en el resultado.
