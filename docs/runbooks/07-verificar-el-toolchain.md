# Runbook-07 — Verificar el toolchain (iOS, Expo, CI)

## Cuándo se usa

Antes de una publicación, cuando cambia alguna dependencia nativa, o cuando
`expo-doctor` reporta hallazgos y hay que decidir qué arreglar ahora y qué
documentar como deuda.

## Estado del toolchain (última auditoría: 2026-10-24, CHG-20261024-002)

| Componente | Versión esperada | Notas |
| --- | --- | --- |
| Node.js | 22 | Fijado en los 3 workflows que instalan Node (`setup-node`): `ci.yml`, `codeql.yml` y `deploy-staging.yml` |
| Expo SDK | 57 | `expo ~57.x`; deployment target iOS 16.4 (`app.json` → `expo-build-properties`) |
| React Native | 0.86.x | Versiones de parche pueden quedar atrás de lo esperado por el SDK (ver deuda) |
| CocoaPods | instalado localmente | `ios/Podfile.lock` SÍ se versiona (271 pods) — ver `.gitignore`: "NO ignorar Podfile.lock en apps" |

## Procedimiento

### 1. Correr el diagnóstico

```bash
npx expo-doctor
```

Leer cada check fallido y clasificarlo: **error real** (puede romper un build o
la app en el dispositivo) o **deuda menor** (parches atrasados sin impacto
demostrado).

### 2. Errores reales: arreglar en el cambio

- **Dependencia peer nativa faltante** (p. ej. `react-native-worklets` exigida
  por `react-native-reanimated`): la app puede crashear fuera de Expo Go.
  Se corrige con `npx expo install <paquete>` **en el mismo cambio**, y
  regenerando pods (paso 4).
- **Config con campos de schema inválidos** (`app.json`): en SDK 57 el campo
  `splash` del root ya no es válido (lo maneja el plugin
  `expo-splash-screen`). Con los directorios nativos `ios/` versionados, esos
  campos no se sincronizan en EAS Build de todos modos — el campo sobrante se
  elimina y el splash real vive en `ios/MiPensionL73/SplashScreen.storyboard`.

### 3. Deuda menor: documentar, no arreglar a ciegas

Los parches atrasados (p. ej. `expo 57.0.9` vs esperado `~57.0.31`) se
actualizan con:

```bash
npx expo install --check
```

**No se ejecuta de rutina dentro de otro cambio**: tocar 13 paquetes a la vez
mezcla riesgos. Se agenda como cambio propio, con su `pod install` y su suite
en verde antes de merge.

### 4. Regenerar pods cuando cambia una dependencia nativa

```bash
npx pod-install
```

`ios/Podfile.lock` se commita junto con `package.json`/`package-lock.json` —
los tres en el mismo cambio. Un lock desfasado del manifest es exactamente el
tipo de diferencia que solo explota en la máquina de quien hace el build.

### 5. Regenerar el proyecto nativo iOS cuando cambia una dependencia nativa

`ios/` está versionado y EAS Build **no** ejecuta prebuild cuando el directorio
nativo existe: compila el `ios/` commiteado tal cual. Android no tiene directorio
versionado, así que EAS lo genera siempre en la nube. Esa asimetría significa que
un cambio de dependencia nativa sin regenerar `ios/` produce un binario de iOS con
código nativo viejo, y el error no aparece hasta que la app falla en el dispositivo.

Por eso, cuando el cambio toca una dependencia nativa (`expo-updates`, un plugin con
código nativo, un SDK de Expo):

```bash
npx expo prebuild --platform ios
npx pod-install
git diff ios/          # revisar: aquí se ve lo que cambió
```

Se commitea `ios/` **en el mismo cambio** que `package.json` y `package-lock.json`.

> El `git diff ios/` hay que leerlo, no aceptarlo a ciegas: si desaparece algo que no
> se esperaba (un asset, un ajuste manual), hay que entender por qué antes de
> commitear.

### 6. Verificar CI

De los 5 workflows, sólo `release.yml` construye iOS, y lo hace **en la nube de EAS**,
no en el runner: el runner de GitHub es Linux y compilar iOS requiere macOS y Xcode.
La prueba local de que el proyecto sigue compilando para iOS sigue siendo
`expo prebuild`/Xcode (paso 5) y el lint de `Podfile.lock` es la disciplina de commit
del paso 4.

Los dos workflows que dependen de las actualizaciones (`release.yml` y
`deploy-staging.yml`) comprueban que `ios/MiPensionL73/Supporting/Expo.plist` tenga
`EXUpdatesEnabled` en `True` y el mismo `EXUpdatesURL` que `app.json`. Con el
repositorio sin vincular a EAS, esas comprobaciones fallan: es el comportamiento
correcto, no un falso positivo.

## Verificación

- [ ] `expo-doctor` sin errores reales (solo deuda documentada aquí).
- [ ] Si cambió `package.json` con deps nativas: `Podfile.lock` regenerado y commitado.
- [ ] Si el cambio toca el nativo de iOS: `ios/` regenerado con `npx expo prebuild --platform ios`, `git diff ios/` revisado, y el resultado commiteado.
- [ ] Suite en verde (`npm run test:run`).
- [ ] Los thresholds de cobertura (`package.json` → `coverageThreshold`) siguen
      siendo pisos por debajo de la cobertura real — si un piso quedó por
      ENCIMA de la cobertura actual, CI falla y hay que bajarlo a floor real,
      no inflar la métrica.

## Si algo falla

**`pod install` falla por versión de Ruby/CocoaPods.** Documentar el error y el
ambiente en este runbook; no forzar upgrades globales de gems dentro de un
cambio de aplicación.

**`expo-doctor` marca checks que ya se arreglaron.** Puede pasar por caché;
correr de nuevo con `--verbose` y comparar contra esta tabla antes de
re-abrir el tema.
