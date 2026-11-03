# ADR-0016 — Usar el catálogo oficial de ocupaciones del IMSS para la Modalidad 10

- **Estado**: Aceptada
- **Fecha**: 2026-10-30
- **Ámbito**: `src/constants/ocupaciones.ts`, `src/components/Modalidad10Step.tsx`, `src/storage/simulationStorage.ts`, `src/models/index.ts`

## Contexto

La clase de riesgo laboral (I–V) que determina la prima de Riesgos de Trabajo de la Modalidad
10 se obtenía de un catálogo **propio**, construido a mano sobre las divisiones del RACERF
(0–9: agricultura, industrias extractivas, comercio, construcción…) con la clase *predominante*
de cada grupo. Era una aproximación en dos niveles, y el propio archivo lo declaraba:

> Los grupos con `sourceFraction` tienen la clase confirmada contra el Clasificador oficial
> del IMSS. Los grupos sin `sourceFraction` son una aproximación.

El problema no era solo la exactitud: **el catálogo no era el del IMSS**. Cuando la persona se
inscribe como trabajador independiente, el IMSS le pide la división y el grupo principal de su
actividad, y la calculadora oficial trae el catálogo correspondiente con la clase de riesgo
**publicada junto con cada grupo**. Una app que ofrece otra lista —aunque se acerque— hace
que la persona traduzca entre dos taxonomías y elija una ocupación que no es la suya.

El catálogo oficial (13 divisiones, 25 grupos) incluye, por ejemplo, la división
«Comerciantes y agentes de ventas» con el grupo «Comerciantes» en clase III, que no existía
en el catálogo propio.

## Decisión

**Usar el catálogo de ocupaciones de la calculadora oficial del IMSS para Personas
Trabajadoras Independientes, con la clase de riesgo que el propio catálogo publica.**

- **Fuente primaria.** Las divisiones son las del selector «División» de la calculadora
  (`https://www.imss.gob.mx/personas-trabajadoras-independientes/calculadora`) y los grupos
  con su clase son la variable `arrayValoresSINCO` del catálogo oficial
  (`catalogoSINCO-0326.js`). En ese catálogo, el valor de cada grupo **es** la clase de
  riesgo que el IMSS usa para cotizar.
- **La clase ya no se aproxima.** Se elimina el campo `sourceFraction` y con él la distinción
  entre grupos confirmados y aproximados: ahora todos los grupos traen la clase oficial.
- **El orden es el del catálogo oficial**, para que la lista de la app sea la misma que la de
  la calculadora del IMSS; los nombres se reproducen literalmente.
- **La Modalidad 10 se precarga con una ocupación del catálogo**: la división *Comerciantes
  y agentes de ventas* con el grupo *Comerciantes* (clase III). Así el formulario abre con
  una ocupación —y una prima— ya resueltos, y la persona solo la cambia si la suya es otra.
  La clase se toma del catálogo, no se escribe a mano.
- **Divisiones y grupos se eligen con un selector, no con etiquetas.** Los nombres oficiales
  son largos («Trabajadores en actividades agrícolas, ganaderas, forestales, caza y pesca») y
  dos divisiones comparten inicio; tanto las etiquetas de chip como las de `Menu.Item` los
  recortan a una sola línea, lo que las volvería indistinguibles y, en algunos casos,
  desbordaría el ancho de la pantalla. El selector es un campo con la elección actual que
  abre un **diálogo con la lista completa**, donde cada opción se muestra entera.
- **Se conservan la división y el grupo por separado** en la entrada, porque el grupo solo
  significa algo dentro de su división (por ejemplo, el grupo `41` de la división `14` es
  «Comerciantes» y el `41` de otra división es otra cosa).
- **Las simulaciones guardadas se normalizan en memoria.** Al releer una simulación se
  conservan la clase de riesgo, la zona geográfica y la ocupación; si la ocupación guardada
  viene del catálogo anterior (RACERF) y ya no resuelve, se limpia la selección de división y
  grupo **pero se conserva la clase de riesgo**, que es la que determina el costo. No se
  reescribe lo que la persona tiene guardado (ADR-0013).
- **Corrección de un defecto de la normalización.** Antes, al releer una simulación guardada se
  perdían la clase de riesgo, la ocupación y la zona geográfica: el bloque de Modalidad 10 del
  resultado se mostraba con la clase I por omisión, con un costo que no era el calculado. La
  normalización ahora los conserva.

## Consecuencias

### Positivas

- La persona elige su ocupación en la **misma lista** que ve en el IMSS, y la clase que
  determina su prima es la oficial.
- La cuota que muestra la app usa la prima que el IMSS va a aplicar, sin el margen de error de
  una clasificación aproximada.
- Se cierra la mayor parte del pendiente que quedaba sobre la cuota (ADR-0015): lo único
  estimado es qué grupo corresponde realmente a la actividad de cada persona.

### Costes

- Los códigos de división y grupo cambian (de un dígito a dos o tres). Las simulaciones
  guardadas antes de este cambio pierden la selección de ocupación —no el costo— y se
  normalizan al releerse.
- El catálogo oficial clasifica por **ocupación**, no por actividad económica registrada ante
  el patrón: un grupo agrupa ocupaciones que el IMSS considera equivalentes en riesgo. La
  persona debe elegir el grupo que corresponde a su actividad real.

## Alternativas descartadas

- **Conservar el catálogo propio y añadir la división de Comerciantes.** Se descartó: mezclar
  dos taxonomías en la misma lista hace que la comparación con el IMSS sea peor que antes.
- **Capturar la fracción del RACERF.** Se descartó: es la clasificación del patrón, no la
  que el IMSS pide al independiente, y obligaría a capturar un nivel que el usuario no conoce.
- **Dejar el grupo en blanco y pedir solo la división.** Se descartó: la clase está publicada
  a nivel de grupo y usarla es más preciso.

## Relación con las specs

- [Spec-06](../spec/06-captura-y-validacion-de-datos.md): los campos de ocupación del paso 4.
- [Spec-09](../spec/09-alcance-de-la-estimacion-y-aviso-legal.md): qué queda declarado como
  estimación.
- [ADR-0015](0015-cuota-modalidad-10-con-la-estructura-oficial-del-imss.md): la cuota que
  consume la prima de esta clase.
- [Investigación: Modalidad 10](../investigacion/modalidad-10-incorporacion-voluntaria.md): las
  fuentes del catálogo.
