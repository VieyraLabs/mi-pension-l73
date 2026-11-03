# Spec-01 — Motor de cálculo Ley 73

- **Estado**: Vigente
- **Ámbito**: `src/services/pension/`, `src/constants/ley73.ts`, `src/utils/weeksProjection.ts`

## Propósito

Calcular la pensión mensual estimada bajo la Ley del Seguro Social de 1973 (Ley 73) a
partir de los datos del asegurado, aplicando las reglas en el orden que la ley establece
y devolviendo un desglose auditable de cada paso.

La numeración legal que se cita es la de la **Ley del Seguro Social de 1973** (DOF
12-mar-1973), que es el régimen de transición que la app declara como su alcance. La LSS
vigente (2004) **no** tiene la tabla de cuantía de la cesantía en edad avanzada ni la
regla de las fracciones: ahí el cómputo de la cesantía cambia (Art. 170 LSS vigente, por
semanas). La fecha que se cita para la vejez es el **Art. 138**, para la cesantía en edad
avanzada el **Art. 145**, y para la tabla de cuantía y la regla de los seis meses el
**Art. 171**.

## Comportamiento

`calculatePension(input: PensionInput): PensionResult` ejecuta el pipeline completo y
devuelve:

- `monthlyPension`, `annualPension` y `dailyAmount` (redondeados a dos decimales con
  `round2`).
- El desglose: `steps[]`, un elemento por regla aplicada más el paso de resultado final.
- `warnings[]`, con el aviso legal siempre presente al final.
- `isEstimate: true`, siempre.
- `weeksProjection`, con la proyección de semanas hasta la fecha exacta de retiro:
  `currentWeeks` (las ya cotizadas), `projectedWeeks` (desde el día siguiente a
  `referenceDate` hasta `estimatedRetirementDate`, ambos inclusive), `targetWeeks` (con
  las que se jubila el asegurado) y
  `yearsToRetirement` (metadato de diferencia de edades, no usado para proyectar semanas).
  Es opcional a propósito: las simulaciones históricas pueden no traerlo y conservan las
  semanas cotizadas capturadas como valor de respaldo.
- `pensionType` (`vejez` o `cesantia_edad_avanzada`) y `ageFactor` (0.75 a 1.0): los dos
  se determinan a partir de la **edad legal** (Art. 171 LSS 1973), no de la edad
  declarada (ver «Reglas de negocio»).

La entrada `personalData.retirementAge` admite **fracciones de medio año** (60.5, 64.5, …):
es la forma en que la edad legal del Art. 171 se puede calcular, porque «la edad los exceda
en seis meses» solo es decidible si la edad cumplida se conoce con esa precisión.

El pipeline tiene ocho pasos, en este orden:

1. `AverageSalaryStep` — SBC promedio de las últimas 250 semanas cotizadas (con los meses
   de Modalidad 10 ya integrados, ver más abajo) y topado a 25 UMA.
2. `BasicQuantityStep` — cuantía básica según la tabla del Art. 167.
3. `AnnualIncrementsStep` — incrementos anuales por cada 52 semanas excedentes.
4. `DecreeIncrementStep` — incremento del 11 % (decreto DOF 2001/2004).
5. `AgeFactorStep` — factor por edad (cesantía en edad avanzada, Arts. 138 y 171).
6. `FamilyAssignmentsStep` — asignaciones familiares (Arts. 163–164).
7. `AssistanceAidStep` — ayuda asistencial (Art. 165).
8. `LimitsStep` — tope de 25 UMA (Art. 28 LSS vigente) y pensión mínima garantizada
   (Art. 170).

## Reglas de negocio

| Regla | Valor | Fuente |
|---|---|---|
| Semanas mínimas para pensión de vejez | 500 | Arts. 138 y 145 LSS 1973 |
| Semanas del promedio salarial | 250 | Art. 167 LSS 1973 |
| Tope de cotización | 25 UMA | Art. 28 LSS vigente (DOF 27-ene-2016) |
| Pensión mínima garantizada | según tabla UMA vigente | Art. 170 LSS 1973 |
| Factor por edad | 0.75 a 1.0 | Art. 171 LSS 1973 |
| Edad legal para la cuantía | +1 año si la edad cumplida incluye seis meses o más | Art. 171 LSS 1973 (párrafo final) |
| Asignaciones familiares | spouse e hijos menores | Arts. 163–164 LSS 1973 |
| Ayuda asistencial | 0.08 a 0.20 de la cuantía básica | Art. 165 LSS 1973 |
| Días por mes para conversión salarial | 30.4 | Constante de cálculo |
| Redondeo | 2 decimales | `round2` en `src/utils/format.ts` |

Reglas transversales:

- **La edad que manda para la cuantía es la EDAD LEGAL, no la edad declarada** (Art. 171
  LSS 1973, párrafo final): *"Se aumentará un año a los cumplidos cuando la edad los
  exceda en seis meses."* Si la edad cumplida incluye seis meses o más, la edad legal es
  un año mayor, y esa edad legal decide **el tipo de pensión** (vejez a los 65 años o
  cesantía en edad avanzada) y **el factor de reducción** (75 %, 80 %, 85 %, 90 % y 95 %
  para 60, 61, 62, 63 y 64 años). Ejemplos: 60 años y 7 meses → 61 años → factor 80 %;
  60 años y 3 meses → 60 años → factor 75 %; 64 años y 6 meses → 65 años → vejez, sin
  reducción. La regla la calcula `calculateLegalAge` (`src/utils/date.ts`) y la consume
  `AgeFactorStep`: el motor no reimplementa la regla, la aplica.
- **El umbral operativo es «medio año o más», no «más de seis meses».** El texto legal
  dice «cuando la edad los EXCEDA en seis meses», así que en el punto exacto de los seis
  meses la lectura estricta daría todavía un año menos. Como la interfaz presenta la edad
  en fracciones de medio año (60, 60.5, 61, 61.5, …), el motor redondea al medio año y el
  umbral es «fracción ≥ 0.5». La diferencia es de un día en el borde; el desglose dice
  siempre cuál de las dos edades se usó, para que el salto sea auditable.
- **La edad legal no toca las semanas cotizadas.** La regla del Art. 171 rige la
  **cuantía** (tipo de pensión y factor de reducción). No aplica a las 500 semanas
  mínimas (Arts. 138 y 145 LSS 1973) ni determina la proyección: `projectedWeeks` usa la
  fecha de referencia local y la fecha exacta de retiro; la edad declarada se conserva
  únicamente en el metadato `yearsToRetirement`.

- **El motor evalúa el mínimo legal y los incrementos contra las semanas estimadas al
  retiro, no solo contra las ya cotizadas.** El total de referencia es
  `weeksProjection.targetWeeks`:
  - Cada operación captura una sola `calculationDate`; su día calendario local normalizado
    es `referenceDate`. El cálculo es determinista con el mismo `input` y la misma
    `referenceDate`; una operación nueva en otro día puede producir otra proyección.
  - La proyección normal cubre desde el día siguiente a `referenceDate` hasta
    `estimatedRetirementDate`, ambos inclusive. Para `N` días calendario:
    `projectedWeeks = floor(N / 7) + (N mod 7 > 3 ? 1 : 0)`. Un intervalo sin días
    futuros aporta 0 semanas. El residuo mayor que tres sigue la regla aritmética del
    Art. 20 de la LSS vigente; no se verificó independientemente que la LSS 1973 tenga
    ese mismo texto (ver [nota de investigación](../investigacion/semanas-cotizadas-y-proyeccion.md)).
  - Modalidad 10 comienza el día 1 del mes siguiente a `referenceDate` y cuenta hasta el
    último día del mes de retiro, con el límite vigente de 600 meses desde el primer mes
    M10 permitido. `targetWeeks = semanas actuales + max(projectedWeeks,
    m10PlannedWeeks)`: las semanas M10 dentro del horizonte no se suman dos veces.
  - `yearsToRetirement = max(0, edad de retiro − edad actual)` se conserva como metadato,
    pero no determina las semanas proyectadas. La edad actual sigue tomando el dato de
    `personalData.age`; la edad legal y su factor no cambian.
  - `targetWeeks` se compara contra las 500 semanas mínimas (Arts. 138 y 145 LSS 1973) y
    produce los años excedentes de los incrementos del Art. 167 LSS 1973.
  - La etiqueta compartida en resultado, historial y PDF es «Semanas estimadas al
    pensionarte».
  - La decisión de proyección vigente se documenta en
    [ADR-0013](../adr/0013-proyeccion-de-semanas-por-fecha.md).
- **Modalidad 10 (incorporación voluntaria al régimen obligatorio).** El SBC declarado se
  cotiza durante los meses proyectados y **entra al promedio de las últimas 250 semanas
  cotizadas** (Art. 167 LSS 1973): no se pondera aparte. El SBC proyectado que ve la persona
  es el mismo número que alimenta el cálculo.
  - El rango del SBC declarado es el del Art. 28 LSS vigente: **salario mínimo del área
    geográfica** como piso y **25 UMA** como techo. La app usa el SMG de la Zona A (CDMX)
    como proxy del piso, por no conocer la zona del trabajador.
  - Si la persona **sigue trabajando** mientras cotiza, el SBC del periodo de M10 es
    `último salario registrado + SBC de M10` (dos cotizaciones en el mismo mes); si ya no
    trabaja, es solo el SBC de M10. La suma **no se topa**: el Art. 39 LSS 1973 (Art. 33 LSS
    vigente) clasifica al asegurado para el goce de prestaciones en dinero por la **suma** de
    los salarios percibidos. El tope de 25 UMA opera sobre los aportes y sobre el **promedio**
    del SBC, y lo aplica el paso 1, que avisa cuando lo rebasa.
  - La cuota mensual que muestra el paso 4 se calcula con la estructura de financiamiento
    oficial del IMSS, rama por rama y sin INFONAVIT ([ADR-0015](../adr/0015-cuota-modalidad-10-con-la-estructura-oficial-del-imss.md)).
  - El desglose de las 250 semanas (cuántas ordinarias y cuántas de M10, con qué SBC) viaja
    en la entrada para que el paso 1 narre los mismos números que se usaron.
  - La decisión vigente se documenta en
    [ADR-0014](../adr/0014-modalidad-10-incorporacion-voluntaria-al-régimen-obligatorio.md)
    y las fuentes, en
    [la nota de investigación](../investigacion/modalidad-10-incorporacion-voluntaria.md).
- **La proyección es una estimación.** Asume que el asegurado sigue cotizando de forma
  continua durante el horizonte; no afirma que las semanas futuras estén reconocidas por
  el IMSS. El SBC proyectado al retiro se calcula sobre las últimas 250 semanas cotizadas
  a esa fecha: conserva los periodos históricos que sigan dentro de la ventana y completa
  las semanas futuras con el SBC efectivo del último periodo histórico (suma de patrones
  concurrentes). Sin historial detallado, usa el SBC actual capturado, no el último importe
  aislado del PDF. Se supone que el último SBC se mantiene constante; no se modelan aumentos
  salariales futuros. El paso salarial declara el supuesto en `assumption`, y el resultado
  completo lleva la marca de estimación y el aviso legal.
- **El orden del pipeline es normativo.** Cada paso consume el resultado del anterior.
- **Todo resultado es una estimación.** El campo `isEstimate` es `true` siempre, y las
  advertencias incluyen el aviso legal.
- **Los valores normativos vienen de `src/constants/`**, nunca están escritos en el
  motor (ver [ADR-0005](../adr/0005-constantes-legales-en-modulos-separados.md)).
- **Los pasos son puros**: el mismo `input` y la misma `referenceDate` producen el mismo
  resultado, sin efectos secundarios.

## Fuera de alcance

- La Modalidad 10 se estima con el historial proyectado, no con el historial exacto del
  IMSS: se marca como estimación en el paso y en las advertencias.
- No se calculan Zackarias por viudez, orfandad o Accidente de trabajo.
- No se calcula la pensión de invalidez ni la de cesantía en edad avanzada como
  tipos separados: el factor por edad cubre el caso de edad avanzada.
- **La proyección no modela el futuro real del asegurado.** No contempla ceses, huecos
  laborales futuros ni cotizaciones por debajo del salario mínimo: proyecta cotización
  continua al SBC constante del último periodo conocido cuando hay historial detallado.
  Sin ese historial, conserva el SBC actual capturado. La resolución oficial corresponde
  al IMSS.
- No se resuelve ningún trámite ante el IMSS.
- **La cuantía no se topa al 100 % del salario promedio** (Art. 169 LSS 1973): solo se
  aplican el tope de cotización de 25 UMA (Art. 28 LSS vigente), el tope de pensión de 25 UMA
  mensuales y la pensión mínima garantizada (Art. 170 LSS 1973). Ver el ítem 1 de
  [`docs/deuda-tecnica.md`](../deuda-tecnica.md).
- **Los incrementos anuales solo se otorgan por años completos** (`floor((semanas − 500) /
  52)`): las fracciones de semanas excedentes que la ley reconoce con el 50 % del
  incremento no se otorgan. Ver el ítem 2 de
  [`docs/deuda-tecnica.md`](../deuda-tecnica.md).
- **La proyección de semanas es un supuesto, no una predicción**, y no tiene una prueba de
  sensibilidad que mida cuánto se mueve el resultado al cambiar el horizonte. Ver el ítem 3
  de [`docs/deuda-tecnica.md`](../deuda-tecnica.md).
- **Con un horizonte largo de Modalidad 10, el promedio de las 250 semanas converge al SBC
  declarado.** Es el comportamiento correcto según el Art. 167 LSS 1973 (las últimas 250
  semanas cotizadas son las de la Modalidad 10), pero se declara para que quien compare con
  el IMSS sepa interpretarlo. Ver el ítem 4 de
  [`docs/deuda-tecnica.md`](../deuda-tecnica.md).
- **El porcentaje del Art. 171 LSS 1973 se aplica sobre la cuantía básica, no sobre la
  cuantía de vejez.** La ley expresa la cesantía como «% de la cuantía de la pensión de
  vejez que le hubiera correspondido al asegurado de haber alcanzado 65 años»; el motor
  aplica ese porcentaje sobre la cuantía básica (cuantía básica + incrementos + incremento
  del 11 %). Ver el ítem 5 de [`docs/deuda-tecnica.md`](../deuda-tecnica.md).

## Verificación

- `src/__tests__/pensionCalculator.test.ts` — cadena completa, orden de los pasos,
  topes, Modalidad 10,UMO personalizada y validación de entrada; **regla del Art. 171
  LSS 1973 (edad legal por seis meses)**: 60 exactos → factor 75 %, 60.5 → 61 años y
  factor 80 %, 64.5 → 65 años y vejez sin reducción, 60.25 → 60 años y factor 75 %.
- `src/__tests__/legalAge.test.ts` — `calculateLegalAge` (edad entera, menos de medio año
  y medio año o más) y `calculateRetirementDate` con edad fraccionada.
- `src/__tests__/pensionSchema.test.ts` — la entrada del motor acepta una edad de retiro
  con fracción de medio año (60.5) y rechaza las que no son múltiplos de medio año.
- `src/__tests__/weeksProjection.test.ts` — cálculo de la proyección (`yearsToRetirement`,
  `projectedWeeks`, `targetWeeks`), el tratamiento de Modalidad 10 dentro del horizonte
  (nunca sumando dos veces) y el texto del desglose que comparten el motor y la validación.
- `src/services/pension/steps/` — cada paso tiene su propia cobertura de rama dentro
  del mismo archivo de pruebas del motor.
- Cobertura del área de cálculo (`src/services/pension/**`): **96 % de sentencias,
  100 % de funciones** en la última ejecución de la suite.
