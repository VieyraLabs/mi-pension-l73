# ADR-0020 — La marca «Vigente» es por patrón y el historial se ancla al día completo

- **Estado**: Aceptada
- **Fecha**: 2026-11-04
- **Ámbito**: `src/services/pdf/parsers/PersonalDataParser.ts`, `src/services/pension/history/`

## Contexto

Al reconstruir el historial de una constancia real del IMSS (9 patrones, 119 montos) el
SBC promedio salía mal, y las dos causas eran del mismo tipo: **el código suponía lo que
el documento no dice**.

**1. «Vigente» se leía como una bandera del documento, no como una celda del patrón.**
En la constancia, «Vigente» es una celda POR PATRÓN: el patrón que sigue en vigor la
trae, y los que cerraron tienen su fila BAJA. El parser buscaba la palabra en todo el
texto y, si la encontraba, daba por hecho que *todos* los patrones seguían en vigor. En
consecuencia, todo patrón sin fila BAJA se estiraba hasta hoy —supuesto que no estaba
documentado en ninguna spec ni ADR— y sus semanas se sumaban al promedio. Con el
documento real, dos patrones con su marca y siete con BAJA producían un historial en el
que los nueve cotizaban hasta hoy.

**2. El historial terminaba en el INSTANTE de la fecha de referencia, no en su día.** El
recorrido de semanas empieza en `referenceDate` tal cual (con hora, minutos y
segundos). Como el inicio de cada semana se calculaba restando 7 días a ese instante,
la semana más reciente cambiaba según la **hora del día** en que se abría la app: el
mismo documento, a las 00:05 y a las 23:55, daba promedios distintos. Un resultado
auditable no puede depender de la hora en que se consultó.

## Decisión

**El fin de cada patrón se determina con lo que el documento dice de ESE patrón, y el
historial se construye sobre días completos.**

- **«Vigente» es una celda por patrón.** La marca de un patrón es la última que aparece
  entre el patrón anterior y este en el texto extraído (orden de dibujado del content
  stream). Cada patrón se resuelve por separado:
  - **con fila BAJA**: terminó en la fecha de esa fila;
  - **con su marca «Vigente» y sin BAJA**: sigue en vigor, su último periodo llega hasta
    hoy;
  - **sin BAJA y sin su marca**: **no se sabe cuándo terminó**. Su último periodo **no se
    estira hasta hoy** —estirarlo sería inventar—: se omite y se avisa. Si además es el
    patrón más reciente, el patrón se deja fuera del historial reconstruido entero.
- **Si la marca no se puede atribuir a ningún patrón** (orden de dibujado que la deja
  suelta, p. ej. al final del documento), se aplica al documento completo y **se dice**:
  no se adivina a qué patrón pertenece.
- **El historial cubre días completos.** El fin del historial es el día siguiente al de
  la fecha de referencia, a medianoche local. El inicio de cada semana se ancla a
  medianoche, así que la semana más reciente es la misma a cualquier hora del día. La
  fecha de referencia es hoy si el documento dice que algo sigue en vigor; si no, es la
  fecha de baja más reciente que el documento registra (un asegurado que dejó de
  cotizar hace tiempo no tiene historial hasta hoy).

## Consecuencias

### Positivas

- **El promedio es reproducible**: el mismo documento da el mismo número a las 00:05 y a
  las 23:55, y en el teléfono y en el escritorio.
- **El desglose refleja lo que el documento dice.** Los dos patrones vigentes de la
  constancia real siguen vigentes; los siete con BAJA terminan cuando el documento dice.
- **Nada se estira en silencio.** Un patrón cuyo fin no se puede determinar no aporta
  semanas al promedio, y la app lo dice con el número de patrones afectados.
- **El resultado sigue siendo auditable**: cada periodo del desglose se puede rastrear
  hasta una fila de movimiento del documento.

### Costes

- **El historial puede quedar corto**: si el documento no marca un patrón como vigente,
  ese patrón no aporta su último periodo, y el promedio se calcula con menos semanas.
  Es el precio de no inventar.
- **La atribución de la marca depende del orden de dibujado** del PDF. Si el documento
  cambia de formato, la marca puede quedar sin patrón: por eso existe el camino de
  respaldo, que avisa.
- **Una suposición que antes pasaba inadvertida ahora es visible**: el desglose puede
  mostrar un patrón que termina antes de lo que el usuario esperaba, y el aviso explica
  por qué.

## Alternativas descartadas

- **Estirar hasta hoy todo patrón sin fila BAJA.** Descartado: el documento no dice que
  sigan cotizando, y el supuesto cambiaba el promedio sin que nada lo indicara.
- **Anclar el historial al instante de la referencia.** Descartado: hace que el
  promedio dependa de la hora del día.
- **Inferir el fin de un patrón sin BAJA como el día anterior al alta del patrón
  siguiente.** Ese supuesto ya existe y se mantiene **solo** para los patrones a los que
  el documento no da ningún movimiento (allí no hay nada mejor); cuando el patrón sí trae
  su tabla de movimientos, se respeta lo que la tabla dice y, si no alcanza, se omite el
  último periodo en vez de suponerlo.
- **Preguntar al usuario** qué patrones siguen vigentes. Descartado por ahora: la app
  puede reconstruir el historial sin esa interacción, y el aviso ya señala cuándo hay
  que revisarlo a mano.

## Relación con otras decisiones

- [ADR-0010](0010-sbc-promedio-desde-el-historial-de-cotizaciones.md) (el SBC promedio
  sale del historial completo) se **enmenda** con esta: el historial completo se
  construye sobre días completos y sobre el fin que cada patrón declara.
- [ADR-0006](0006-el-resultado-es-un-desglose-auditable.md) es el motivo de fondo: si el
  número tiene que ser auditable, no puede depender de la hora ni de un supuesto no
  declarado.
