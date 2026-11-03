# AGENTS.md — contrato de trabajo para agentes de código

Este repositorio se desarrolla con asistencia de agentes de IA. Este archivo es el
contrato: qué se puede tocar, qué no, y con qué criterio se acepta un cambio.

Léelo antes de escribir código. Si una regla aquí contradice tu criterio, la regla gana.

---

## 1. Qué es este proyecto

Una app móvil que estima la pensión de vejez bajo la Ley del Seguro Social de 1973
(Ley 73) en México. React Native + Expo + TypeScript. **Sin backend**: todo el cálculo
y todos los datos del usuario viven en el dispositivo
([ADR-0002](docs/adr/0002-cero-backend-todo-en-el-dispositivo.md)).

El valor del producto no está en el formulario: está en que **el resultado es
auditable**. Cada número va acompañado de su fórmula, su fundamento legal y la marca de
si es exacto o estimado ([ADR-0006](docs/adr/0006-el-resultado-es-un-desglose-auditable.md)).

## 2. Documentación: la fuente de la verdad

| Carpeta | Qué contiene | Cuándo se toca |
| --- | --- | --- |
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura: **por qué** el código es así | Cuando cambia una decisión |
| [`docs/spec/`](docs/spec/) | Comportamiento observable: **qué** hace el sistema | Cuando cambia el comportamiento |
| [`docs/runbooks/`](docs/runbooks/) | Procedimientos: **cómo** se hace cada tarea repetida | Después de hacer la tarea, no antes |
| `AGENTS.md` | Este contrato | Cuando cambia el proceso |
| `CONTEXT.md` | Contexto del proyecto y del dominio | Cuando cambia el contexto |

**Regla:** el código es la implementación; la documentación es el contrato. Un cambio de
comportamiento sin su spec actualizada es un cambio a medias.

## 3. Orden de edición

De arriba hacia abajo, igual que en cualquier repo con contrato:

1. **Constantes legales** (`src/constants/`) — si cambia la ley o una tabla.
2. **Motor** (`src/services/pension/`) — si cambia una regla.
3. **Validación** (`src/validation/`) — si cambia una regla de entrada.
4. **UI** (`src/screens/`, `src/components/`) — si cambia la presentación.
5. **Pruebas** (`src/__tests__/`) — siempre, en el mismo cambio.
6. **Documentación** (`docs/`) — ADR y spec afectados.

## 4. Qué puedes tocar y qué no

### Se puede

- Añadir un paso al pipeline, con su ADR y su spec.
- Añadir una regla de validación a `PensionInputSchema`.
- Añadir una pantalla, un componente compartido o un caso de prueba.
- Actualizar una constante legal **con su fuente verificada**.

### No se puede, sin una decisión explícita en el issue o en el commit

- **Añadir un servicio de terceros** que reporte datos del usuario
  ([ADR-0009](docs/adr/0009-cero-telemetria-y-cero-servicios-de-terceros.md)).
- **Añadir un backend, una API o una cuenta de usuario**
  ([ADR-0002](docs/adr/0002-cero-backend-todo-en-el-dispositivo.md)).
- **Inlinear una constante legal** en el código. Los valores normativos viven en
  `src/constants/` y llevan su fuente en el comentario
  ([ADR-0005](docs/adr/0005-constantes-legales-en-modulos-separados.md)).
- **Añadir un hex literal** en una pantalla. Los colores salen del tema
  ([ADR-0008](docs/adr/0008-tema-material-design-3-claro-y-oscuro.md)).
- **Reordenar el `PIPELINE`** sin justificar el motivo. El orden es normativo.
- **Reescribir un ADR existente.** Se marca como sustituido y se escribe uno nuevo.
- **Suprimir un test** o relajar una aserción para que la suite pase.

## 5. Criterio de aceptación de un cambio

Un cambio está listo cuando:

1. `npm run typecheck` pasa.
2. `npm run lint` pasa.
3. `npm run test:run` pasa.
4. `npm run test:coverage` no baja la cobertura.
5. Si cambia el comportamiento observable, la spec está actualizada.
6. Si cambia una decisión, hay un ADR nuevo.
7. Si el cambio es una tarea repetible, el runbook correspondiente está escrito.

**No hay excepciones al punto 3.** Un test que falla porque el código nuevo es incorrecto
se arregla en el código. Un test que falla porque codificaba el comportamiento anterior
se cambia **con la fuente legal a la vista**, no para que la suite pase.

## 6. Estilo

- **Code in English.** El código se programa en inglés, sin excepciones: identificadores,
  tipos, funciones, constantes, nombres de archivo y nombres de test van en inglés
  (`averageSalary`, `contributionHistory`, `PensionInput`, `extractHeaderSbc`). No se
  escriben nombres en español para el código, ni siquiera auxiliares o "temporales".
- **Comments in Spanish**, matching the existing code. Los comentarios explican **por
  qué**, no **qué**: el código ya dice qué hace.
- **UI text in Spanish**, y la documentación de `docs/` también.
- **Funciones puras donde se pueda.** Una regla de cálculo no sabe qué pantalla la invocó.
- **Sin `any`** sin una razón que lo justifique en el comentario.

## 7. Dominio: lo que no se negocia

Este producto maneja datos laborales y financieros de una persona real. La consecuencia
práctica:

- **El resultado es una estimación, siempre.** `isEstimate` es `true` siempre, y el aviso
  legal se agrega en el motor, no en la interfaz.
- **Los supuestos se declaran donde ocurren**, no en un aviso genérico al final.
- **Un dato que no se encontró se deja vacío**, nunca se aproxima en silencio.
- **No se afirma que un valor sea oficial.** La tabla del Art. 167 está marcada como
  referencia bibliográfica en el propio archivo de constantes.

## 8. Referencias

- [Cómo funcionan las cosas](CONTEXT.md)
- [Decisiones de arquitectura](docs/adr/README.md)
- [Comportamiento esperado](docs/spec/README.md)
- [Procedimientos operativos](docs/runbooks/README.md)
