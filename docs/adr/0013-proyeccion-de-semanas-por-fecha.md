# ADR-0013 — Proyectar semanas por fecha calendario de retiro

- **Estado**: Aceptada (la Modalidad 40 pasó a llamarse Modalidad 10 y su archivo cambió de nombre con [ADR-0014](0014-modalidad-10-incorporacion-voluntaria-al-régimen-obligatorio.md); la decisión de proyectar las semanas por fecha calendario sigue vigente)
- **Fecha**: 2026-10-28
- **Ámbito**: `src/utils/weeksProjection.ts`, `src/utils/modalidad40.ts`, cálculo de pensión y presentación de semanas estimadas

## Contexto

ADR-0012 decidió proyectar las semanas futuras como la diferencia entre edades multiplicada por 52. Esa aproximación no representa el intervalo real entre la fecha de cálculo y la fecha exacta de retiro: ignora los días de calendario de los extremos y los años bisiestos. Además, las semanas normales y las de Modalidad 40 deben compartir una convención temporal clara para que motor, validación, resumen e informe PDF presenten el mismo objetivo.

La regla del artículo 20 de la LSS vigente cuenta días acumulados y reconoce una semana adicional cuando el residuo al dividir entre siete es mayor que tres. Su uso futuro en la app es una estimación condicional, no un reconocimiento del IMSS. La investigación asociada deja explícito que no se verificó independientemente el texto primario de la LSS de 1973 para confirmar que esta regla de residuo se encuentre allí.

## Decisión

**Calcular las semanas estimadas por días calendario hasta la fecha exacta de retiro, con una referencia local capturada una sola vez por operación.** La misma función de proyección alimenta el motor, la validación y la presentación; no cambia `PensionInput`, `PensionResult` ni la forma pública de `WeeksProjection`.

Sea `referenceDate` el día calendario local normalizado de la fecha de cálculo capturada al inicio de la operación, y `retirementDate` la fecha estimada de retiro:

- La proyección normal incluye desde el día siguiente a `referenceDate` hasta `retirementDate`, ambos inclusive. Para `N` días calendario del intervalo:
  - `fullWeeks = floor(N / 7)`.
  - `remainingDays = N mod 7`.
  - `projectedWeeks = fullWeeks + (remainingDays > 3 ? 1 : 0)`.
  - Un intervalo invertido o sin días futuros aporta `0` semanas.
- Modalidad 40 empieza el primer día del mes siguiente a `referenceDate` y cuenta hasta el último día del mes de retiro inclusive. Conserva el límite vigente de 600 meses desde el primer mes permitido; si se alcanza antes, las semanas M40 terminan al cierre de ese mes 600. El conteo de días y residuos es el mismo que para la proyección normal.
- `targetWeeks = currentWeeks + max(projectedWeeks, m40PlannedWeeks)`. Las semanas de Modalidad 40 no se suman de nuevo cuando ya quedan dentro del horizonte normal.
- `yearsToRetirement = max(0, retirementAge - age)` se conserva únicamente como metadato. La diferencia de edades no determina `projectedWeeks`. La edad legal y el factor de edad permanecen sin cambios.
- El motor captura una sola `calculationDate` al comienzo de la operación y usa su día local normalizado como referencia. El cálculo es determinista para los mismos datos y la misma fecha de referencia; una operación nueva en otro día puede producir una proyección diferente.
- El promedio M40 de resultados nuevos usa las semanas derivadas por fecha. Para resultados históricos que no tienen proyección, se conserva el fallback de meses (`expectedMonths × 52/12`) y se marca en pantalla/PDF como **«aprox. por meses»**. La etiqueta compartida del objetivo es **«Semanas estimadas al pensionarte»**.

La cifra futura asume cotización continua durante el intervalo y no equivale a semanas ya reconocidas. El umbral de residuo refleja la operación descrita en el artículo 20 de la LSS vigente; esta decisión no afirma que se haya comprobado su fundamento correspondiente en el texto de la LSS de 1973.

## Consecuencias

### Positivas

- La estimación responde a la fecha exacta elegida y aplica los días de calendario, incluidos años bisiestos, en lugar de aproximar todos los años como 52 semanas.
- Motor, validación y vistas narran el mismo `targetWeeks`, con Modalidad 40 tratada como parte del horizonte y no duplicada.
- La referencia temporal de cada operación queda fijada, evitando diferencias por una operación que cruce la medianoche local.
- Los resultados guardados de versiones anteriores siguen siendo legibles sin migración ni recálculo, y su aproximación mensual se identifica explícitamente.

### Costes

- La cifra futura continúa siendo una estimación: presupone cotización continua, no modela interrupciones ni cambios futuros, y no promete semanas que el IMSS haya reconocido.
- Una nueva simulación realizada otro día puede cambiar las semanas proyectadas aunque la entrada restante sea igual; ese cambio refleja el nuevo intervalo calendario.
- El cómputo sobre el total de semanas actuales no conserva un posible remanente de días de la historia individual. Por ello, el resultado no sustituye la constancia ni una determinación del IMSS.
- No se verificó de manera independiente el texto primario completo de la LSS de 1973 respecto del umbral de días residuales. La app mantiene ese límite explícito y no presenta la LSS vigente como prueba del contenido de la ley derogada.

## Alternativas descartadas

- **Mantener la diferencia de edades multiplicada por 52.** Se descarta porque no cuenta el intervalo calendario real hasta la fecha de retiro y no aplica una única operación basada en días.
- **Usar `expectedMonths × 52/12` también para los resultados nuevos.** Se descarta porque redondea de manera aproximada meses que sí tienen fechas exactas y puede divergir del periodo M40 hasta fin de mes.
- **Sumar semanas M40 al horizonte normal.** Se descarta porque contaría dos veces periodos M40 que ya están dentro de la proyección normal; se usa el máximo de ambos horizontes.
- **Cambiar el contrato de entrada o guardar semanas M40 derivadas en el resultado público.** Se descarta porque las fechas de entrada y la proyección pública existente son suficientes; el dato M40 derivado permanece interno.

## Referencias

- [ADR-0012 — proyección por edad, sustituida por esta decisión](0012-proyeccion-de-semanas-hasta-la-edad-de-retiro.md).
- [Spec-01 — Motor de cálculo Ley 73](../spec/01-motor-de-calculo-ley-73.md): contrato observable del cálculo de semanas.
- [Investigación: semanas cotizadas y proyección](../investigacion/semanas-cotizadas-y-proyeccion.md): regla del artículo 20 de la LSS vigente y caveat de verificación de la LSS de 1973.
- [Artículo 20 de la LSS vigente](https://www.diputados.gob.mx/LeyesBiblio/pdf/LSS.pdf): regla de días residuales citada como referencia aritmética, no como verificación independiente de la LSS de 1973.
