# Investigación — Modalidad 10: incorporación voluntaria al régimen obligatorio

Bitácora documental de la revisión legal que acompaña al
[ADR-0014](../adr/0014-modalidad-10-incorporacion-voluntaria-al-régimen-obligatorio.md).

**Regla de este documento:** se citan literalmente los artículos que se pudo abrir y leer en
su fuente primaria. Lo que no se pudo comprobar queda anotado como pendiente, nunca como
hecho.

---

## 1. Fuentes consultadas

| # | Documento | Fuente | Estado |
|---|---|---|---|
| 1 | Ley del Seguro Social **vigente** (última reforma DOF 15-ene-2026) | `https://www.imss.gob.mx/sites/all/statics/pdf/leyes/LSS.pdf` | Texto leído |
| 2 | **Ley del Seguro Social de 1973** (Ley 73, última reforma DOF 29-dic-1994) | `https://www.imss.gob.mx/sites/all/statics/pdf/leyes/4129_LSS_1973.pdf` | Texto leído |
| 3 | **Anexo A — Informe del Consejo Técnico del IMSS** (dic-2024), Cuadro A.1 "Modalidades de aseguramiento por tipo de régimen" | `https://www.imss.gob.mx/sites/all/statics/pdf/informes/20242025/15-anexos.pdf` | Texto leído |
| 4 | **Acuerdo ACDO.AS2.HCT.101026/302.P.DG** (Consejo Técnico del IMSS, aprobado 10-oct-2026, DOF 21-oct-2026, vigente 22-oct-2026) | DOF / SIDOF nota 5801708 | **Pendiente**: no se pudo abrir el articulado; el resumen proviene de la nota de prensa de Infobae del 22-oct-2026 |
| 5 | **Reglamento de la Ley del Seguro Social** (el artículo que nombra "Modalidad 10") | — | **Pendiente**: no se pudo abrir el texto reglamentario |
| 6 | **UMA 2026** (INEGI, DOF 09-ene-2026) | `https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/uma/uma2026.pdf` | Valor diario $117.31 corroborado en `valoruma.com`; el PDF oficial existe pero su texto no se pudo extraer directamente |
| 7 | **RACERF — Catálogo de Actividades** (art. 196 del Reglamento de Afiliación, Clasificación de Empresas, Recaudación y Fiscalización) | Clasificador oficial IMSS `https://serviciosdigitales.imss.gob.mx/clasificador/` | Clases por fracción leídas (412, 611, 711–713, 841, etc.); lista íntegra de divisiones 0–9 corroborada con fuente secundaria. **Dejar de usar**: el catálogo de ocupaciones de la Modalidad 10 es el del catálogo oficial del IMSS (fuente 10) |
| 8 | **Anexo A — Informe del Consejo Técnico del IMSS 2025-2026**, Cuadro A.3 "Esquema de financiamiento por tipo de seguro, diciembre de 2025" (p. 242) | `https://www.imss.gob.mx/sites/all/statics/pdf/informes/20252026/15-anexos.pdf` | Texto leído: tasas por ramo y tabla de cesantía y vejez (nota 6) |
| 9 | **Calculadora oficial del IMSS para Personas Trabajadoras Independientes** (Modalidad 10), versión de marzo de 2026 | `https://www.imss.gob.mx/sites/all/statics/trabajadores-independientes/calculadoraPTI-0326.js` | Texto leído: la fórmula `calculoCuotas` rama por rama, la tabla de bandas de cesantía y vejez (`tablaCPat`) y el SMG por zona |
| 10 | **Catálogo de ocupaciones de la calculadora oficial** (Modalidad 10), versión de marzo de 2026 | `https://www.imss.gob.mx/sites/all/statics/trabajadores-independientes/catalogoSINCO-0326.js` + el selector «División» de `https://www.imss.gob.mx/personas-trabajadoras-independientes/calculadora` | Texto leído: 13 divisiones y 25 grupos, cada uno con su clase de riesgo oficial |

---

## 2. Lo que dice la ley, literalmente

### 2.1 Sujetos de la incorporación voluntaria — Art. 13 fr. I LSS vigente

> **I. Los trabajadores independientes o por cuenta propia**;
> *(fracción reformada DOF 01-dic-2023)*

### 2.2 El capítulo de la incorporación voluntaria — Arts. 222 a 233 LSS vigente

> **Artículo 222.** La incorporación voluntaria de los sujetos a que se refiere el presente
> capítulo, se realizará **por convenio** y se sujetará a las siguientes modalidades:

> **Artículo 224.** Los sujetos de aseguramiento comprendidos en este capítulo cotizarán por
> mensualidad, bimestralidad, semestralidad o anualidad adelantadas, a elección del asegurado.
> En el caso de pago en parcialidades **no se les aplicarán al importe a pagar
> actualizaciones ni recargos**.

> **Artículo 227.** Las cuotas obrero patronales correspondientes a los sujetos de este
> capítulo se cubrirán con base en:
> **I. Los ingresos reportados** provenientes de la actividad que dio origen al
> aseguramiento, para los sujetos a que se refiere la fracción I del artículo 13 de esta Ley.
> Para efectos del cálculo de las cuotas obrero patronales se considerarán los **límites
> establecidos en el artículo 28** de la presente Ley.

> **Artículo 228.** A las bases de cotización señaladas en el artículo anterior, se les
> aplicarán las **primas de financiamiento** que establece esta Ley y que corresponden a los
> seguros que, en cada caso, comprenda el esquema de protección, **reduciendo la parte
> proporcional** relativa a las prestaciones que se excluyen.

> **Artículo 231.** La incorporación voluntaria al régimen obligatoria establecida en el
> artículo 13, fracciones I y V, termina por declaración expresa firmada por el sujeto o
> grupo de asegurados, o por no pagar las cuotas correspondientes.

**Qué se deduce para el código:** la base es el **ingreso declarado**; la cuota se arma con
las primas de financiamiento de los ramos incluidos y **reduce** la parte de las prestaciones
que se excluyen (de ahí el criterio de excluir INFONAVIT, que es ahorro adicional y no una
prima); y la cotización es **por adelantado**, sin meses retroactivos.

### 2.3 Los límites del SBC — Art. 28 LSS vigente

> **Artículo 28.** Los asegurados se inscribirán con el salario base de cotización que
> perciban en el momento de su afiliación, estableciéndose como **límite superior** el
> equivalente a **veinticinco veces el salario mínimo general** que rija en el Distrito Federal
> y como **límite inferior el salario mínimo general del área geográfica respectiva**.

La misma regla, con la redacción de 1973, está en el **Art. 33 de la Ley 73**:

> **Artículo 33.-** Los asegurados se inscribirán con el salario base de cotización que
> perciban en el momento de su afiliación, estableciéndose como límite superior el equivalente
> a veinticinco veces el salario mínimo general que rija en el Distrito Federal y como límite
> inferior el salario mínimo general del área geográfica respectiva.

**Qué se deduce para el código:** el rango del SBC declarado es
**[salario mínimo de la zona, 25 UMA]**. La app no conoce la zona y usa el SMG de la Zona A
(CDMX), el más alto — el mismo proxy que ya usa para la pensión mínima garantizada.

### 2.4 El promedio — Art. 167 Ley 73

> **Artículo 167.** Las pensiones anuales de invalidez y de vejez se compondrán de una cuantía
> básica y de incrementos anuales computados de acuerdo con el número de cotizaciones
> semanales reconocidas al asegurado con posterioridad a las primeras quinientas semanas de
> cotización.
> […]
> Para los efectos de determinar la cuantía básica anual de la pensión y sus incrementos, se
> considera como **salario diario el promedio correspondiente a las últimas doscientas
> cincuenta semanas de cotización**. […]
> El salario diario que resulte se expresará en **veces el Salario Mínimo General** para el
> Distrito Federal vigente en la fecha en que el asegurado se pensione, a fin de determinar el
> grupo de la tabla en que el propio asegurado se encuentre. […]
> El derecho al incremento anual se adquiere por **cada cincuenta y dos semanas** más de
> cotización.

**Qué se deduce para el código:** el promedio es de **250 semanas cotizadas** (no calendario)
y los meses de M10 son cotizaciones: entran al promedio con el SBC con el que se cotizan.
Por eso la app los integra en la línea temporal y no los pondera aparte.

### 2.5 La continuidad del régimen anterior — Art. 194 Ley 73

> **Artículo 194.** El asegurado con un mínimo de cincuenta y dos cotizaciones semanales
> acreditadas en el régimen obligatorio, al ser dado de baja tiene el derecho a **continuar
> voluntariamente** en el mismo, bien sea en los seguros conjuntos de Enfermedades y
> maternidad y de invalidez, vejez, cesantía en edad avanzada y muerte, o bien en cualquiera de
> ambos a su elección, pudiendo quedar inscrito en el grupo de salario a que pertenecía en el
> momento de la baja o en el grupo inmediato inferior o superior.

**Qué se deduce para el código:** la continuidad voluntaria existe también en el régimen
anterior, pero atada al **grupo de salario**. La app deja elegir el SBC de forma continua y
**no modela** esas bandas: es un supuesto declarado, no una regla reproducida.

### 2.6 El catálogo de modalidades — Anexo A del Informe del Consejo Técnico (dic-2024)

> **Régimen Obligatorio — Modalidad 10 — "Trabajadores permanentes y eventuales de la
> ciudad"** (con derecho a SRT, SEM, SIV, SRCV y SGPS).
> […]
> **Régimen Voluntario — Modalidad 40 — "Continuación voluntaria en el Régimen Obligatorio"**.

**Qué se deduce para el código:** el número de modalidad tiene más de un uso en la práctica
del IMSS: en el catálogo de modalidades de aseguramiento la 40 es la continuación voluntaria
y la 10 es la del trabajador permanente y eventual; en las guías de
`imss.gob.mx/personas-trabajadoras-independientes` la **Modalidad 10 es el esquema de
incorporación voluntaria del trabajador independiente**. El producto usa este segundo
significado, que es el que corresponde al sujeto del Art. 13 fr. I.

### 2.7 La suma de los salarios concurrentes — Art. 39 LSS 1973

> **Artículo 39.-** En caso de que el asegurado preste servicios a varios patrones se le
> clasificará, para el disfrute de prestaciones en dinero, en el grupo correspondiente a la
> **suma de los salarios percibidos en los distintos empleos**. Los patrones cubrirán
> separadamente los aportes a que estén obligados con base en el salario que cada uno de
> ellos pague al asegurado.
>
> Cuando la suma de los salarios que percibe un trabajador llegue o sobrepase el límite
> superior establecido en el Artículo 34 de esta Ley, a petición de los patrones éstos
> cubrirán los aportes del **salario máximo de cotización**, pagando entre ellos la parte
> proporcional que resulte entre el salario que cubre individualmente y la suma total de los
> salarios que percibe el trabajador.

La LSS vigente lo dice en el **Art. 33**, con una salvedad en la redacción:

> **Artículo 33.** Para el disfrute de las prestaciones en dinero, en caso que el asegurado
> preste servicios a varios patrones se tomará en cuenta la **suma de los salarios
> percibidos en los distintos empleos, cuando ésta sea menor al límite superior
> establecido en el artículo 28**; los patrones cubrirán separadamente los aportes a que
> estén obligados con base en el salario que cada uno de ellos pague al asegurado.

**Qué se deduce para el código:** es la duda de si el salario del patrón y el de la Modalidad 10
se suman en el promedio de las 250 semanas. **Sí se suman**: la clasificación para el goce de
prestaciones en dinero es por la **suma**. El tope de 25 UMA opera en otro lugar —los
**aportes** (cada patrón cubre hasta el máximo de cotización) y el **promedio** del SBC—, no
como un recorte de la suma dentro del periodo. Por eso el tramo de M10 **no** se topa en
`buildM10ContributionPeriod`: el tope del promedio lo aplica el motor (paso 1), que además
avisa cuando lo rebasa. En la LSS vigente la redacción del Art. 33 sí satura la suma en el
límite superior; en la Ley 73 —que es la ley que calcula esta app— no hay esa salvedad.

### 2.8 La estructura de la cuota — Cuadro A.3 y calculadora oficial del IMSS

El Cuadro A.3 "Esquema de financiamiento por tipo de seguro, diciembre de 2025" del Anexo A
del Informe al Consejo Técnico 2025-2026 (p. 242) publica las tasas por ramo, con la parte
patronal, la parte de la persona trabajadora y la del Gobierno Federal separadas. La
calculadora oficial para Personas Trabajadoras Independientes (marzo de 2026) implementa la
fórmula completa en su función `calculoCuotas(salario, numDias)`:

| Componente | Tasa | Base |
|---|---|---|
| SEM — cuota fija | 20.40 % | la UMA (parte patronal) |
| SEM — cuota excedente | 1.10 % + 0.40 % | el excedente del SBC sobre 3 UMA |
| SEM — prestaciones en dinero | 0.70 % + 0.25 % | el SBC |
| SEM — gastos médicos para pensionados | 1.05 % + 0.375 % | el SBC |
| Invalidez y Vida | 1.75 % + 0.625 % | el SBC |
| Guarderías y Prestaciones Sociales | 1.00 % | el SBC |
| Retiro | 2.00 % | el SBC |
| Cesantía y Vejez | tabla por banda de UMAs (3.15 % a 7.513 % en 2026) + 1.125 % obrero | el SBC |
| Riesgos de Trabajo | prima de la clase I–V | el SBC |

La tabla de cesantía y vejez crece por tramos de nivel salarial y tiene **columna por año**;
el Cuadro A.3 publica los valores de diciembre de 2025 en su nota 6:

> **6/** Con la reforma del 16 de diciembre de 2020, para 1 salario mínimo, la cuota en 2025
> es del 3.15 % (artículo 168, fracción II). Dicha tasa se incrementa dependiendo del nivel
> salarial de la persona asegurada en número de veces el salario de referencia, de la
> siguiente manera: de 1.01 SM a 1.5 UMA = 3.544 %, de 1.51 UMA a 2 UMA = 4.426 %, de 2.01 UMA
> a 2.5 UMA = 4.954 %, de 2.51 UMA a 3 UMA = 5.307 %, de 3.01 UMA a 3.5 UMA = 5.559 %, de 3.51
> UMA a 4 UMA = 5.747 % y de 4.01 UMA en adelante, 6.422 %.

**Qué se deduce para el código:** la cuota ya **no es una estimación de un porcentaje
plano**. Se calcula rama por rama con estas tasas, con la columna del año de la UMA vigente
para la banda de cesantía y vejez, y la persona asegurada paga las dos partes de cada ramo
(patronal y obrera) porque en la Modalidad 10 no hay patrón. **INFONAVIT queda fuera**: es
ahorro para vivienda, no una prima de financiamiento, y el Art. 228 ordena reducir la parte
proporcional de las prestaciones excluidas.

Dos diferencias entre la app y la calculadora oficial quedan declaradas:

- la oficial multiplica por los **días reales del mes de pago** y la app usa 30.4 días
  (su convención para el SBC mensual), así que el monto puede diferir unos puntos;
- la oficial **no** suma la cuota fija obrera del SEM (14.833 % de la UMA) que sí aparece en
  el Cuadro A.3; la app reproduce lo que la oficial cobra.

### 2.9 Comprobación contra una línea de captura real

La fórmula reconstruida se comprobó contra un costo **real observado**: la línea de
captura de una Modalidad 10 con el SBC tope de 25 UMA, clase de riesgo III y un periodo de
**30 días**, que era de **$18,584 al mes**. La fórmula da **$18,584.02** para ese mismo
periodo:

| Componente | Monto del periodo de 30 días |
|---|---|
| SEM — cuota fija (20.40 % de la UMA) | $717.94 |
| SEM — cuota excedente (1.50 % sobre el excedente de 3 UMA) | $1,161.37 |
| SEM — prestaciones en dinero (0.95 %) | $835.83 |
| SEM — gastos médicos para pensionados (1.425 %) | $1,253.75 |
| Riesgos de Trabajo, clase III (2.5984 %) | $2,286.14 |
| Invalidez y Vida (2.375 %) | $2,089.08 |
| Guarderías y Prestaciones Sociales (1.00 %) | $879.83 |
| Retiro (2.00 %) | $1,759.65 |
| Cesantía y Vejez (7.513 % + 1.125 %) | $7,599.93 |
| **Total** | **$18,584.02** |

La coincidencia al peso confirma a la vez las tasas por ramo, la banda de cesantía y vejez
del 2026, el excedente sobre 3 UMA y la prima de Riesgos de Trabajo. También explica por
qué la app muestra un poco más: con su convención de 30.4 días por mes la cuota es
$18,831.81 (un 1.3 % por encima del periodo de 30 días).

### 2.10 El catálogo de ocupaciones de la Modalidad 10

La calculadora oficial pide dos niveles: la **división** y el **grupo principal** de la
actividad. El catálogo oficial (`arrayValoresSINCO`) trae, para cada grupo, la clase de
riesgo que el IMSS le asigna:

| División | Grupo | Clase |
|---|---|---|
| 110 Mexicanos en el extranjero | 101 Trabajadores independientes que radican y laboran en el extranjero | I |
| 115 Plataformas digitales | 01 Conductores y repartidores | IV |
| 111 Ministros de culto | 111 Sacerdotes, pastores y otros teólogos | I |
| 12 Profesionistas y técnicos | 21 …en ciencias económico-administrativas, sociales, humanistas y en artes | I |
| | 22 Investigadores, técnicos y profesionistas en ciencias exactas, biológicas, ingeniería, informática y telecomunicaciones | I |
| | 23 Profesores, técnicos y especialistas en docencia | I |
| | 24 Médicos, enfermeras, técnicos, otros especialistas en salud y trabajadores de apoyo | II |
| **14 Comerciantes y agentes de ventas** | **41 Comerciantes** | **III** |
| | 43 Trabajadores de alquiler de bienes muebles y de bienes raíces | II |
| | 42 Vendedores ambulantes | II |
| 15 Trabajadores en servicios personales y de vigilancia | 51 …en la preparación y servicio de alimentos y bebidas, esparcimiento y hotelería | III |
| | 52 Trabajadores independientes en cuidados personales | I |
| | 53 Trabajadores en servicios de protección y vigilancia | III |
| 16 Actividades agrícolas, ganaderas, forestales, caza y pesca | 61 Trabajadores en actividades agrícolas y ganaderas | III |
| | 62 …en actividades pesqueras, forestales, caza y similares | IV |
| | 63 Operadores de maquinaria agropecuaria y forestal | V |
| 17 Trabajadores artesanos | 72 Artesanos y trabajadores en el tratamiento y elaboracion de productos | V |
| 114 Trabajadores de la construcción | 114 Trabajadores de la construcción | V |
| 18 Operadores de instalaciones y maquinaria industrial | 81 Operadores de instalaciones y maquinaria industrial | V |
| | 82 Ensambladores y montadores de herramientas, maquinaria, productos metálicos y electrónicos | IV |
| 112 Conductores | 11201 Conductores de transporte y de maquinaria móvil | IV |
| | 11202 Conductores de transporte de tracción humana y animal | V |
| 19 Actividades elementales de apoyo y mensajería | 97 Trabajadores de paquetería, de apoyo para espectáculos, mensajeros y repartidores de mercancía | IV |
| | 99 Ocupaciones de apoyo | V |
| 113 Otra división no clasificada anteriormente | 113 Otro grupo no clasificado anteriormente | III |

**Qué se deduce para el código:** la clase **no se aproxima**, se toma del catálogo. La
división y el grupo se guardan por separado porque el grupo solo significa algo dentro de su
división.

---

## 3. El acuerdo de octubre de 2026 (contexto)

**ACDO.AS2.HCT.101026/302.P.DG**, aprobado por el Consejo Técnico del IMSS el 10-oct-2026,
publicado en el DOF el 21-oct-2026, vigente desde el 22-oct-2026. Según la nota de prensa
de Infobae del 22-oct-2026, la medida es **temporal** y:

- las nuevas inscripciones a la Modalidad 40 se hacen con el **último salario registrado o
  hasta una UMA por encima** (UMA 2026: $117.31/día según esa nota);
- **se eliminan los pagos retroactivos**: "los nuevos aseguramientos a la Continuación
  Voluntaria se realizarán exclusivamente a partir de la fecha de la solicitud";
- la Modalidad 10 (trabajador independiente) **no puede coexistir** con la Modalidad 40;
- la cuota no cambia en esa modificación.

**Qué se deduce para el código:** el acuerdo **no modifica la Modalidad 10** y sí explica por
qué el asegurado del régimen anterior conviene a esta modalidad. Además, su regla de "sin
pagos retroactivos" coincide con lo que la app ya hacía: el periodo de M10 empieza el 1º del
mes siguiente a la fecha de referencia.

> **Pendiente**: el articulado del acuerdo debe abrirse en el DOF (SIDOF nota 5801708) antes
> de publicar la app, para citarlo sin depender de la nota de prensa.

---

## 4. Lo que queda pendiente de verificar

1. **El artículo del Reglamento de la Ley del Seguro Social que nombra "Modalidad 10"** y su
   redacción exacta. La constante `MODALIDAD_10_ARTICLE` cita el Art. 222 de la LSS vigente
   (el fundamento de la incorporación voluntaria, verificado) y **no** un artículo
   reglamentario sin comprobar. Si al abrir el texto reglamentario se confirma un artículo
   específico, se documenta en la constante con su fecha de publicación.
2. **La clase de riesgo laboral y su prima de Riesgos de Trabajo.** Las primas por clase
   (`MODALIDAD_10_RT_PRIMA`) son oficiales (Art. 71 LSS vigente) y la **clase** ya no se
   aproxima: el catálogo (`src/constants/ocupaciones.ts`) es el oficial de la calculadora del
   IMSS para Personas Trabajadoras Independientes, que publica la clase de cada grupo
   ([ADR-0016](../adr/0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md)). Queda
   pendiente solo **vigilar la versión del catálogo** cuando el IMSS lo actualice: los
   archivos llevan la fecha en el nombre (`catalogoSINCO-0326.js`).
3. **El SMG de la Frontera Norte 2026.** La calculadora oficial del IMSS lo publica en
   $440.87/día para 2026 (y $419.88 para 2025), que es el valor que ahora usa
   `smgFronteraNorte` en `src/constants/uma.ts`. Queda por **confirmarlo contra la tabla de
   salarios mínimos de CONASAMI** (la calculadora del IMSS no es la fuente primaria del
   salario mínimo). El piso de la Modalidad 10 depende del SMG de la zona, no de la UMA.
4. **La cuota ya tiene fuente primaria** (ver §2.8): el Cuadro A.3 del Anexo A al Informe al
   Consejo Técnico 2025-2026 y la calculadora oficial del IMSS. Lo que queda por confirmar
   en cada actualización anual es la **columna nueva** de la tabla de cesantía y vejez (la
   calculadora publica columnas por año) y la versión vigente del archivo de la calculadora.

---

## 5. Cómo se comprueba en el código

| Regla legal | Dónde vive | Cómo se verifica |
| --- | --- | --- |
| Piso = SMG y techo = 25 UMA | `src/constants/ley73.ts` (`MODALIDAD_10_CAP_TIMES_UMA`), `src/utils/modalidad10.ts` (`m10SalaryRange`, `clampM10Salary`) | `src/__tests__/modalidad10.test.ts` |
| Ingreso declarado como base | `src/hooks/usePensionForm.ts` (`setModalidad10ContributionSalary`, `setModalidad10UMAs`) | `src/__tests__/usePensionForm.test.ts` |
| Cotización por adelantado, sin meses retroactivos | `src/utils/modalidad10.ts` (`getM10StartDate`) | `src/__tests__/modalidad10.test.ts` |
| Prima de financiamiento sin INFONAVIT | `src/constants/modalidad10Cuota.ts` (`M10_CUOTA_RATES`, `MODALIDAD_10_CUOTA_EXCLUDES_INFONAVIT`) | `src/__tests__/modalidad10.test.ts` |
| Cuota por ramo y banda de cesantía y vejez | `src/utils/modalidad10.ts` (`calculateM10MonthlyBreakdown`, `resolveM10CesantiaBand`, `m10CesantiaPct`) | `src/__tests__/modalidad10.test.ts` |
| Prima de Riesgos de Trabajo por clase | `src/constants/ley73.ts` (`MODALIDAD_10_RT_PRIMA`, `MODALIDAD_10_RISK_CLASS_LABELS`) | `src/__tests__/modalidad10.test.ts` |
| La suma de salarios concurrentes no se topa | `src/utils/modalidad10.ts` (`buildM10ContributionPeriod`), `src/services/pension/steps/AverageSalaryStep.ts` | `src/__tests__/modalidad10.test.ts`, `src/__tests__/pensionCalculator.test.ts` |
| Ocupación → clase de riesgo (catálogo oficial) | `src/constants/ocupaciones.ts` (`M10_OCCUPATION_CATALOG`, `resolveRiskClass`) | `src/__tests__/ocupaciones.test.ts`, `src/__tests__/NewSimulationScreen.test.tsx` |
| La ocupación y la clase sobreviven a guardar y releer | `src/storage/simulationStorage.ts` (`normalizeSavedSimulation`) | `src/__tests__/simulationStorage.test.ts` |
| Promedio de 250 semanas cotizadas con los meses de M10 | `src/services/pension/history/projectedSBC.ts` | `src/__tests__/projectedSBC.test.ts` |
| El desglose narra los mismos números | `src/services/pension/steps/AverageSalaryStep.ts` | `src/__tests__/pensionCalculator.test.ts` |
| Los límites se validan antes de calcular | `src/validation/pensionSchema.ts` | `src/__tests__/pensionSchema.test.ts` |
