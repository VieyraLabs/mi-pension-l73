# CONTEXT.md — contexto del proyecto

Documento de entrada para quien llega al repositorio sin contexto: qué es esto, para qué
sirve, cómo está construido y qué decisiones de fondo lo sostienen.

Para el contrato de trabajo ver [`AGENTS.md`](AGENTS.md). Para las decisiones con su
razonamiento ver [`docs/adr/`](docs/adr/).

---

## Qué es

**Mi Pensión MX** es una aplicación móvil que estima la pensión de vejez bajo la
**Ley del Seguro Social de 1973** (Ley 73) en México. El usuario ingresa sus datos de
cotización y obtiene una estimación con el desglose de cómo se calculó, paso a paso, con
la referencia legal de cada paso.

No está publicada en ninguna tienda. No hay cuentas, no hay backend y no hay servicios de
terceros que reporten datos del usuario. El único tercero con el que habla la app es el
servicio de actualizaciones de Expo, que recibe el identificador de instalación, la versión
y la plataforma, y nada más ([ADR-0017](docs/adr/0017-el-tag-produce-los-instalables-del-release.md)).

## Por qué existe

El cálculo de una pensión bajo la Ley 73 es un problema que exige traducir un articulado
normativo en un cálculo verificable. El protocolo de cálculo del IMSS no está disponible
como API: hay que implementarlo. Y un número sin explicación no es utilizable en una
ventanilla.

De ahí salen las tres decisiones que definen el producto:

1. **El motor es un pipeline de funciones puras**, un paso por regla de la ley
   ([ADR-0001](docs/adr/0001-motor-de-calculo-como-pipeline-de-funciones-puras.md)).
2. **El resultado es un desglose auditable**, no una cifra
   ([ADR-0006](docs/adr/0006-el-resultado-es-un-desglose-auditable.md)).
3. **No hay backend**: el dato nunca sale del dispositivo
   ([ADR-0002](docs/adr/0002-cero-backend-todo-en-el-dispositivo.md)).

## Para quién

Para la persona_worker que está a meses o años de jubilarse y quiere saber cuánto va a
recibir, y qué tendría que cambiar para que fuera más. El usuario objetivo consulta la
app una vez, quizá dos, y comparte el PDF que exporta.

Ese contexto explica dos decisiones que de otro modo parecen arbitrarias:

- **El desglose es obligatorio**, porque el usuario va a comparar su resultado con la
  respuesta oficial y necesita saber en qué difieren.
- **El aviso legal es parte del resultado**, no un elemento de la interfaz: el usuario va
  a llevar ese número a una ventanilla.

## Cómo está construido

```
App.tsx                     Raíz de la app
├── navigation/
│   └── RootNavigator.tsx    Stack raíz + Bottom Tabs (8 pantallas)
├── screens/                 Una por función
│   ├── DashboardScreen      Panel
│   ├── NewSimulationScreen  Captura por pasos
│   ├── ResultScreen         Resultado + desglose
│   ├── HistoryScreen        Simulaciones guardadas
│   ├── PdfImportScreen      Importación de la constancia
│   ├── ValidationScreen     Revisión de lo importado
│   ├── InfoScreen           Marco legal y conceptos
│   └── FAQScreen            Preguntas frecuentes
├── components/              Piezas compartidas (banner, estado vacío, disclaimer)
├── services/
│   ├── pension/             Motor de cálculo
│   │   ├── PensionCalculator.ts   Orquestador del pipeline
│   │   ├── steps/                  Un archivo por regla de la ley
│   │   └── history/                Historial de cotización y promedio del SBC
│   ├── pdf/                 Importación de la constancia del IMSS
│   └── export/              Generación del reporte en PDF
├── validation/              Schemas de Zod (fuente única de verdad)
├── constants/               Valores normativos, con su fuente
├── storage/                 Persistencia local (AsyncStorage)
├── theme/                   Tema Material Design 3
└── utils/                   Formato, fechas, Modalidad 10
```

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Runtime | React Native 0.86 / Expo SDK 57 | Cross-platform, y el tooling de Expo permite sin backend |
| Lenguaje | TypeScript 6 | El dominio es un modelo de datos; los tipos son la documentación |
| UI | React Native Paper (MD3) | Componentes accesibles y tema claro/oscuro ([ADR-0008](docs/adr/0008-tema-material-design-3-claro-y-oscuro.md)) |
| Navegación | React Navigation v7 | Parámetros de ruta tipados ([ADR-0007](docs/adr/0007-navegacion-con-react-navigation.md)) |
| Formularios | React Hook Form + Zod | Una sola definición de la validación ([ADR-0004](docs/adr/0004-validacion-con-zod-como-fuente-unica.md)) |
| PDF (entrada) | pdfjs-dist | Extracción local, sin subir el documento ([ADR-0003](docs/adr/0003-extraccion-local-de-pdf-con-pdfjs-dist.md)) |
| PDF (salida) | expo-print + expo-sharing | Generación y envío por el sistema operativo |
| Persistencia | AsyncStorage | Volumen pequeño, sin dependencia nativa |
| Pruebas | Jest + jest-expo + Testing Library | 252 pruebas, 17 suites |

## Estado del proyecto

- **La captura son cuatro pasos** («Datos personales», «Historial laboral», «Edad de
  retiro», «UMA»): la edad de retiro salió de los datos personales porque es una decisión
  sobre cuándo se jubila la persona, no un dato que la describes. La edad de retiro se
  elige **por fecha** (calendario de ruedas) y la edad se deriva de esa fecha, con
  granularidad de medio año entre 60 y 65 años: es lo que permite al motor aplicar la
  regla del Art. 171 LSS 1973 («Se aumentará un año a los cumplidos cuando la edad los
  exceda en seis meses»), que decide el tipo de pensión y el factor de reducción.
- **57 commits** de historia real, con mensajes convencionales.
- **17 suites de pruebas, 252 casos, todos en verde.**
- **Cobertura**: 89.1 % de sentencias, 96.1 % de funciones, 91.7 % de líneas, medida
  sobre `src/services/**`, `src/hooks/**` y `src/storage/**`.
- **12 ADRs, 8 specs, 8 runbooks** en `docs/`.
- **Deuda técnica del motor documentada** en [`docs/deuda-tecnica.md`](docs/deuda-tecnica.md):
  los huecos conocidos entre lo que calcula la app y lo que resuelve el IMSS (techo del
  100 % del salario promedio, fracción de los incrementos anuales, supuestos de la
  proyección de semanas, la convergencia del promedio con horizontes largos de Modalidad 10 y el porcentaje del
  Art. 171 aplicado sobre la cuantía básica en vez de sobre la vejez). No es trabajo
  pendiente de la iteración: es el inventario de lo que la app **no** hace, publicado para
  que quien compare su resultado con la respuesta oficial sepa dónde puede haber
  diferencia.
- **5 workflows de CI**: tipos y lint, pruebas fragmentadas en tres shards, cobertura,
  empaquetado web, CodeQL, release por etiqueta (que compila los instalables de Android e
  iOS y los adjunta al release), deploy a staging y **puerta de promoción** que exige
  aprobación humana antes de autorizar un release a producción.

## Lo que este proyecto no es

- **No es un gestor de trámites.** No habla con el IMSS, no tramita nada.
- **No es una fuente oficial.** Los resultados son estimaciones, y la app lo dice en cada
  pantalla y en cada PDF.
- **No es una app de banca ni de inversión.** No hay dinero, no hay pagos, no hay
  onboarding con terceros.
- **No es open source en el sentido de "con Issues aceptados".** El código es MIT y se
  publica para que sea auditable, no para recibir contribuciones.
