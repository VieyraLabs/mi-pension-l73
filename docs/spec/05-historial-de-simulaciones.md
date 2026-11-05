# Spec-05 — Historial de simulaciones

- **Estado**: Vigente
- **Ámbito**: `src/storage/simulationStorage.ts`, `src/hooks/useHistory.ts`, `src/screens/HistoryScreen.tsx`

## Propósito

Conservar en el dispositivo las simulaciones que el usuario quiere comparar o volver a
consultar, sin cuenta y sin nube.

## Comportamiento

El historial guarda simulaciones completas —los datos de entrada y el resultado, con su
desglose— en `AsyncStorage`, bajo la clave `@mi_pension_mx:simulaciones`. La pantalla de
historial las lista, permite abrir una para ver su desglose, permite abrir la comparación
de una sola simulación y permite eliminarlas.

## Reglas de negocio

- **Se conservan como máximo 20 simulaciones.** Al superar el tope, se descarta la más
  antigua. El orden es por más reciente primero.
- **Cada registro se valida al leerlo.** `isValidSavedSimulation` comprueba que el
  registro tenga la forma actual (id, nombre, `creationDate` parseable y
  `result.monthlyPension` numérico).
- **Los registros incompatibles se descartan y se purgan.** Si un registro guardado por
  una versión anterior de la app no valida, se filtra en la lectura y se reescribe el
  almacenamiento sin él, para no volver a filtrarlo en cada lectura.
  (Es el caso del commit `37eb5e5`: el historial crasheaba con "Invalid time value" por
  registros con la fecha renombrada.)
- **El identificador es único por simulación**: `sim_<timestamp>_<aleatorio>`.
- **El desglose se conserva.** Un resultado guardado lleva sus `steps`, de modo que al
  reabrirlo se ve el mismo desglose que se vio al calcularlo.

## Fuera de alcance

- **No hay sincronización entre dispositivos** ([ADR-0002](../adr/0002-cero-backend-todo-en-el-dispositivo.md)).
- No hay búsqueda, filtrado ni etiquetado de simulaciones.
- No hay exportación del historial completo: la vía de salida es el PDF de cada
  resultado (ver [Spec-04](04-exportacion-del-reporte-en-pdf.md)).
- No hay migración de formato entre versiones: los registros que no validan se descartan.

## Verificación

- `src/__tests__/simulationStorage.test.ts` — alta, lectura, orden, descarte del
  registro inválido, purga, y respeto del tope de 20.
- `src/__tests__/useHistory.test.ts` — estados de carga, vacío y con datos; y el
  comportamiento ante un registro con fecha inválida.
