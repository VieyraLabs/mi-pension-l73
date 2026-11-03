# ADR-0017 — El tag produce los instalables del release

- **Estado**: Aceptada
- **Fecha**: 2026-11-03
- **Ámbito**: proceso de release, `.github/workflows/release.yml`, `eas.json`, `app.json`

## Contexto

Hasta ahora la publicación era enteramente manual. El tag `v*` disparaba
[`release.yml`](../../.github/workflows/release.yml), que creaba un release de GitHub con el
changelog y **sin ningún binario**; los instalables se generaban a mano, en la máquina de
quien publicara, con `eas-cli build`. Tres consecuencias:

1. **El resultado no era reproducible.** El binario que se distribuía dependía del estado de
   la máquina de quien lo compilaba, no del repositorio.
2. **La publicación quedaba en una persona.** Sin pasos automatizados, la puerta de
   promoción de [`promotion-gate.yml`](../../.github/workflows/promotion-gate.yml) era el
   único control automatizado del proceso, y el build en sí no lo era.
3. **El canal de actualizaciones no existía.** `expo-updates` no estaba en
   `package.json`, así que el paso `eas update` de
   [`deploy-staging.yml`](../../.github/workflows/deploy-staging.yml) no podía funcionar, y
   los perfiles de `eas.json` declaraban canales (`staging`, `production`) que nadie
   consumía.

Al mismo tiempo, el repositorio declaraba de forma explícita que no había proyecto de EAS
vinculado ni publicación en tiendas, y que la publicación en producción era un
procedimiento manual.

## Decisión

**El tag `v*` es la autorización y produce los instalables.** El binario se compila en la
nube de EAS, en los mismos runners que verifican CI, y se adjunta al release de GitHub.

Reglas que acompañan la decisión:

- **El tag es la autorización, no un reflejo de ella.** El orden no cambia:
  `promotion-gate.yml` → aprobación humana → tag → build. Lo que cambia es que el tag
  dispara la compilación en lugar de dejar al publisher con el trabajo manual. La
  aprobación sigue siendo de una persona, en el environment `production`.
- **El build ocurre siempre en la nube de EAS.** El runner de GitHub es Linux y no puede
  compilar iOS. No hay builds locales en el proceso: el repositorio es la única fuente de
  lo que se distribuye.
- **Los instalables son de distribución interna.** El perfil nuevo `release` de
  [`eas.json`](../../eas.json) usa `distribution: "internal"` y
  `android.buildType: "apk"`. El APK queda instalable en cualquier Android; el IPA es
  *ad hoc* y **sólo instala en los dispositivos registrados en el perfil de
  aprovisionamiento**. El perfil `production` se conserva, sin cambios, para un futuro
  envío a tiendas.
- **La actualización OTA a producción no se automatiza.** El motor de cálculo viaja en el
  bundle de JavaScript, así que una OTA puede cambiar un monto de pensión sin pasar por la
  revisión de una tienda. Publicarla sigue siendo un paso manual del runbook 01, después
  de la puerta de promoción.
- **EAS Update es el único servicio de terceros dentro de la app**, y es una excepción
  explícita a [ADR-0009](0009-cero-telemetria-y-cero-servicios-de-terceros.md). Al
  arrancar, el dispositivo pide a `u.expo.dev` el manifiesto de actualización. De la app
  salen **el identificador de instalación, la versión de la app y la plataforma**. No sale
  ningún dato personal, laboral, ni de pensión, y no hay ningún evento de analítica. La
  prohibición de ADR-0009 sobre *reportar datos del usuario* se mantiene íntegra; lo que
  cambia es que ahora existe un servicio de terceros con el que la app habla, y ese
  servicio no sabe nada del usuario.

### Consecuencias de la última regla

- ADR-0009 sigue vigente en su decisión (cero telemetría) y su título queda acotado por
  esta ADR: el canal de actualización es el único tercero, y su superficie está limitada a
  lo que un gestor de actualizaciones necesita para funcionar.
- La app sigue sin necesitar política de privacidad de servidor
  ([ADR-0002](0002-cero-backend-todo-en-el-dispositivo.md)): no hay cuenta, no hay
  servidor, y ningún dato del usuario sale del dispositivo.

## Consecuencias

### Positivas

- **El binario distribuido es reproducible**: sale del commit etiquetado, no de una
  máquina.
- **Publicar deja de ser una tarea manual**: el tag dispara la compilación de las dos
  plataformas y adjunta los instalables al release.
- **El APK es instalable por cualquiera**, sin cuenta de tienda.
- **Las actualizaciones OTA funcionan**, lo que permite corregir el motor de cálculo sin
  esperar a una revisión de tienda.
- **La puerta de promoción sigue siendo de una persona**, y ahora hay un artefacto
  verificable: los binarios adjuntos al release son los del commit autorizado.

### Costes

- **El IPA sólo instala en dispositivos registrados.** El perfil *ad hoc* exige una
  membresía de Apple Developer de pago y un máximo de 100 iPhones al año. No hay forma de
  tener un IPA instalable por cualquiera sin una tienda.
- **El build en EAS tiene coste y cola.** Un build de producción tarda 20-40 minutos por
  plataforma y consume cuota de EAS Build.
- **La lista de dispositivos del perfil *ad hoc* se queda desactualizada.** En una
  ejecución no interactiva, EAS reutiliza el perfil existente sin refrescar la lista; por
  eso el workflow expone el input `refresh_provisioning`.
- **`ios/` está versionado, así que EAS no ejecuta prebuild.** El proyecto nativo
  commiteado es el que se compila. Si `package.json` cambia sin regenerar `ios/`, el
  binario sale con el nativo viejo. Por eso el workflow comprueba que el proyecto nativo
  y `app.json` coincidan antes de compilar.
- **Una OTA puede cambiar un resultado de pensión sin revisión.** El riesgo se acota
  usando la política de runtime version `appVersion` (una OTA sólo aplica a builds de la
  misma versión de la app) y dejando la publicación de la OTA de producción como paso
  manual.

## Alternativas descartadas

- **Build local en el runner de GitHub.** Descartado: compilar iOS requiere macOS y
  Xcode, y el runner es Linux. EAS Build en la nube es la única opción viable en CI.
- **Un workflow aparte para el build, además de `release.yml`.** Descartado: los dos
  dispararían con el mismo tag y ambos intentarían crear el release. El build se
  integra en `release.yml` como un job que el job de publicación espera.
- **Distribución de tienda (`.aab` + `.ipa` de store).** Descartada por ahora: exige
  cuentas de Play y App Store Connect, que el proyecto no tiene y no necesita para
  distribuirse entre testers.
- **Adjuntar los binarios al release sin compilarlos en el tag.** Descartado: separaría
  el binario distribuido del commit etiquetado, que es justo lo que se quiere evitar.
- **Publicar la OTA a producción desde el workflow.** Descartada: el motor de cálculo
  viaja en el bundle de JavaScript y una actualización automática podría cambiar un monto
  de pensión sin que nadie lo revise.
