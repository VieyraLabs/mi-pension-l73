# Spec-06 — Captura y validación de datos

- **Estado**: Vigente
- **Ámbito**: `src/validation/pensionSchema.ts`, `src/hooks/usePensionForm.ts`, `src/components/`

## Propósito

Recopilar los datos del asegurado con la menor fricción posible, garantizando que lo que
llega al motor cumple las reglas de la ley.

## Comportamiento

La captura se organiza como un **flujo por pasos** (`NewSimulationScreen`), en lugar de un
formulario largo. Son **cuatro pasos**, con estos títulos exactos:

1. **Datos personales** (nombre y fecha de nacimiento, ambos obligatorios).
2. **Historial laboral** (semanas cotizadas **y** salario base de cotización, en el mismo paso).
3. **Edad de retiro** (fecha de retiro y **beneficiarios**).
4. **UMA** (valor por año o personalizado, **y Modalidad 10**).

Cada paso tiene su componente (`PersonalDataStep`, `WorkHistoryStep`, `SalaryStep`,
`RetirementAgeStep`, `UMAStep`, `Modalidad10Step`, `BeneficiariesStep`), y los componentes de
fila (`DataRow`, `CompRow`, `SummaryRow`) dan consistencia visual a todos ellos.

El paso 2 puede mostrar dos tarjetas (`WorkHistoryStep` y `SalaryStep`): el historial
laboral y el SBC son las dos caras del mismo dato de entrada —las semanas cotizadas y el
salario con el que se cotizaron—, así que se capturan juntos. El paso 3 puede mostrar dos
tarjetas (`RetirementAgeStep` y `BeneficiariesStep`) y el paso 4 otras dos (`UMAStep` y
`Modalidad10Step`).

El paso 3 elige la **fecha** de retiro con un **calendario de ruedas** (`DateWheelPicker`:
una rueda por año, por mes y por día) y la **edad se deriva de esa fecha**: el campo de
edad es de **solo lectura**. La fecha viene precargada con el cumpleaños de la persona en el
año en que cumpliría 65 años. Entre 60 y 65 años la edad se presenta con granularidad de
**medio año** (60, 60.5, 61, 61.5, …, 64.5, 65): es la granularidad que necesita el motor
para aplicar la regla del Art. 171 LSS 1973 (ver
[Spec-01](01-motor-de-calculo-ley-73.md)); fuera de ese rango la edad se muestra como
entero cumplido. La edad con fracción es la que se envía en `retirementAge`; el motor
calcula con ella la edad legal.

El calendario de ruedas se construyó con lo que ya había en el repositorio
(`react-native` + `react-native-paper`): **no se añadió ninguna dependencia nueva**.

La edad actual se deriva de la fecha de nacimiento, no se captura. La fecha estimada de
retiro la calcula el formulario (`usePensionForm`) y se recalcula cuando cambian la fecha
de nacimiento o la edad de retiro; cuando la persona elige una fecha en el calendario,
esa fecha es la que queda.

## Reglas de negocio

- **El nombre es obligatorio.** Identifica la persona y su simulación en el historial: sin
  él, «Siguiente» queda deshabilitado en el paso 1 y el esquema de Zod lo rechaza con
  «El nombre es requerido». Se guarda recortado de espacios, con un máximo de 100
  caracteres, y es lo que se usa como nombre de la simulación al guardarla. No participa en
  el cálculo de la pensión, y por eso `PersonalData.name` sigue siendo opcional en el
  modelo: las simulaciones guardadas por versiones anteriores pueden no traerlo.
- **La validación es la de Zod**, y es la misma que usa el motor
  ([ADR-0004](../adr/0004-validacion-con-zod-como-fuente-unica.md)). Los mensajes de
  error citan el artículo legal cuando la regla tiene uno.
- **El mínimo de 500 semanas de Ley 73 se evalúa contra las semanas estimadas con las que
  se jubilaría el asegurado**, no solo contra las ya cotizadas: semanas actuales más las
  proyectadas hasta la fecha exacta de retiro (las de Modalidad 10 caen dentro de ese
  horizonte y no se cuentan dos veces). La proyección normal comprende desde el día
  siguiente a `referenceDate` hasta `estimatedRetirementDate`, ambos inclusive, bajo el
  supuesto de cotización continua. Para convertir los días proyectados en semanas se usa
  el criterio de residuo mayor que tres del Art. 20 de la LSS vigente; no se verificó
  independientemente ese texto en la LSS 1973 (ver
  [ADR-0013](../adr/0013-proyeccion-de-semanas-por-fecha.md)).
  El mensaje de error muestra el desglose: "500 semanas cotizadas (480 cotizadas + 20
  planeadas en Modalidad 10 = 500)" (ver [Spec-01](01-motor-de-calculo-ley-73.md)).
- **La edad de retiro NO es un dato personal: es una decisión sobre cuándo se jubila la
  persona usuaria.** Por eso vive en su propio paso (el 3) y no en «Datos personales»:
  el paso 1 se llama «Datos personales» y solo lleva nombre y fecha de nacimiento. El
  paso «Edad de retiro» muestra la **fecha de retiro** que el formulario lleva
  (`personalData.estimatedRetirementDate`, calculada por `usePensionForm`): la UI solo la
  muestra, no la recalcula (RNF-013).
- **La edad de retiro se elige por FECHA, no se escribe.** El campo de fecha no es
  editable: se toca para abrir el calendario de ruedas, y la **edad se deriva de la fecha
  elegida** (de ahí el cumpleaños precargado, en el año en que la persona cumpliría 65 años).
  La edad que se muestra y la que se envía al motor es la **de presentación**: un múltiplo
  de medio año. La edad **legal** (Art. 171 LSS 1973: seis meses o más cumplidos se
  computan como el año siguiente) la calcula el motor, no la pantalla; cuando la edad
  presentable y la legal difieren, el paso lo dice («Cálculo del motor: 61 años (edad
  legal, Art. 171 LSS 1973)»).
- **El paso de historial laboral NO anticipa la proyección de semanas.** Ya no dice "al
  jubilarte tendrás N semanas": en ese momento la edad de retiro todavía no está decidida
  (se elige en el paso 3), así que sería una cifra que aún no es cierta. El paso solo
  ofrece una guía evergreen sobre dónde verificar las semanas cotizadas (el portal del
  IMSS con el NSS). El mínimo de 500 semanas se revisa al final, con la edad de retiro ya
  definida.
- **El campo «Meses cotizando en M10 (proyectados)» es derivado y de solo lectura, y es
  texto, no un input.** Se muestra con el patrón `DataRow` —el mismo de la edad de retiro—
  no como un campo deshabilitado. El periodo contractual va desde el día 1 del mes calendario
  siguiente a `referenceDate` hasta el último día del mes de retiro, inclusive; por tanto,
  incluye el mes de retiro completo y excluye el mes de referencia. `expectedMonths` admite
  de 0 a 600: vale 0 si no hay ningún mes contractual en ese intervalo y se limita a 600 si
  el horizonte excede ese máximo. Se precarga al activar M10 y se recalcula si cambian la
  fecha de nacimiento o la edad de retiro. Un texto auxiliar explica el periodo; no es
  editable, porque sus semanas forman parte del horizonte de proyección y no deben sumarse
  de nuevo.
- **El SBC de la Modalidad 10 se captura en UMAs, con el monto equivalente a un lado.** El
  paso 4 ofrece el **SBC de cotización M10 (diario, MXN)** y, junto a él, un control de
  UMAs (`UMAStepper`) que sube y baja **de UMA en UMA** y admite escribir el valor con dos
  decimales. Los dos campos están sincronizados: escribir el monto recalcula las UMAs y
  elegir las UMAs recalcula el monto. El rango es el del Art. 28 LSS vigente: **salario
  mínimo del área geográfica** (la app usa el SMG de la Zona A) y **25 UMA** como techo; el
  valor por omisión es el techo. El texto auxiliar declara el rango.
- **La ocupación se elige del catálogo oficial del IMSS.** El paso 4 ofrece la división y
  el grupo principal de la actividad, con el mismo catálogo (13 divisiones y 25 grupos) y la
  misma clase de riesgo I–V que usa la calculadora oficial para Personas Trabajadoras
  Independientes. Al elegir el grupo se fija la clase, que determina la prima de Riesgos de
  Trabajo y con ella el costo mensual; cambiar de división limpia el grupo y la clase
  ([ADR-0016](../adr/0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md)).
  La Modalidad 10 **se precarga con una ocupación del catálogo** —división *Comerciantes y
  agentes de ventas*, grupo *Comerciantes*, clase III— y la persona solo la cambia si la
  suya es otra.
  División y grupo se eligen con un **selector**: un campo con la elección actual que abre
  un diálogo con la lista completa. Los nombres oficiales son largos y dos divisiones
  empiezan igual («Trabajadores en actividades…»), de modo que una etiqueta de una sola
  línea las volvería indistinguibles.
- **La persona declara si sigue trabajando mientras cotiza en la Modalidad 10.** El
  interruptor suma su último salario registrado al SBC de M10 en el SBC promedio proyectado;
  si ya no trabaja, el SBC del periodo es solo el de M10. La respuesta se declara en el
  propio paso y viaja al desglose del cálculo.
- **El costo mensual de la Modalidad 10 se muestra, no se captura.** Es un dato derivado y se
  presenta como texto de solo lectura. La cuota se arma con la estructura de financiamiento
  oficial del IMSS —rama por rama: cuota fija y excedente del Seguro de Enfermedades y
  Maternidad, prestaciones en dinero, gastos médicos para pensionados, Invalidez y Vida,
  Guarderías y Prestaciones Sociales, Retiro y cesantía y vejez por banda de UMAs— más la
  prima de Riesgos de Trabajo de la clase elegida; **sin la aportación a INFONAVIT**. Se
  muestran el total, la tasa efectiva sobre el SBC declarado y la prima de RT, con el texto
  auxiliar que declara la fuente de la estructura y que la clase de riesgo es la del catálogo
  oficial de ocupaciones ([ADR-0015](../adr/0015-cuota-modalidad-10-con-la-estructura-oficial-del-imss.md),
  [ADR-0016](../adr/0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md)).
- **La edad de retiro va de 60 a 100 años**, con el mínimo justificado por la cesantía en
  edad avanzada, y admite **fracciones de medio año** (60, 60.5, 61, …): el esquema
  rechaza, con mensaje, las edades que no son múltiplos de medio año.
- **Los mensajes están en español y son accionables.** No dicen "valor inválido": dicen
  qué se espera y por qué.
- **Los componentes de estado son compartidos**: `MessageBanner` (aviso, error, éxito,
  información), `LoadingView`, `EmptyState` y `EstimationDisclaimerCard`. No hay dos
  componentes que pinten el mismo tipo de aviso (commit `c74ca0a`).

## Fuera de alcance

- No hay validación asíncrona contra ningún servicio: la validación es local
  ([ADR-0002](../adr/0002-cero-backend-todo-en-el-dispositivo.md)).
- No hay guardado automático del formulario a medio completar: solo se guarda una
  simulación terminada.
- No hay cálculo mientras se escribe: el cálculo ocurre al confirmar.

## Verificación

- `src/__tests__/usePensionForm.test.ts` — reglas del schema, incluidos los casos
  límite de semanas y de edad; derivación de la edad desde la fecha de nacimiento y
  recálculo de la fecha de retiro.
- `src/__tests__/ValidationScreen.test.tsx` — pantalla de validación tras la
  importación de un PDF.
- `src/__tests__/NewSimulationScreen.test.tsx` — el campo de meses de Modalidad 10 se
  muestra como texto de solo lectura con el valor derivado del horizonte; el control de
  UMAs arranca en el máximo legal, se mueve de UMA en UMA y se sincroniza con el monto; el
  costo mensual se muestra como texto; **la estructura de los pasos**: son cuatro («Datos
  personales», «Historial laboral», «Edad de retiro», «UMA»), el paso 1 no pide la edad de
  retiro, el paso 2 reúne el historial laboral y el SBC, el paso 3 pide la fecha de retiro
  con el calendario y la muestra como derivada, y el paso 4 es «UMA de 4 de 4» con la
  Modalidad 10. También las **reglas de presentación de la
  edad**: 60 años y 3 meses → 60, 60 y 6 → 60.5, 60 y 9 → 60.5, 64 y 7 → 64.5, 65 y 6 →
  65, 66 y 2 → 66, y el cumpleaños precargado (con el 29 de febrero ajustado al último día
  del mes en los años que no son bisiestos).
- `src/__tests__/DateWheelPicker.test.tsx` — el calendario de ruedas: abre el modal con
  las tres ruedas (año, mes y día), cada elemento es localizable por su
  `accessibilityLabel` («Año 2030», «Mes julio», «Día 1»), elegir y **aceptar** devuelve la
  fecha elegida, **cancelar** cierra sin devolver fecha, la rueda de años respeta la
  fecha mínima y la máxima, y la rueda de días se limita a los días del mes elegido.
- `src/__tests__/WorkHistoryStep.test.tsx` — el paso de historial laboral **no** narra la
  proyección de semanas (la edad de retiro aún no está decidida) y mantiene la guía
  evergreen sobre el portal del IMSS.
- `src/__tests__/pensionSchema.test.ts` — la edad de retiro con fracción de medio año
  (60.5) es válida y las edades que no son múltiplos de medio año se rechazan.
