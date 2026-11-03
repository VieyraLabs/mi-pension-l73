# Runbook-01 — Publicar una versión

## Cuándo se usa

Cuando hay que cortar una versión de la app: una corrección importante, una actualización
de las constantes legales, o una versión mayor con funcionalidad nueva.

## Prerrequisitos (se configuran una vez, no en cada versión)

Si alguno falta, el workflow `release.yml` se detiene en su job de verificación con un
mensaje que dice exactamente cuál es.

- [ ] **Proyecto de EAS vinculado.** `app.json` tiene `expo.extra.eas.projectId`. Se
      obtiene con `npx eas-cli init` (requiere iniciar sesión con la cuenta de Expo) y el
      resultado se commitea.
- [ ] **URL de actualizaciones configurada.** `app.json` tiene `expo.updates.url`. Se
      obtiene con `npx eas-cli update:configure` y también se commitea.
- [ ] **Proyecto nativo al día.** `ios/MiPensionL73/Supporting/Expo.plist` tiene
      `EXUpdatesEnabled` en `True` y el mismo `EXUpdatesURL` que `app.json`. Como `ios/`
      está versionado y EAS no ejecuta prebuild, ese archivo es el que decide si las
      actualizaciones funcionan en el binario. Se regenera con el paso 3 de
      [runbook 07](07-verificar-el-toolchain.md).
- [ ] **Secreto `EXPO_TOKEN`** en `Settings → Secrets and variables → Actions`.
- [ ] **Credenciales de iOS en el proyecto de EAS.** `npx eas-cli credentials -p ios`, una
      vez. La distribución interna de iOS es *ad hoc*: necesita una membresía de Apple
      Developer de pago, un certificado de distribución y un perfil con la lista de
      dispositivos. En CI no interactivo, EAS **no** crea el certificado ni el perfil: si
      no existen, el build falla.
- [ ] **Dispositivos de prueba registrados.** `npx eas-cli device:create` (máximo 100
      iPhones al año). El IPA sólo instala en los dispositivos del perfil.
- [ ] **Environment `production` con *required reviewers*.** Sin reviewers, la puerta de
      promoción se aprueba sola y deja de ser una puerta.

## Antes de empezar

- [ ] La rama de trabajo está limpia: `git status` sin cambios pendientes.
- [ ] `npm run typecheck`, `npm run lint` y `npm run test:run` pasan en local.
- [ ] La versión de la app y la del build coinciden: `app.json` (`expo.version`) y
      `package.json` (`version`).
- [ ] El número de build nativo se incrementa solo: lo hace EAS en cada build del perfil
      `release` (`autoIncrement` en `eas.json`).

## Pasos

### 1. Cerrar la versión en el repositorio

```bash
git switch main
git pull --ff-only
git switch -c release/v1.2.0
```

Trabaja en una rama de release, no directamente en `main`.

### 2. Actualizar la versión

La versión del build nativo la gestiona EAS (`appVersionSource: "remote"` en `eas.json`): el
perfil `release` la incrementa solo en cada build (`autoIncrement`). No hay que subirla a
mano.

Lo que sí se versiona en el repositorio es el **número de versión de la app**, que se
lee de `package.json` y se muestra en la sección de información:

```json
{ "version": "1.2.0" }
```

Además hay que actualizar `expo.version` en `app.json` para que coincida.

### 3. Abrir la puerta de promoción

El workflow `promotion-gate.yml` es el que autoriza el paso a producción:

1. Verifica que el commit candidato tenga una ejecución verde de `ci.yml`.
2. Verifica que la ejecución de staging indicada haya terminado con `success`.
3. **Se detiene y espera la aprobación manual** en el environment `production`.
4. Tras la aprobación, produce el artefacto `AUTORIZACION.md` con el commit
   autorizado, los identificadores de las ejecuciones verificadas y el aprobador.

La aprobación es un environment protegido de GitHub: hay que tener reviewers
configurados en `Settings → Environments → production`. Sin reviewers, la puerta se
aprueba sola y pierde su sentido.

> **Este workflow no publica en producción.** Lo que produce es la **evidencia de
> autorización**: el artefacto que cita el paso 4. Si publicas sin él, el release queda
> sin la aprobación registrada.

Para ejecutarlo:

```bash
gh workflow run promotion-gate.yml \
  --ref main \
  -f ref="v1.2.0" \
  -f staging_run_id="<id de la ejecución de Deploy staging>"
```

### 4. Publicar la build: el tag dispara la compilación

La build ya no se compila a mano. El tag es lo que autoriza y lo que dispara:

```bash
git add package.json app.json
git commit -m "chore(release): v1.2.0"
git tag -a v1.2.0 -m "v1.2.0"
git push origin release/v1.2.0 --follow-tags
```

El tag dispara `release.yml`, que hace tres cosas en orden:

1. **Verifica** que CI está en verde en el commit etiquetado, que existe `EXPO_TOKEN` y que
   el proyecto de EAS está vinculado.
2. **Compila** Android e iOS en la nube de EAS, con el perfil `release` de `eas.json`
   (distribución interna). Los dos builds van en paralelo; si uno falla, el otro se
   publica igual.
3. **Publica** el release de GitHub con el changelog y los dos binarios adjuntos:
   `MiPensionL73-1.2.0-android.apk` y `MiPensionL73-1.2.0-ios.ipa`.

El build tarda 20-40 minutos por plataforma. La corrida se puede repetir sobre la misma
etiqueta: el workflow detecta que el release ya existe y reemplaza los binarios en vez de
fallar.

Para regenerar el perfil *ad hoc* de iOS con la lista de dispositivos al día (después de
registrar un dispositivo nuevo), hay que ejecutar el workflow a mano con ese input:

```bash
gh workflow run release.yml \
  -f tag="v1.2.0" \
  -f refresh_provisioning=true
```

### 5. Verificar los instalables

- [ ] El `.apk` se instala en un Android físico y arranca.
- [ ] El `.ipa` se instala en un iPhone **registrado en el perfil ad hoc** y arranca.
- [ ] El flujo principal (nueva simulación → resultado) funciona en ambos.
- [ ] La versión mostrada en la app coincide con la del release.
- [ ] El reporte en PDF se genera y se comparte correctamente.
- [ ] La puerta de promoción quedó registrada en el historial del workflow, con su
      artefacto de autorización.

### 6. Publicar la actualización OTA (opcional)

Si el cambio es solo de JavaScript, se puede publicar sin pasar por las tiendas:

```bash
npx eas-cli update --channel production --message "Corrección del cálculo de la Modalidad 10"
```

Este paso va **después** de la verificación del paso 5: es el punto en el que el cambio
llega a los usuarios. Es manual a propósito: el motor de cálculo viaja en el bundle de
JavaScript, así que una actualización automática podría cambiar un monto de pensión sin
que nadie lo revise ([ADR-0017](../adr/0017-el-tag-produce-los-instalables-del-release.md)).

## Si algo falla

**El build de EAS pide autenticación.** `EXPO_TOKEN` no está configurado o venció.
Generar uno en el panel de Expo y configurarlo como secreto del repositorio
(`Settings → Secrets and variables → Actions → EXPO_TOKEN`).

**El job de verificación dice que el proyecto no está vinculado a EAS.** Falta
`extra.eas.projectId` en `app.json`. Correr `npx eas-cli init` y commitear el resultado.

**El job de verificación dice que el proyecto nativo no está al día.** `app.json` y
`ios/MiPensionL73/Supporting/Expo.plist` no coinciden. Regenerar el proyecto nativo
(paso 3 de [runbook 07](07-verificar-el-toolchain.md)) y commitearlo.

**La puerta de promoción no aparece.** La ejecución del workflow no llegó al job de
aprobación: revisar si `ci.yml` está verde en el commit candidato. Si el environment
`production` no tiene reviewers configurados, la aprobación es automática y el paso no se
detiene.

**El build falla solo en iOS.** Casi siempre es la firma: la credencial de Apple no
está en el proyecto de EAS o el certificado expiró. Revisar `npx eas-cli credentials`.

**El IPA no instala en un iPhone.** Es el comportamiento esperado de la distribución
*ad hoc*: el dispositivo tiene que estar registrado en el perfil. Registrarlo con
`npx eas-cli device:create` y repetir el build con `refresh_provisioning=true`.

**La app instalada no refleja el código nuevo.** Hay una actualización OTA pendiente que
toma precedencia. Publicar con `npx eas-cli update --channel production` o reinstalar
la app.
