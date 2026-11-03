# Runbook-06 — Revisión previa a una publicación

## Cuándo se usa

Antes de autorizar el paso de una build de staging a producción. Es la última barrera
humana antes de que el cambio llegue a los usuarios.

## Antes de empezar

- [ ] La build de staging está instalada y probada en un dispositivo físico.
- [ ] El commit candidato tiene `ci.yml` en verde.

## Pasos

### 1. Revisión del diff

```bash
git log --oneline <último-release>..HEAD
git diff <último-release>..HEAD --stat
```

Revisar **cada commit**, no solo el diff acumulado. Buscar:

- Cambios en `src/constants/` → cambian el resultado de los cálculos.
- Cambios en `src/services/pension/steps/` → cambian una regla.
- Cambios en `src/services/pdf/` → cambian la importación.
- Cambios en `package.json` → suben o bajan dependencias.

### 2. Verificación local

```bash
npm run typecheck && npm run lint && npm run test:run && npm run test:coverage
```

### 3. Recorrido funcional en el dispositivo

Sobre la build de staging, en un iOS y en un Android:

- [ ] Panel: la app arranca y muestra el resumen.
- [ ] Nueva simulación: el flujo por pasos se completa con datos manuales.
- [ ] Cálculo: el resultado aparece con su desglose, y el desglose tiene una fila por
      paso con su fórmula y su referencia legal.
- [ ] Aviso legal: la tarjeta de estimación está visible en el resultado.
- [ ] Exportar PDF: el documento se genera, se abre y contiene el desglose completo.
- [ ] Importar PDF: con una constancia real, los campos se extraen; con un PDF
      escaneado, el mensaje es el honesto y la entrada manual funciona.
- [ ] Simulador: los dos escenarios se comparan.
- [ ] Historial: se guardan simulaciones, se listan, se reabre una y se elimina una.
- [ ] Información y FAQ: se abren y el texto se lee.
- [ ] Tema oscuro: se recorre la app en modo oscuro y nada es ilegible.

### 4. Revisión del resultado numérico

Con al menos **un caso de referencia** cuyo resultado se conoce:

- [ ] El monto mensual coincide con el esperado.
- [ ] El desglose paso a paso coincide con el cálculo a mano.

Si hay un caso de referencia documentado, es el mismo que se usa en la prueba unitaria
del motor.

### 5. Revisión de la documentación

Si el cambio afecta al comportamiento observable, la documentación tiene que estar al día:

- [ ] La spec correspondiente refleja el comportamiento nuevo.
- [ ] Si cambió una decisión, hay un ADR nuevo (los ADRs no se reescriben).
- [ ] El README describe el estado actual del proyecto.

### 6. Revisión de los instalables

El tag de la versión compila los dos binarios y los adjunta al release. Antes de dar el
release por bueno, hay que comprobar que los instalables que se distribuyen son los del
commit aprobado:

- [ ] El `.apk` del release instala y arranca en un Android físico.
- [ ] El `.ipa` del release instala y arranca en un iPhone registrado en el perfil *ad hoc*.
- [ ] La versión que muestra la app coincide con la del release.

Los binarios se descargan de la página del release de GitHub, que es el mismo commit que
pasó esta revisión.

### 7. Aprobación

La aprobación ocurre en GitHub, en el environment `production`: el job de
`promotion-gate.yml` espera ahí. Revisar el resumen del workflow antes de aprobar: es el
momento de mirar la cobertura publicada y el resultado de los jobs.

## Verificación

- [ ] Todos los puntos de las tres secciones anteriores están marcados.
- [ ] La diferencia con la versión anterior está entendida por quien aprueba.

## Si algo falla

**Un caso de la lista falla.** No se aprueba. Se corrige, se vuelve a desplegar a staging
y se repite el runbook desde el paso 1.

**El resultado numérico difiere del esperado y la causa no está clara.** No se aprueba.
Se usa el desglose paso a paso para localizar la diferencia: el desglose dice de dónde
sale cada número (ver [Spec-01](../spec/01-motor-de-calculo-ley-73.md)).
