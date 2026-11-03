# Mi Pensión L73 — Calculadora de pensión IMSS (Ley 73)

> **English summary below.** App móvil que estima la pensión de vejez bajo la **Ley del
> Seguro Social de 1973** en México. **React Native + Expo + TypeScript**, **sin backend**
> y **sin telemetría**: todo el cálculo y todos los datos del usuario viven en el
> dispositivo. La diferencia del producto no es el formulario: es que **el resultado es
> auditable** — cada número viene con su fórmula, su fundamento legal y la marca de si
> es exacto o estimado. Motor de cálculo como pipeline de 8 pasos puros, **459 pruebas**
> en 36 suites, **5 workflows de CI** con puerta de promoción.

Aplicación móvil desarrollada con **React Native 0.86 + Expo SDK 57 + TypeScript** para
estimar pensiones bajo la **Ley del Seguro Social de 1973 (Ley 73)**.

> ⚠️ **AVISO LEGAL**: Esta aplicación proporciona **ESTIMACIONES** con fines informativos
> únicamente. La resolución oficial de cualquier pensión corresponde exclusivamente al
> IMSS conforme a sus procedimientos institucionales. Los cálculos se basan en la Ley del
> Seguro Social de 1973 y valores de referencia (UMA, SMG) que pueden diferir de los
> criterios operativos del IMSS en cada caso particular. Acuda a la Subdelegación del
> IMSS correspondiente para información oficial.

---

## English summary

A mobile app that estimates the old-age pension under Mexico's **Social Security Law
(1973)**. Built with **React Native 0.86 + Expo SDK 57 + TypeScript**.

**What makes it different:** the result is not a number, it is an **auditable breakdown**.
Every step of the calculation carries its formula, the legal article it comes from, and
whether the value is exact or an estimate. A pension estimate is a number a person will
take to a government office, so it has to be explainable.

**Engineering highlights:**

- **Pure-function calculation pipeline.** The Ley 73 rules are 8 independent steps
  (`AverageSalaryStep` → `BasicQuantityStep` → … → `LimitsStep`), each a function
  `(ctx) => ctx`. Adding or fixing a rule touches one file.
- **No backend, no telemetry, no third-party SDKs.** The payroll record never leaves the
  device; there is no account, no analytics and no crash reporting.
- **Local PDF pipeline.** `pdfjs-dist` extracts text from the IMSS statement on the
  device; the parser rebuilds the weekly contribution history and computes the average
  over the last **250 *contributed* weeks** (not 250 calendar weeks).
- **One source of truth for validation.** A Zod schema drives both the forms and the
  calculation engine, with the legal article cited in the error message.
- **459 tests across 36 suites**, 89.6 % statement / 96.2 % function coverage on the
  decision-making code.
- **5 CI workflows**, including a promotion gate that requires human approval before a
  release is authorized.

**Docs:** [`docs/adr/`](docs/adr/) (17 architecture decision records),
[`docs/spec/`](docs/spec/) (10 behavioural specs),
[`docs/runbooks/`](docs/runbooks/) (7 operational procedures), plus
[`AGENTS.md`](AGENTS.md) and [`CONTEXT.md`](CONTEXT.md).

---

## 📋 Características

- **Calculadora de pensión Ley 73** con las reglas del articulado:
  - Cuantía básica (Art. 167 LSS 1973)
  - Incrementos anuales por semanas excedentes
  - Incremento del 11 % (decreto DOF 2001/2004)
  - Factor por edad (Cesantía en Edad Avanzada, Arts. 138–140)
  - Asignaciones familiares (Arts. 163–164)
  - Ayuda asistencial (Art. 165)
  - Pensión Mínima Garantizada (Art. 170)
  - Tope de 25 UMA (Art. 28 LSS vigente)
  - Ajuste por Modalidad 10 (incorporación voluntaria, Arts. 222 a 233 LSS vigente)
- **Desglose auditable**: cada paso del cálculo muestra su fórmula, su referencia legal
  y si el valor es exacto o estimado
- **Historial** de las últimas 20 simulaciones (AsyncStorage)
- **Importación de la Constancia de cotizaciones en PDF** con extracción local de datos
- **Exportación a PDF** del reporte completo, con el desglose
- **Modo claro y oscuro** (Material Design 3)
- **Sección educativa** sobre Ley 73, UMA, Modalidad 10 y FAQ

---

## 🏗️ Arquitectura

```
src/
├── models/          # Tipos TypeScript (PensionInput, PensionResult, ...)
├── constants/       # Tablas Ley 73 (Art. 167), UMA/SMG, textos legales
├── services/
│   ├── pension/     # Motor de cálculo
│   │   ├── steps/   # Un archivo por regla de la ley (8 pasos)
│   │   ├── history/ # Historial semanal y promedio del SBC
│   │   └── PensionCalculator.ts  # Orquestador del pipeline
│   ├── export/      # pdfExport.ts (expo-print + expo-sharing)
│   └── pdf/         # Importación y parsing de PDFs (pdfjs-dist)
├── screens/         # 9 pantallas
├── navigation/      # React Navigation v7 (Stack + Bottom Tabs)
├── hooks/           # usePensionForm, useHistory
├── theme/           # MD3 claro/oscuro
├── validation/      # Schemas Zod (fuente única de verdad)
├── storage/         # AsyncStorage (últimas 20 simulaciones)
└── utils/           # format.ts (Intl), date.ts, modalidad10.ts
```

### El motor de cálculo es un pipeline de funciones puras

```
Input → AverageSalaryStep → BasicQuantityStep → AnnualIncrementsStep
      → DecreeIncrementStep → AgeFactorStep → FamilyAssignmentsStep
      → AssistanceAidStep → LimitsStep → PensionResult
```

Cada paso:

- Recibe un `CalculationContext` y devuelve un contexto actualizado (sin mutar).
- Deja su propio fragmento del desglose, con la fórmula, la referencia legal y el
  supuesto si lo hay.
- Es puro: sin UI, sin navegación, sin efectos secundarios.

> Ver [ADR-0001](docs/adr/0001-motor-de-calculo-como-pipeline-de-funciones-puras.md) para
> el razonamiento completo, y
> [Spec-01](docs/spec/01-motor-de-calculo-ley-73.md) para el comportamiento esperado.

---

## 📚 Documentación

| Carpeta | Qué contiene | Cantidad |
|---|---|---|
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura: **por qué** el código es así | 17 ADR |
| [`docs/spec/`](docs/spec/) | Comportamiento observable: **qué** hace el sistema | 10 specs |
| [`docs/runbooks/`](docs/runbooks/) | Procedimientos: **cómo** se hace cada tarea repetida | 6 runbooks |
| [`AGENTS.md`](AGENTS.md) | Contrato de trabajo para agentes de código | — |
| [`CONTEXT.md`](CONTEXT.md) | Contexto del proyecto y del dominio | — |

---

## 🧪 Pruebas

```bash
npm run test:run       # 36 suites, 459 casos
npm run test:coverage  # con reporte de cobertura
npm run typecheck
npm run lint
```

**Cobertura** (medida sobre `src/services/**`, `src/hooks/**` y `src/storage/**` — el
código que decide, no las pantallas):

| Métrica | Valor |
|---|---|
| Statements | 89.6 % |
| Ramas | 84.3 % |
| Funciones | 96.2 % |
| Líneas | 92.0 % |

La cobertura **no** se mide sobre las pantallas: un snapshot que se actualiza a ciega no
prueba nada. La cobertura de una pantalla es un indicador pobre; la del motor no.

Escenarios cubiertos: validación de entrada (semanas < 500, edad < 60, salario 0),
pensión de vejez, cesantía en edad avanzada, incrementos anuales, asignaciones
familiares, ayuda asistencial, tope de 25 UMA, pensión mínima garantizada, desglose de
pasos, promedio del SBC sobre 250 semanas cotizadas, empleos
simultáneos, cambios de salario a mitad de semana, importación de PDF, parsing de la
constancia, exportación a PDF y persistencia del historial.

---

## ⚙️ Integración continua

| Workflow | Qué hace |
|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | Tipos, lint, pruebas fragmentadas en 3 shards, cobertura y empaquetado web |
| [`codeql.yml`](.github/workflows/codeql.yml) | Análisis de seguridad de CodeQL |
| [`release.yml`](.github/workflows/release.yml) | Compila Android e iOS en EAS por etiqueta y publica el release con los instalables adjuntos |
| [`deploy-staging.yml`](.github/workflows/deploy-staging.yml) | Build de preview y actualización OTA al canal `staging` |
| [`promotion-gate.yml`](.github/workflows/promotion-gate.yml) | Verifica CI y staging, y **exige aprobación humana** antes de autorizar un release a producción |

Las acciones están fijadas por SHA de commit, no por etiqueta: una etiqueta puede
re-apuntar, un commit no.

La puerta de promoción produce el artefacto `AUTORIZACION.md` con el commit
autorizado y el aprobador. **El tag `v*` es lo que autoriza la publicación**: el
workflow `release.yml` compila Android e iOS en la nube de EAS y adjunta los
instalables al release de GitHub. El APK es instalable en cualquier Android; el IPA es
de distribución *ad hoc* y sólo instala en los dispositivos registrados en el perfil de
aprovisionamiento. La configuración de una sola vez (proyecto de EAS vinculado,
`EXPO_TOKEN`, credenciales de Apple) está en el runbook 01.

---

## 🔒 Privacidad

- **Sin backend**: toda la información permanece en el dispositivo
- **Sin login**: sin registro de usuarios
- **Sin telemetría**: sin analítica, sin reporte de errores remoto, sin push, sin SDKs de terceros
- **Sin base de datos remota**: sin persistencia en servidores
- El historial de simulaciones se guarda únicamente en `AsyncStorage` local
- La importación de PDFs se procesa 100 % localmente
- El canal de actualizaciones de Expo recibe sólo el identificador de instalación, la
  versión y la plataforma: ningún dato del usuario

> Ver [ADR-0002](docs/adr/0002-cero-backend-todo-en-el-dispositivo.md),
> [ADR-0009](docs/adr/0009-cero-telemetria-y-cero-servicios-de-terceros.md) y
> [ADR-0017](docs/adr/0017-el-tag-produce-los-instalables-del-release.md).

---

## ⚖️ Base legal

| Artículo | Contenido |
|---|---|
| Arts. 138–140 LSS 1973 | Cesantía en Edad Avanzada y factores de reducción |
| Art. 145 LSS 1973 | Pensión de Vejez |
| Arts. 163–164 LSS 1973 | Asignaciones familiares |
| Art. 165 LSS 1973 | Ayuda asistencial |
| Art. 167 LSS 1973 | Tabla de cuantías básicas e incrementos anuales |
| Art. 170 LSS 1973 | Pensión Mínima Garantizada |
| Art. 182 LSS 1973 | Conservación de derechos |
| Art. 28 LSS vigente | Tope de 25 UMA del SBC |
| Arts. 222 a 233 LSS vigente | Modalidad 10 (incorporación voluntaria) |
| Art. 39 LSS 1973 / Art. 33 LSS vigente | Suma de los salarios concurrentes para el goce de prestaciones |

> **Nota sobre la tabla del Art. 167**: los porcentajes de cuantía básica e incrementos
> anuales son de referencia bibliográfica. El IMSS puede aplicar criterios operativos
> distintos. Los resultados siempre se marcan como ESTIMACIONES.

> **Nota sobre la cuota de la Modalidad 10**: se calcula con la estructura de financiamiento
> oficial del IMSS —Cuadro A.3 del Anexo A al Informe al Consejo Técnico 2025-2026 y la
> calculadora oficial para Personas Trabajadoras Independientes—, sin la aportación a
> INFONAVIT. La clase de riesgo sale del catálogo oficial de ocupaciones del IMSS; lo que
> depende de la persona es elegir el grupo que corresponde a su actividad real.

---

## 🚀 Instalación y ejecución

### Prerrequisitos

- Node.js 22+
- npm 10+
- Expo CLI: `npm install -g expo-cli`
- Expo Go en el dispositivo (iOS/Android), o un development build

**Toolchain esperada:** Expo SDK 57 · React Native 0.86.x · TypeScript ~6.0.3 ·
Hermes (motor JS) · CocoaPods con `ios/Podfile.lock` versionado · deployment
target iOS 16.4 · Xcode 16+ para builds locales. Detalle y procedimiento de
auditoría: [runbook-07](docs/runbooks/07-verificar-el-toolchain.md).

### Instalación

```bash
git clone https://github.com/VieyraLabs/mi-pension-l73.git
cd mi-pension-l73
npm install
npm start
```

Escanea el QR con Expo Go. Para la importación de PDF en nativo, hace falta un
development build: el fallback heurístico no decodifica streams comprimidos
([ADR-0003](docs/adr/0003-extraccion-local-de-pdf-con-pdfjs-dist.md)).

### Scripts

```bash
npm start              # Servidor de Expo
npm run ios            # Simulador iOS
npm run android        # Emulador Android
npm run test:run       # Pruebas
npm run test:coverage  # Pruebas con cobertura
npm run typecheck      # Tipos
npm run lint           # ESLint
```

---

## 📦 Dependencias principales

| Paquete | Propósito |
|---------|-----------|
| `expo ~57` | Framework base |
| `react-native 0.86` | Runtime |
| `react-native-paper ^5` | Componentes MD3 |
| `@react-navigation/*` | Navegación |
| `react-hook-form ^7` | Formularios |
| `zod` | Validación de esquemas |
| `@react-native-async-storage/async-storage` | Historial local |
| `pdfjs-dist` | Extracción local de texto de PDF |
| `expo-print`, `expo-sharing` | Exportación a PDF |
| `expo-document-picker`, `expo-file-system` | Importación de PDF |
| `jest`, `jest-expo`, `@testing-library/react-native` | Pruebas |

---

## 📌 Estado y alcance

- La app **no está publicada en ninguna tienda**. No hay descargas, ni usuarios, ni
  ingresos, ni pagos en producción.
- No hay backend, ni cuentas, ni telemetría.
- No hay OCR: un PDF escaneado requiere captura manual, y la app lo dice.
- La Modalidad 10 se estima con el historial proyectado, no con el historial exacto.

---

## 📄 Licencia

MIT. Ver [LICENSE](LICENSE).

El código se publica para que sea **auditable**: la lógica de cálculo y las fuentes
legales son revisables. No es un proyecto que busque contribuciones.

---

*Vieyra Labs*
