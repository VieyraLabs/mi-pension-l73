# Spec-07 — Historial de cotización y promedio del SBC

- **Estado**: Vigente
- **Ámbito**: `src/services/pension/history/`

## Propósito

Reconstruir el historial semanal de cotización del asegurado y calcular el **salario base
de cotización promedio de las últimas 250 semanas cotizadas**, que es el insumo del
cálculo de la pensión (Art. 167 LSS 1973).

## Comportamiento

El módulo trabaja sobre el historial reconstruido a partir del texto de la constancia:

```ts
interface WeeklyContribution {
  date: Date;                       // inicio de la semana
  contributed: boolean;             // hubo cotización registrada
  salaryBaseContribution?: number;  // SBC diario de esa semana
}
```

`computeContributionSummary(history)` devuelve:

- `totalWeeksInHistory`, `contributedWeeks`, `skippedWeeks`.
- `selectedWeeks`: cuántas semanas entraron al promedio (250, o menos si el historial no
  alcanza).
- `averageSalary`: el SBC diario promedio.
- `firstWeekUsed` y `lastWeekUsed`: el rango real usado.
- `isComplete`: si se alcanzaron las 250 semanas cotizadas completas.

El desglose que se expone al usuario no son los periodos por patrón, sino los **periodos
con SBC efectivo** (`SBCPeriodSegment`): intervalos en los que el conjunto de patrones
concurrentes es el mismo, con el SBC **sumado** de esos patrones y sus nombres. Se
construyen con `buildContributionSegments(periods)` y el promedio se calcula con el mismo
barrido por intervalos sobre esos segmentos (interno al módulo), de modo que el número que
se muestra es el número que se promedia.

## Reglas de negocio

- **Son las últimas 250 semanas cotizadas, no las últimas 250 semanas calendario.** Las
  semanas sin cotización se conservan en el historial (sirven para el usuario) pero no
  entran al promedio: el recorrido salta hacia atrás hasta reunir 250 semanas con
  cotización. Por eso la interfaz **no traduce** las 250 semanas a años calendario: con
  huecos laborales la equivalencia sería falsa, y el texto de captura del SBC solo dice
  «tus últimas 250 semanas cotizadas» y explica que el promedio sale de las semanas que sí
  cotizaste.
- **Los empleos simultáneos se suman.** Si en un día hay dos patrones vigentes, el SBC de
  ese día es la suma de ambos, porque el asegurado cotizó a los dos. Pero **la semana se
  cuenta una sola vez**: tener dos empleos no genera dos semanas cotizadas.
- **El desglose muestra el SBC EFECTIVO de cada periodo y los nombres de los patrones
  concurrentes.** El periodo es el intervalo en el que el conjunto de patrones concurrentes
  es el mismo; su SBC es la suma de los SBC de esos patrones, y `employerNames` los nombra
  (p. ej. «EMPRESA A SA DE CV + EMPRESA B SA DE CV», en orden alfabético para que la lista
  sea estable). Dos periodos contiguos con el mismo conjunto de patrones y el mismo SBC
  efectivo se funden en uno solo, porque un cambio de patrón sin cambio de SBC no es un
  corte real del desglose. El número y la lista no pueden divergir: ambos salen de
  `buildContributionSegments`, que es la única fuente de verdad.
- **La semana se cuenta una sola vez aunque haya varios patrones.** El barrido por
  intervalos suma los SBC de los patrones concurrentes para calcular el SBC del día, pero
  acumula los días una sola vez: tener dos empleos simultáneos no genera semanas cotizadas
  adicionales.
- **Un cambio de salario a mitad de semana** se promedia ponderado por los días cubiertos.
- **El rango usado se muestra al usuario**, junto con el desglose de semanas. El usuario
  puede comprobar que el promedio tomó el periodo correcto.
- **Los periodos SBC se presentan de más reciente a más antigua.** El desglose se lee como
  una línea de tiempo hacia atrás, no como un índice de patrones: el periodo vigente
  aparece primero y el más antiguo al final. El orden no se hereda del texto extraído del
  PDF (que no es confiable) ni de la agrupación por patrón, sino que lo fija el parser.
  El cálculo del promedio no depende de este orden: el barrido por intervalos trabaja con
  las fronteras de cada periodo.
- **La lista de periodos mostrada está acotada a la ventana del promedio.** Los periodos
  que se exponen son solo los que **solapan** la ventana de las últimas 250 semanas
  cotizadas (`firstWeekUsed` hasta `lastWeekUsed` + 7 días), que es la misma que usa el
  `ContributionSummary` del resultado. Un empleo anterior a esa ventana (p. ej. uno del año
  2000, cuando el promedio se calcula con 2018–2026) no pesa en el cálculo y por eso no se
  muestra: la lista dice exactamente lo que se está considerando.
- **El filtro acota lo que se muestra, no lo que se promedia.** El cálculo del SBC promedio
  sigue usando el **historial completo**: es lo que permite saltar los huecos laborales y
  alcanzar las 250 semanas cotizadas (Art. 167 LSS 1973). El filtro se aplica al exponer
  el detalle, nunca al calcular el promedio.

## Fuera de alcance

- No se reconstruye el historial cuando el usuario captura los datos a mano: en ese caso
  el SBC promedio lo ingresa el usuario.
- No se importan constancias de otros años que no vengan en el mismo documento.
- No se corrigen los datos del historial contra la constancia: el módulo trabaja con lo
  que el parser produjo.
- **El SBC promedio proyectado incluye los meses de Modalidad 10 al SBC declarado**: los
  meses de M10 son cotizaciones y entran al promedio de las últimas 250 semanas cotizadas
  (Art. 167 LSS 1973), no como una ponderación aparte. Con horizontes largos el promedio
  converge al SBC de M10, porque las últimas 250 semanas cotizadas son las de M10. El
  desglose en periodos sigue sin resolverlo: ver el ítem 4 de
  [`docs/deuda-tecnica.md`](../deuda-tecnica.md).
## Verificación

- `src/__tests__/contributionHistory.test.ts` — caso de las 250 semanas completas, caso
  con huecos laborales, caso de dos empleos simultáneos, caso de cambio de salario a
  mitad de semana, y caso de historial más corto que 250 semanas cotizadas; además los
  casos de `buildContributionSegments`: un patrón con dos cambios de salario produce dos
  periodos, dos patrones traslapados producen un periodo común con el SBC **sumado** y
  ambos nombres, dos patrones no traslapados producen dos periodos, y **el promedio no
  cambia** al desglosar en periodos.
- `src/__tests__/personalDataParser.test.ts` — orden de los periodos SBC expuestos (de más
  reciente a más antigua) y su independencia respecto del SBC promedio calculado; acotación
  de los periodos expuestos a la ventana del promedio, sin que el promedio cambie; el
  periodo común a dos patrones se expone con el SBC sumado y con los dos nombres.
- `src/__tests__/ValidationScreen.test.tsx` — orden en que se renderiza la lista de
  periodos en «Cómo se calculó tu SBC promedio», y el recuento de periodos CONSIDERADOS
  que anuncia el título; el periodo traslapado se muestra con el SBC **sumado** y con los
  dos patrones, y la nota que explica la regla aparece una sola vez.
