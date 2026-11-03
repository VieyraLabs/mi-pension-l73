# ADR-0014 — Usar la Modalidad 10 como incorporación voluntaria y proyectar sus meses dentro del SBC promedio

- **Estado**: Aceptada
- **Fecha**: 2026-10-30
- **Ámbito**: `src/constants/ley73.ts`, `src/constants/ocupaciones.ts`, `src/constants/uma.ts`, `src/utils/modalidad10.ts`, `src/services/pension/history/projectedSBC.ts`, `src/services/pension/steps/AverageSalaryStep.ts`, `src/validation/pensionSchema.ts`, `src/hooks/usePensionForm.ts`, `src/components/Modalidad10Step.tsx`, `src/components/UMAStepper.tsx`

## Contexto

La app estima la pensión bajo la **Ley del Seguro Social de 1973 (Ley 73)**: es decir, para
el asegurado del *régimen anterior*. El paso 4 ofrecía "Modalidad 40" citando el Art. 218
del Reglamento, que es la continuación voluntaria **del régimen de 1997** (LSS vigente), y
ponderaba sus meses *por encima* del promedio de 250 semanas. Eso producía tres problemas:

1. **Encuadre legal equivocado.** El asegurado del régimen anterior no se incorpora
   voluntariamente por el Art. 218, sino por la incorporación voluntaria al régimen
   obligatorio del capítulo IX de la LSS vigente (Arts. 222 a 233), cuyos sujetos son los del
   Art. 13 fr. I —trabajadores independientes o por cuenta propia—, y cuya base de
   cotización son los ingresos declarados, acotados por los límites del Art. 28.
2. **El SBC proyectado no era el que alimentaba el cálculo.** La misma fórmula (promedio
   ponderado) estaba duplicada en el motor y en el resumen, con guardas distintas, y el SBC
   proyectado que se mostraba en el formulario no incluía los meses de la modalidad. La
   ponderación, además, saturaba con horizontes largos.
3. **El SBC capturado no tenía rango legal.** Las constantes que documentaban el piso y el
   techo de la Modalidad 40 estaban declaradas y no se usaban; el tope de 25 UMA se aplicaba
   "a posteriori" en el motor, ya con el número contaminado.

A esto se suma el **Acuerdo ACDO.AS2.HCT.101026/302.P.DG** del Consejo Técnico del IMSS
(aprobado el 10-oct-2026, publicado en el DOF el 21-oct-2026, vigente desde el 22-oct-2026),
que endureció las nuevas inscripciones a la Modalidad 40 —salario de cotización igual al
último registrado o hasta una UMA por encima— y prohibió los pagos retroactivos. Ese
acuerdo no modifica la Modalidad 10; se documenta como contexto.

## Decisión

**Sustituir la Modalidad 40 por la Modalidad 10 y tratar sus meses como un tramo más de la
línea temporal del SBC promedio, con el SBC declarado acotado por el Art. 28 y visible en
UMAs.**

- **Nombre y fundamento.** La modalidad se llama **Modalidad 10**: incorporación voluntaria al
  régimen obligatorio (capítulo IX de la LSS vigente, Arts. 222 a 233). El nombre viene del
  catálogo de modalidades de aseguramiento del IMSS (Anexo A del Informe del Consejo Técnico,
  diciembre 2024) y de las guías oficiales de `imss.gob.mx/personas-trabajadoras-independientes`.
  El artículo reglamentario que la nombra queda **pendiente de verificación** en el DOF: la
  constante lo declara como tal y no cita un artículo no comprobado.
- **Rango del SBC declarado (Art. 28 LSS vigente).** El piso es el **salario mínimo general
  del área geográfica** y el techo son **25 UMA**. La app captura la zona geográfica
  (`salaryZone`: resto del país o Frontera Norte) y usa el SMG de esa zona como piso. El
  valor por omisión es el **máximo legal: 25 UMA**.
- **UMAs como unidad de entrada.** El control del paso 4 es un *stepper* (`−` / `+`) con el
  valor editable a dos decimales: sube y baja **de UMA en UMA** dentro del rango legal. El
  monto en pesos y su equivalente en UMAs se mantienen sincronizados en las dos direcciones;
  el monto es lo que se conserva cuando cambia el año de UMA, porque es lo que se va a pagar.
- **Los meses de M10 se proyectan dentro del promedio.** El periodo contractual (del 1º del
  mes siguiente a la fecha de referencia hasta la fecha de retiro) entra al historial de
  cotización **al SBC declarado** y el promedio sale de las últimas 250 semanas cotizadas
  (Art. 167 LSS 1973). No hay ponderación aparte: el SBC proyectado que ve la persona es el
  mismo número que alimenta el cálculo.
- **Si la persona sigue trabajando, su último salario registrado se suma.** El SBC del
  periodo de M10 es `último salario registrado + SBC de M10` (dos cotizaciones en el mismo
  mes, como dos patrones simultáneos). Si ya no trabaja, el SBC del periodo es solo el de M10.
  La pregunta se hace en el paso 4 y su respuesta se declara en el paso 1 del desglose.
  La suma **no** se topa en este punto: el Art. 39 LSS 1973 (Art. 33 LSS vigente) clasifica al
  asegurado por la suma de los salarios percibidos, y el tope de 25 UMA opera sobre los
  aportes y sobre el promedio del SBC, que es donde lo aplica el motor.
- **Un solo lugar calcula la mezcla.** `calculateProjectedSBC` devuelve el promedio **y el
  reparto de semanas** (ordinarias y de M10); ese reparto viaja en la entrada para que el
  motor narre los mismos números. Se elimina la fórmula duplicada.
- **Los meses proyectados no son editables.** "Meses cotizando en M10" es texto de solo
  lectura, con el mismo patrón que la edad de retiro: se derivan de la fecha exacta de retiro.
- **Costo mensual de solo lectura, sin INFONAVIT y desglosado.** La cuota se arma con la
  estructura de financiamiento oficial del IMSS, rama por rama (cuota fija y excedente del
  SEM, prestaciones en dinero, gastos médicos para pensionados, Invalidez y Vida, Guarderías,
  Retiro y cesantía y vejez por banda de UMAs) más la prima de Riesgos de Trabajo de la clase
  (I–V), que se deriva de la ocupación (División/Grupo) según el catálogo oficial del IMSS.
  El detalle de esa decisión y de sus fuentes está en
  [ADR-0015](0015-cuota-modalidad-10-con-la-estructura-oficial-del-imss.md) y
  [ADR-0016](0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md).
- **Sin meses retroactivos.** M10 arranca el 1º del mes siguiente a la fecha de referencia
  (Art. 224 LSS vigente: la cuota se paga por adelantado, sin actualizaciones ni recargos).

## Consecuencias

### Positivas

- La app calcula la pensión del régimen que dice calcular, con la modalidad que corresponde a
  ese régimen, y con el fundamento legal a la vista.
- El SBC que ve la persona, el que alimenta el cálculo y el que aparece en el desglose y en
  el PDF son el mismo número.
- El SBC declarado se acota al rango legal y ese rango se explica en la interfaz.
- El desglose auditable (ADR-0006) conserva el detalle: cuántas semanas son ordinarias,
  cuántas son de M10 y con qué salario.
- El acuerdo de octubre de 2026 queda documentado, con su efecto real: no modifica la M10 y
  sí explica por qué el asegurado del régimen anterior conviene a esta modalidad.

### Costes

- El horizonte largo hace que el promedio converja al SBC de M10: es el comportamiento
  correcto según el Art. 167, pero se declara para que quien compare con el IMSS sepa
  interpretarlo.
- El Art. 194 de la Ley 73 permite quedarse en el mismo *grupo de salario* o en el inmediato
  inferior o superior; la app deja elegir el SBC de forma continua y **no modela** esas
  bandas. Se declara como supuesto.
- La clase de riesgo viene del **catálogo oficial de ocupaciones del IMSS** y ya no se
  aproxima ([ADR-0016](0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md)); lo que
  queda en manos de la persona es elegir el grupo que corresponde a su actividad real. La
  estructura de la cuota, por su parte, tiene fuente primaria desde
  [ADR-0015](0015-cuota-modalidad-10-con-la-estructura-oficial-del-imss.md).
- Las simulaciones guardadas por versiones anteriores se normalizan **en memoria** al leer
  (la clave vieja `modalidad40` se lee como `modalidad10`); no se reescribe lo que la persona
  tiene guardado (ADR-0013).

## Alternativas descartadas

- **Conservar la Modalidad 40 y agregar la 10 como opción.** Habría dos ramas en el motor,
  dos conjuntos de constantes legales y una UI con dos modalidades que la ley no distingue
  para este régimen. Se descartó: la app calcula un solo régimen.
- **Mantener la ponderación "por encima" del SBC proyectado.** Se descartó porque el SBC
  proyectado mostrado y el calculado no coincidían, y porque la fórmula estaba duplicada con
  guardas distintas (la divergencia ya documentada en `docs/deuda-tecnica.md`).
- **Acotar el SBC capturado en el propio campo de texto.** Se descartó: al teclear, el texto
  se reescribe con el valor acotado y no se puede escribir una cantidad completa. El acotado
  vive en el control de UMAs (sus topes) y en el esquema de validación (su mensaje).
- **Citar el artículo reglamentario de la Modalidad 10 sin verificarlo.** Se descartó: una
  cita legal no comprobada es peor que una pendiente declarada.

## Relación con las specs

- [Spec-01](../spec/01-motor-de-calculo-ley-73.md): las reglas de cálculo de la Modalidad 10.
- [Spec-06](../spec/06-captura-y-validacion-de-datos.md): los campos del paso 4.
- [Spec-07](../spec/07-historial-de-cotizacion-y-promedio-sbc.md): el SBC proyectado con M10.
- [Spec-09](../spec/09-alcance-de-la-estimacion-y-aviso-legal.md): los supuestos que se declaran.
- [Investigación: Modalidad 10](../investigacion/modalidad-10-incorporacion-voluntaria.md): las
  citas textuales verificadas y lo que queda pendiente de confirmar.
