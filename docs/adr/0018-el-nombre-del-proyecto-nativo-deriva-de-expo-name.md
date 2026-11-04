# ADR-0018 — El nombre del proyecto nativo de iOS se deriva de `expo.name`, y `expo.name` es ASCII

- **Estado**: Aceptada
- **Fecha**: 2026-11-03
- **Ámbito**: `app.json`, proyecto nativo de iOS (`ios/`), plugin `plugins/withAndroidAppName.js`

## Contexto

Expo no expone ninguna propiedad para nombrar el proyecto nativo de iOS. Al extraer la
plantilla durante `expo prebuild`, ese nombre sale de `expo.name` con este saneado
(`@expo/config-plugins` → `IOSConfig.XcodeUtils.sanitizedName`):

```js
name.replace(/[\W_]+/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
```

El orden de esas dos operaciones es lo que importa. `\W` borra todo lo que no sea
`[A-Za-z0-9_]`, y la normalización NFD —que es la que descompone una vocal acentuada
para poderle quitar el acento— viene **después**. Una vocal acentuada, al no ser ASCII,
no es un carácter de palabra: **se borra entera en lugar de transcribirse**. Con
`expo.name = "Mi Pensión L73"` el saneado devuelve `"MiPensinL73"`.

Ese valor no queda en un archivo suelto: se usa para renombrar la plantilla antes de que
exista el proyecto (`package/ios/HelloWorld/**` → `package/ios/<nombre saneado>/**`) y
para sustituir `HelloWorld` en el `Podfile`, el `project.pbxproj` y el `xcscheme`. Por
eso el nombre equivocado queda en la carpeta, el `.xcodeproj`, el target, el scheme, el
bridging header, los entitlements y los `.xcconfig` de CocoaPods.

Cuando la marca pasó a llevar acento (commit `eadc4d0`, "Mi Pensión MX" → "Mi Pensión
L73"), el saneado empezó a producir `MiPensinL73`, y la siguiente regeneración del
proyecto nativo dejó el proyecto con ese nombre.

El nombre visible y el nombre del proyecto son dos cosas distintas, pero Expo las ata al
mismo campo: `expo.name` alimenta el `CFBundleDisplayName` de iOS (salvo que se fije
explícitamente en `ios.infoPlist`), el `PRODUCT_NAME` del target y el `app_name` de
Android. Dejarlos todos con acento no es una opción: el nombre del proyecto nativo no
acepta acentos.

## Decisión

**`expo.name` es ASCII y es el nombre del proyecto nativo; el nombre visible se fija por
plataforma.**

- **`expo.name` = `MiPensionL73`.** Sin acentos ni espacios, y su saneado devuelve el
  mismo string, así que el proyecto nativo sale con ese nombre en cualquier
  regeneración, sin renombrados manuales.
- **El nombre visible "Mi Pensión L73" se fija aparte, en cada plataforma:**
  - **iOS**: `ios.infoPlist.CFBundleDisplayName`. Expo respeta el valor explícito y lo
    avisa por consola (`Ignoring abstract property "name"`), así que el nombre en la
    pantalla de inicio no depende de `expo.name`.
  - **Android**: el plugin local [`plugins/withAndroidAppName.js`](../../plugins/withAndroidAppName.js),
    que escribe el `app_name` de `strings.xml` leyendo ese mismo
    `CFBundleDisplayName`. Así la marca está escrita en un solo lugar (`app.json`) y las
    dos plataformas no se desincronizan.
- **Regla para quien cambie la marca:** antes de tocar `expo.name`, comprobar que
  `sanitizedName(expo.name)` devuelve exactamente el nombre del proyecto nativo, y mover
  el nombre visible a `ios.infoPlist.CFBundleDisplayName` en vez de a `expo.name`.

## Consecuencias

### Positivas

- Regenerar el proyecto nativo (`npx expo prebuild --platform ios`) produce
  `ios/MiPensionL73/` y `ios/MiPensionL73.xcodeproj`, sin pasos manuales de renombrado.
- El nombre visible no depende de que `expo.name` sea ASCII: la marca conserva el acento
  en la pantalla de inicio de las dos plataformas.
- La marca visible está escrita en un solo lugar.

### Costes

- `expo.name` deja de ser un nombre de marca y pasa a ser un identificador técnico.
- El nombre visible queda replicado en dos plataformas, y por eso hace falta el plugin
  local: sin él, Android mostraría `MiPensionL73`.
- El plugin local es código que hay que mantener. Expo no expone `android.name` —el
  `app_name` de Android sale de `expo.name` por el plugin `AndroidConfig.Name.withName`—
  así que no hay forma de configurarlo desde `app.json`.

## Alternativas descartadas

- **Dejar `expo.name` con acento y renombrar a mano después de cada prebuild.** Es
  exactamente lo que falló: el nombre se pierde en la primera regeneración.
- **Parchear `sanitizedName` de Expo.** Es código de `node_modules`: no se puede
  mantener y se pierde en cada `npm install`.
- **Usar `expo.name` = "Mi Pensión L73" y aceptar el nombre truncado.** El proyecto
  nativo quedaría con un nombre que no aparece en ninguna otra parte del repositorio
  (CI, runbooks, documentación) y los `.xcconfig` de CocoaPods se renombrarían con él.
- **Usar `expo.name` = "MiPension L73" (con espacio).** El saneado también lo
  convertiría en `MiPensionL73`, pero el nombre técnico quedaría con un espacio que no
  existe en ninguna otra parte del repositorio.
