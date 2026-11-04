# Spec-11 — Identidad de la app: nombre visible y nombre del proyecto nativo

- **Estado**: Vigente
- **Ámbito**: `app.json`, `plugins/withAndroidAppName.js`, proyecto nativo de iOS (`ios/`)

## Propósito

Que la app se llame **Mi Pensión L73** en la pantalla de inicio del teléfono, en las dos
plataformas, y que el proyecto nativo de iOS se llame **MiPensionL73** en cualquier
regeneración. Los dos nombres son cosas distintas y este repo las mantiene separadas a
propósito: el nombre visible lleva acento, el nombre del proyecto nativo no puede
llevarlo.

## Comportamiento

| Dónde | Valor | De dónde sale |
|---|---|---|
| Nombre en la pantalla de inicio (iOS) | `Mi Pensión L73` | `app.json` → `ios.infoPlist.CFBundleDisplayName` |
| Nombre en la etiqueta del lanzador (Android) | `Mi Pensión L73` | `plugins/withAndroidAppName.js` → `app_name` de `strings.xml` |
| Nombre del proyecto nativo de iOS | `MiPensionL73` | `app.json` → `expo.name`, saneado por Expo |
| Target, scheme, bridging header, entitlements, `.xcconfig` de Pods | `MiPensionL73` | Derivados del nombre del proyecto nativo |

El proyecto nativo versionado vive en `ios/MiPensionL73/`, con `ios/MiPensionL73.xcodeproj/`
y `ios/Podfile.properties.json` → `"mainTarget":"MiPensionL73"`. Esos nombres son los que
usan los workflows de CI y los runbooks.

## Reglas de negocio

- **`expo.name` es ASCII.** Expo deriva de él el nombre del proyecto nativo con un
  saneado que **borra** los caracteres no ASCII en vez de transcribirlos:
  `"Mi Pensión L73"` se convertiría en `"MiPensinL73"`. El valor efectivo es
  `MiPensionL73`, cuyo saneado devuelve el mismo string. La regla completa, con el
  mecanismo y las alternativas descartadas, está en
  [ADR-0018](../adr/0018-el-nombre-del-proyecto-nativo-deriva-de-expo-name.md).
- **El nombre visible no vive en `expo.name`.** Vive en
  `ios.infoPlist.CFBundleDisplayName`, que Expo respeta por encima del valor abstracto
  (avisa por consola: `Ignoring abstract property "name"`).
- **Android usa el mismo valor que iOS.** El plugin local lee
  `ios.infoPlist.CFBundleDisplayName` y lo escribe como `app_name`, de modo que la marca
  está escrita en un solo lugar de `app.json` y las dos plataformas no se desincronizan.
  Sin ese plugin, Android mostraría `MiPensionL73`.
- **Regenerar el proyecto nativo no requiere renombrados a mano.** `npx expo prebuild
  --platform ios` produce `ios/MiPensionL73/` y `ios/MiPensionL73.xcodeproj/` tal cual,
  porque el nombre sale de `expo.name`. El procedimiento completo está en el
  [runbook 09](../runbooks/09-regenerar-el-proyecto-nativo-de-ios.md).

## Fuera de alcance

- El nombre del paquete de la app (`com.vieyralabs.mipensionl73`) y el esquema de URI
  (`mipension`): son identificadores técnicos, no nombres visibles, y no se rigen por esta
  spec.
- El nombre que aparece en el menú del cliente de desarrollo y en el panel de EAS: sale
  de `expo.name` y, por lo anterior, se ve como `MiPensionL73`.
- La identidad gráfica (icono, splash): es un tema aparte, con su propio pipeline de
  assets canónicos en `.devspace/state/tools/icon-gen`.

## Verificación

- `npx expo prebuild --platform ios --no-install` en un directorio limpio produce
  `ios/MiPensionL73/` y `ios/MiPensionL73.xcodeproj/`, con el target, el scheme y el
  bridging header en `MiPensionL73`.
- `npx expo prebuild --platform android --no-install` deja
  `android/app/src/main/res/values/strings.xml` con
  `<string name="app_name">Mi Pensión L73</string>`.
- `grep -rn "MiPensinL73" ios --exclude-dir=Pods --exclude-dir=build` no devuelve nada.
- `grep -n "target '" ios/Podfile` devuelve `target 'MiPensionL73'`.
- El prebuild avisa por consola que ignora el nombre abstracto, lo que confirma que el
  nombre visible de iOS viene de `CFBundleDisplayName` y no de `expo.name`:
  `ios: name: "ios.infoPlist.CFBundleDisplayName" is set in the config. Ignoring
  abstract property "name": MiPensionL73`.
