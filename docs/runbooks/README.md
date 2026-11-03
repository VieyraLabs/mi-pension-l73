# Runbooks

Procedimientos operativos: **cómo se hace** cada cosa que hay que hacer repetidamente.
Los runbooks son la parte del repositorio que se consulta con el repo abierto y el
problema delante.

## Índice

| # | Runbook | Cuándo se consulta |
|---|---|---|
| [01](01-publicar-una-version.md) | Publicar una versión | Al preparar un release |
| [02](02-correr-la-suite-y-leer-la-cobertura.md) | Correr la suite y leer la cobertura | Antes de commitear |
| [03](03-agregar-una-etapa-al-pipeline.md) | Agregar una etapa al pipeline de cálculo | Al cambiar las reglas de cálculo |
| [04](04-diagnosticar-un-fallo-de-importacion-de-pdf.md) | Diagnosticar un fallo de importación de PDF | Cuando la importación no extrae datos |
| [05](05-actualizar-uma-y-constantes-legales.md) | Actualizar UMA y constantes legales | Cuando sale una nueva UMA |
| [06](06-revision-previa-a-una-publicacion.md) | Revisión previa a una publicación | Antes de abrir la puerta de promoción |
| [07](07-verificar-el-toolchain.md) | Verificar el toolchain | Cuando algo falla por el entorno |
| [08](08-auditar-el-contraste-de-la-interfaz.md) | Auditar el contraste de la interfaz | Al cambiar un color del tema o una superficie |

## Formato

```markdown
# Runbook-NN — Título

## Cuándo se usa
## Antes de empezar
## Pasos
## Verificación
## Si algo falla
```

## Regla

Un runbook se escribe **después** de hacer la tarea, no antes. La prueba de que un runbook
está bien es que alguien que no hizo la tarea puede seguirlo y llegar al mismo resultado.
Si un paso falla y hay que improvisar, ese paso estaba mal escrito: se corrige el runbook.
