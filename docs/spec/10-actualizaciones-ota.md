# Spec-10 — Actualizaciones por OTA

- **Estado**: Vigente
- **Ámbito**: `app.json`, `ios/MiPensionMX/Supporting/Expo.plist`, `eas.json`, proceso de release

## Propósito

Que una corrección de JavaScript llegue al usuario sin esperar una revisión de tienda, y que
quede explícito qué parte de la app puede cambiar sin que nadie la revise: el motor de
cálculo.

## Comportamiento

La app incluye `expo-updates` y se suscribe al canal de EAS Update que le corresponde a su
perfil de compilación:

| Perfil de `eas.json` | Canal | Quién recibe la actualización |
|---|---|---|
| `preview` | `staging` | Las instalaciones de staging |
| `release` | `production` | Las instalaciones del release publicado |
| `production` | `production` | Las instalaciones de tienda, cuando exista |

Al arrancar, la app consulta a `u.expo.dev` el manifiesto de actualización. Si hay una
actualización disponible para su runtime version, la descarga y la aplica en el siguiente
arranque. La app sigue funcionando con el bundle embebido si no hay red o no hay
actualización.

La actualización **no** se pide al usuario ni interrumpe el arranque: `EXUpdatesCheckOnLaunch`
es `ALWAYS` y `EXUpdatesLaunchWaitMs` es `0`, de modo que la app abre de inmediato y aplica
lo que ya tenga en caché.

## Reglas de negocio

- **La política de runtime version es `appVersion`.** Una OTA sólo se aplica a binaries
  cuya versión de la app coincide con la de la actualización. Un cambio de versión de la
  app invalida las actualizaciones anteriores, que es lo que impide que un bundle nuevo
  cambie el cálculo sobre un binario de otra versión.
- **El proyecto nativo commiteado es el que manda.** `ios/` está versionado y EAS Build no
  ejecuta prebuild cuando el directorio nativo existe: usa `ios/` tal como está en el
  commit. Por eso `EXUpdatesEnabled` y `EXUpdatesURL` de
  `ios/MiPensionMX/Supporting/Expo.plist` tienen que coincidir con `expo.updates.url` de
  `app.json`. Si no coinciden, las actualizaciones están desactivadas en el binario y el
  fallo sólo se ve en runtime.
- **`expo.updates.enabled` no se declara.** El valor efectivo lo decide `app.json`: sin
  `expo.updates.url` no hay actualizaciones, y el binario se compila con
  `EXUpdatesEnabled` en `false`. Es el comportamiento seguro por omisión.
- **La OTA a producción es un paso manual.** La publica una persona después de la puerta de
  promoción, nunca un workflow. El motivo está en [ADR-0017](../adr/0017-el-tag-produce-los-instalables-del-release.md).
- **La OTA es una actualización de código, no de contenido.** No cambia las constantes
  legales ([ADR-0005](../adr/0005-constantes-legales-en-modulos-separados.md)) sin que
  cambie la versión de la app: una tabla del Art. 167 corregida exige un binario nuevo,
  porque el usuario que ya la consultó guardó su simulación con el número anterior.

## Fuera de alcance

- No hay pantalla de "hay una actualización disponible": la app no lo anuncia.
- No hay actualización del motor de cálculo de forma silenciosa entre versiones de la app.
- No hay publicación automática de OTA a producción.
- No hay envío a tiendas: el perfil `production` existe pero no hay cuenta de Play ni de
  App Store Connect.

## Verificación

- Los dos workflows que dependen de las actualizaciones comprueban, antes de compilar, que
  `ios/MiPensionMX/Supporting/Expo.plist` tiene `EXUpdatesEnabled` en `True` y el mismo
  `EXUpdatesURL` que `app.json`. Con el repositorio en su estado actual, esas
  verificaciones **fallan**, que es lo correcto: el proyecto todavía no está vinculado a
  EAS.
- `npx expo config --type public` muestra `expo.updates.url` y `expo.runtimeVersion` con la
  política `appVersion`.
- Verificación manual: publicar una OTA al canal `staging` con
  `npx eas-cli update --channel staging --message "..."`, abrir la app de staging y
  comprobar que la siguiente apertura usa el bundle nuevo.
- El APK y el IPA adjuntos a un release se instalan y arrancan en un dispositivo real
  (runbook 01).
