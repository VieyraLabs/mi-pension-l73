# ADR-0012 — El motor proyecta las semanas hasta la edad de retiro y calcula con esas semanas

- **Estado**: Sustituida por ADR-0013
- **Fecha**: 2026-10-26
- **Ámbito**: `src/services/pension/`, `src/utils/weeksProjection.ts`, `src/validation/pensionSchema.ts`

## Contexto

El total de semanas que el usuario captura es, literalmente, el total de semanas que el
IMSS le reporta hoy: 300, 480, 1250. Sobre ese número el motor comparaba contra el mínimo
legal de 500 semanas (Arts. 138 y 145 LSS 1973) y calculaba los años excedentes del
Art. 167 LSS 1973.

Eso es exactamente lo que el usuario declara, pero no es lo que determina su pensión. La
pensión de vejez no se otorga por las semanas cotizadas hasta hoy, sino por las cotizadas
**al jubilarse**: el artículo 138 LSS 1973 exige 500 semanas cotizadas en la vida del
asegurado, y el Art. 167 añade un incremento anual por cada 52 semanas que excedan ese
mínimo. El horizonte relevante es, por tanto, la vida laboral completa, no el corte de
hoy.

El efecto de usar solo el total actual era desconcertante y, para una franja grande de
usuarios, aritméticamente incorrecto:

- Una persona de 30 años con 300 semanas cotizadas veía una pensión de **$0** porque 300
  semanas no llegan a 500, sin ninguna explicación de por qué. Con una proyección
  razonable hasta los 65 años, esa persona tendría 300 + 35 × 52 = 2 120 semanas al
  jubilarse: no solo alcanza el mínimo, sino que genera 31 años de incremento del
  Art. 167. La app le decía que su pensión era cero; la realidad es que, si sigue
  cotizando, tendrá una de las pensiones más altas de su cohorte.
- El mensaje de validación «Te faltan 200 semanas» era factualmente cierto y
  prácticamente inútil: no le decía a la persona usuaria que esas semanas las va a
  cotizar ella misma en los próximos 35 años.
- El caso inverso también dolía: una persona de 55 años con 480 semanas veía el mismo
  «te faltan 20 semanas», sin más contexto, cuando en realidad le faltaba mucho menos
  tiempo del que parecía.

El usuario de esta app no está preguntando «¿cuántas semanas tengo?», que ya lo sabe. Está
preguntando «¿de cuánto va a ser mi pensión?».

## Decisión

**El motor proyecta las semanas que el asegurado tendrá al jubilarse y calcula con ese
total.**

La proyección vive en un único lugar, `src/utils/weeksProjection.ts`, y la comparten el
motor de cálculo, el esquema de validación y el formulario (una sola fuente de verdad: la
UI narra las cifras que el motor ya calculó).

- `yearsToRetirement = max(0, edad de retiro − edad actual)`.
- `projectedWeeks = yearsToRetirement × 52`.
- `targetWeeks = semanas ya cotizadas + max(projectedWeeks, semanas planeadas en Modalidad
  40)`.

Y `targetWeeks` es el número con el que se calcula:

- El **mínimo de 500 semanas** (Arts. 138 y 145 LSS 1973). La validación de Zod y el
  aviso del motor evalúan la misma cifra, de modo que el error que ve la persona usuaria
  nunca puede contradecir al cálculo.
- Los **incrementos anuales del Art. 167 LSS 1973**: `floor((targetWeeks − 500) / 52)`.

Dos consecuencias del mismo diseño:

- **Modalidad 40 cae dentro del horizonte, y por eso se toma el máximo, nunca la suma.**
  Los meses de Modalidad 40 que la persona va a contratar caen dentro de los años que
  faltan hasta la edad de retiro: ya están contados en `projectedWeeks`. Sumarlos sería
  contarlos dos veces. Solo cuando las semanas de M40 **exceden** el horizonte aportan
  semanas por encima de la proyección, y ese excedente es el único que se suma.
- **El campo «Meses cotizando en M40 (estimado)» es derivado y de solo lectura.** Si fuera
  editable, sus semanas se sumarían a un horizonte que ya las contiene. Su valor se
  precarga al activar Modalidad 40 con los meses que hay entre hoy y la fecha de retiro, y
  se recalcula si cambian la fecha de nacimiento o la edad de retiro.

El resultado expone la proyección en `PensionResult.weeksProjection` (opcional a
propósito: las simulaciones guardadas por versiones anteriores de la app no la tienen), y
la interfaz muestra las tres cifras — cotizadas hoy, proyectadas hasta la edad de retiro
y total objetivo — en lugar de una sola.

## Consecuencias

### Positivas

- El resultado responde a la pregunta que la persona usuaria sí tiene: cuánto va a cobrar
  al jubilarse, no cuántas semanas tiene hoy.
- El mínimo de 500 semanas se evalúa contra la cifra que la ley realmente toma en cuenta.
- Motor, validación y formulario narran las mismas cifras: no puede haber un error de
  validación que contradiga al cálculo, ni una interfaz que prometa una cosa y el motor
  ejecute otra.
- El supuesto de la proyección queda explícito en el desglose (el paso de incrementos
  anuales se marca como estimado y declara el supuesto), no escondido en un número.

### Costes

- **La proyección es una estimación y así se declara.** Asume que el asegurado sigue
  cotizando de forma continua hasta la edad de retiro, con el mismo SBC. **No modela ceses,
  ni huecos laborales, ni cambios de salario futuros, ni cotizaciones por debajo del
  salario mínimo.** Una persona con un trayecto con huecos verá un resultado más alto del
  que le corresponden. Es el precio de responder la pregunta correcta con los datos que
  la app tiene; el resultado mantiene su marca de estimación y su aviso legal.
- Un usuario que **cambie de edad de retiro** ve cambiar su pensión proyectada porque
  cambia el horizonte. Es el comportamiento correcto, pero es una cifra que se mueve.
- La proyección no es un dato duro: es un supuesto con una aritmética. Por eso vive en
  un módulo aparte y es reemplazable — si mañana se quiere un modelo más fino (por
  ejemplo, con una hipótesis de continuidad más conservadora), se cambia
  `weeksProjection.ts` y no el motor.

## Alternativas descartadas

- **Dejarlo como estaba: calcular solo con las semanas cotizadas hoy.** Se descartó
  porque produce un resultado que es a la vez incorrecto y desconcertante: una persona de
  30 años con 300 semanas no tiene una pensión de cero, tiene una pensión que todavía no
  se ha ganado. El sistema de pilares del IMSS está diseñado precisamente para que la
  cotización a lo largo de la vida determine la pensión; usar solo el corte de hoy
  contradice el sentido de la ley.
- **Proyectar solo para los incrementos del Art. 167, sin tocar el mínimo de 500
  semanas.** Se descartó por incoherencia: el mínimo y los incrementos son la misma
  magnitud legal medida de dos formas (Arts. 138/145 y 167). Si uno se proyecta y el
  otro no, la misma cifra de semanas produce dos veredictos incompatibles según la
  pantalla en la que se mire. Habría que mantener además dos mínimos distintos —el de
  hoy y el de la jubilación— y explicar en cuál se está cada vez. Una sola cifra,
  usada en todas partes, es más difícil de malinterpretar.
- **Sumar las semanas de Modalidad 40 al horizonte.** Se descartó porque cuenta dos veces
  el mismo periodo: los meses de M40 se contratan dentro de los años que faltan hasta la
  jubilarse, y ya están dentro de `projectedWeeks`. Sumarlos produciría una pensión
  inflada, justo para la persona que está haciendo un esfuerzo adicional. Solo el
  excedente de M40 sobre el horizonte se suma.
- **Pedirle al usuario las semanas que cotizará hasta jubilarse.** Se descartó porque es
  la misma pregunta que la app responde mejor: el horizonte es calculable a partir de la
  edad y la edad de retiro. Pedirlo sería devolverle al usuario un trabajo que la app
  puede hacer (y lo hace mejor, con una aritmética auditable).
- **Modelar el futuro con más detalle** (historial de ingresos futuros, cambios de
  salario proyectados, cotizaciones al mínimo). Se descartó por ahora, no por principio:
  exigiría datos que la app no tiene y un modelo que no se puede verificar. La proyección
  simple es auditable y su supuesto se declara; un modelo más fino puede añadirse
  después sustituyendo `weeksProjection.ts`, sin tocar el motor.

## Referencias

- [Spec-01 — Motor de cálculo Ley 73](../spec/01-motor-de-calculo-ley-73.md): qué calcula
  el motor con `targetWeeks`.
- [Spec-06 — Captura y validación de datos](../spec/06-captura-y-validacion-de-datos.md):
  el campo derivado de Modalidad 40 y el contraste de semanas en el formulario.
- [ADR-0004 — Zod es la fuente única de verdad de la validación](0004-validacion-con-zod-como-fuente-unica.md):
  por qué la validación del mínimo de 500 semanas comparte la función del motor.
- [ADR-0006 — El resultado es un desglose auditable](0006-el-resultado-es-un-desglose-auditable.md):
  por qué el supuesto de la proyección se declara en el propio desglose.
