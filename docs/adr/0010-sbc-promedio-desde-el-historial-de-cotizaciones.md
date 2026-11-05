# ADR-0010 — El SBC promedio se calcula del historial completo de cotizaciones

- **Estado**: Aceptada (enmendada por [ADR-0020](0020-la-marca-vigente-es-por-patron-y-el-historial-se-ancla-al-dia-completo.md))
- **Fecha**: 2026-08-01
- **Ámbito**: `src/services/pension/history/`

## Contexto

El Art. 167 de la Ley del Seguro Social de 1973 define el salario base de cotización
promedio como el promedio de **las últimas 250 semanas cotizadas**. La regla tiene una
consecuencia que se confunde con frecuencia: **son semanas cotizadas, no semanas
calendario**.

Si el asegurado dejó de trabajar seis meses, esas 26 semanas no cotizadas ni cuentan ni
entran al promedio: el recorrido sigue hacia atrás en el historial hasta reunir 250
semanas **con cotización registrada**. La aproximación habitual de "250 semanas ≈ 4.8 años
calendario" es incorrecta en cuanto existe cualquier hueco laboral, y produce un SBC
promedio inflado en el caso más común: el del trabajador que tuvo una pausa.

La información necesaria existe: la Constancia de Semanas Cotizadas del IMSS trae, por
semana, la fecha, si hubo cotización y el SBC de cada periodo.

## Decisión

**El SBC promedio se calcula del historial semanal completo, no de una aproximación.**

- `src/services/pension/history/` reconstruye el historial desde el texto extraído de la
  constancia: una lista de `WeeklyContribution` con `date`, `contributed` y
  `salaryBaseContribution`.
- `contributionHistory.ts` recorre el historial **hacia atrás** acumulando semanas
  cotizadas hasta reunir `SBC_AVERAGE_WEEKS` (250), saltando las semanas sin cotización.
- El resultado (`ContributionSummary`) expone el desglose: semanas totales del historial,
  cotizadas, saltadas, seleccionadas, si se alcanzaron las 250 completas, y las fechas primera y
  última del rango usado. **El desglose se muestra al usuario**: sabe si su promedio se
  calculó con 250 semanas o con las que había.
- **Los empleos simultáneos se suman, no se promedian.** El barrido de intervalos
  (`accumulateDailySBC`) divide la ventana en tramos por cada frontera de inicio y fin de
  patrón, y en cada tramo suma los SBC de los patrones activos: si el asegurado tuvo dos
  empleos a la vez, su SBC es la suma de ambos. Pero **las semanas no se duplican** por
  tener varios patrones activos. Esto corrigió un error de doble conteo (commits
  `38a8f7e` y `582ef82`).
- **Cambios de salario a mitad de semana** se promedian ponderados por los días cubiertos.

Antes de esta decisión, el promedio se aproximaba con un dato de la constancia (el
último SBC). El commit `875d9cc` introduce el cálculo exacto y `f4c22c2` deja de
prellenar ese valor.

## Consecuencias

### Positivas

- **El promedio coincide con el criterio del IMSS**, que es lo que hace útil la app.
- El usuario ve el desglose del rango usado, así que puede verificar que se tomó el
  periodo correcto.
- La lógica es pura y está aislada en un módulo sin dependencias de UI: se puede probar
  con historiales sintéticos, incluidos los casos de hueco laboral y de empleo
  simultáneo.
- Los casos límite que la app temía (semanas sin cotización,owershell simultáneos)
  tienen test propio.

### Costes

- **Depende de la calidad del parsing del PDF.** Si el historial no se reconstruye bien,
  el promedio es inválido. Se mitiga con el desglose visible, con la entrada manual
  siempre disponible, y con un diagnóstico explícito cuando el documento no se puede
  leer.
- La reconstrucción del historial es el módulo más complejo de la app. Está aislado por
  eso: es pura, y su contrato son los tipos de `history/types.ts`.
- **El barrido de intervalos no es trivial.** Es un algoritmo de sweep line; se prefiere
  a un bucle ingenuo porque el barrido maneja correctamente los patrones que se solapan.

## Alternativas descartadas

- **Aproximar con el último SBC de la constancia.** Se descartó: es incorrecto cuando hay
  huecos laborales y cuando hay cambios de salario.
- **Aproximar con "250 semanas ÷ 52".** Se descartó por la misma razón: cuenta semanas
  calendario, no cotizadas.
- **Pedirle al usuario el SBC promedio.** Se descartó porque el usuario no lo sabe: es
  justamente lo que la app debe calcular.
- **Calcular el promedio en el servidor con la constancia completa.** Se descartó por
  [ADR-0002](0002-cero-backend-todo-en-el-dispositivo.md).

## Enmiendas

- **ADR-0020** ([La marca «Vigente» es por patrón y el historial se ancla al día
  completo](0020-la-marca-vigente-es-por-patron-y-el-historial-se-ancla-al-dia-completo.md))
  — Enmenda esta decisión sin cambiar su fondo: el historial completo se construye sobre
  **días completos** (el promedio no depende de la hora del día) y sobre el **fin que
  cada patrón declara** (un patrón sin fila BAJA ni marca «Vigente» no se estira hasta
  hoy).
