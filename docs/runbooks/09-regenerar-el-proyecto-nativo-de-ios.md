# Runbook-09 — Regenerar el proyecto nativo de iOS

## Cuándo se usa

Cuando cambia una dependencia nativa, el SDK de Expo, o cualquier cosa que afecte al
proyecto nativo y haya que volver a generar `ios/`. También cuando el proyecto nativo
quedó con un nombre o una estructura equivocada.

`ios/` está versionado y EAS Build **no** ejecuta prebuild cuando el directorio nativo
existe: compila el `ios/` commiteado tal cual (ver runbook 07, paso 5).

## Antes de empezar

- **Que `expo.name` sea ASCII.** Si `expo.name` lleva acentos, Expo los **borra** al
  derivar el nombre del proyecto nativo y el proyecto sale con un nombre truncado
  ("Mi Pensión L73" → `MiPensinL73`). La regla completa está en
  [ADR-0018](../adr/0018-el-nombre-del-proyecto-nativo-deriva-de-expo-name.md). El
  nombre visible va aparte, en `ios.infoPlist.CFBundleDisplayName`.
- **Xcode y CocoaPods instalados** (runbook 07).
- **`git status` limpio o con los cambios a la vista**, para distinguir lo que ya estaba
  de lo que genera el prebuild.

## Pasos

### 1. Regenerar

```bash
npx expo prebuild --platform ios
```

`--clean` rehace el proyecto desde cero; úsalo sólo si el directorio quedó corrupto,
porque borra `ios/` entero (incluidos los pods) y las personalizaciones locales.

### 2. Comprobar el nombre

```bash
ls ios
```

Debe aparecer `MiPensionL73/` y `MiPensionL73.xcodeproj/`. Si el nombre sale distinto
(por ejemplo `MiPensinL73`), el problema es `expo.name`: **no lo renombres a mano**,
arregla `app.json` (ADR-0018) y repite el prebuild.

### 3. Regenerar los pods

```bash
npx pod-install
```

Los `.xcconfig` de CocoaPods se nombran con el target (`Pods-MiPensionL73.xcconfig`), así
que sin este paso el proyecto apunta a archivos que no existen.

### 4. Leer el diff

```bash
git diff ios/
```

El `project.pbxproj` **cambia los UUID de cada objeto en cada regeneración**: es ruido
esperado. Lo que hay que leer es si desaparece o cambia algo con intención: un asset, un
ajuste manual, un permiso.

### 5. Regenerar el icono de iOS (después del prebuild, nunca antes)

Un prebuild vuelve a renderizar el AppIcon de iOS desde `src/assets/icon.png`, y ese
render sale **con canal alfa**, que App Store no acepta para el icono de 1024×1024. La
versión canónica (aplanada, sin alfa) la genera `.devspace/state/tools/icon-gen` a
partir de `src/assets/icon-source.svg`:

```bash
node .devspace/state/tools/icon-gen/render.js
```

El orden importa: **prebuild primero, `icon-gen` después**. Al revés, el prebuild vuelve a
sobrescribir el icono aplanado con el render con alfa.

La herramienta escribe en `ios/MiPensionL73/`: si sus rutas apuntaran a otro nombre, el
icono canónico quedaría en una carpeta fantasma y el AppIcon del proyecto real seguiría
con el render del prebuild. El `AppIcon-1024x1024@1x.png` que produce la herramienta es
byte a byte el que espera App Store (sin alfa, 1024×1024).

### 6. Commitear

`ios/` se commitea **en el mismo cambio** que `package.json` y `package-lock.json`,
junto con `ios/Podfile.lock`.

## Verificación

- [ ] `ls ios` muestra `MiPensionL73/` y `MiPensionL73.xcodeproj/`.
- [ ] `grep -rn "MiPensinL73" ios --exclude-dir=Pods --exclude-dir=build` no devuelve nada.
- [ ] `grep -n "target '" ios/Podfile` devuelve `target 'MiPensionL73'`.
- [ ] `sips -g hasAlpha ios/MiPensionL73/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`
      devuelve `hasAlpha: no` (App Store no acepta el icono de 1024 con canal alfa).
- [ ] Existe `ios/Pods/Target Support Files/Pods-MiPensionL73/`.
- [ ] `ios/Podfile.properties.json` tiene `"mainTarget":"MiPensionL73"`.
- [ ] `git diff ios/` revisado: sólo UUIDs y lo esperado.
- [ ] Suite en verde (`npm run test:run`).

## Si algo falla

**El proyecto sale con otro nombre.** `expo.name` tiene caracteres no ASCII. Arreglar
`app.json`; el saneado de Expo no se puede parchear.

**Falta `Pods-MiPensionL73.xcconfig`.** Falta el paso 3: el `.xcconfig` se nombra con el
target, y `pod install` lo crea.

**El AppIcon salió con canal alfa.** Es lo que hace el prebuild. Para la versión
aplanada hace falta `icon-gen` (paso 5), **después** del prebuild.

**`icon-gen` no cambia nada.** Sus rutas apuntan a `ios/MiPensionL73`; si el proyecto
se renombrara otra vez, hay que actualizarlas o la herramienta escribe en una carpeta
fantasma.

**`pod install` falla por versión de Ruby/CocoaPods.** No hacer upgrades globales de gems
dentro de un cambio de aplicación; documentarlo en el runbook 07.
