# ADR-0015 — Calcular la cuota de la Modalidad 10 con la estructura de financiamiento oficial del IMSS

- **Estado**: Aceptada
- **Fecha**: 2026-10-30
- **Ámbito**: `src/constants/modalidad10Cuota.ts`, `src/constants/ley73.ts`, `src/utils/modalidad10.ts`, `src/components/Modalidad10Step.tsx`, `src/screens/ResultScreen.tsx`, `src/services/export/pdfExport.ts`

## Contexto

El paso 4 de la Modalidad 10 muestra, en solo lectura, cuánto cuesta cotizar cada mes con el
SBC declarado. Ese costo se calculaba con **una constante plana**: `MODALIDAD_10_BASE_CUOTA_PCT
= 0.183` (18.30 % del SBC) más la prima de Riesgos de Trabajo de la clase. La constante estaba
marcada como ESTIMACIÓN y la interfaz la interfaz presentaba como "costo mensual estimado".

El 18.30 % venía de fuentes secundarias y de la calculadora pública del IMSS, no de un texto
primario. La interfaz no decía de dónde salía el número, y el número no explicaba por qué
cambia: el mismo SBC costaba una cantidad fija, cuando en el régimen real la cuota tiene ramas
que dependen del nivel salarial (cuota excedente sobre 3 UMA, tabla de cesantía y vejez por
bandas) y de la clase de riesgo.

La fuente primaria sí existe, y es pública:

- La **calculadora oficial del IMSS para Personas Trabajadoras Independientes** (Modalidad 10,
  versión de marzo de 2026) implementa la fórmula completa rama por rama en su script
  `calculadoraPTI-0326.js`.
- El **Anexo A del Informe al Consejo Técnico del IMSS 2025-2026**, Cuadro A.3 "Esquema de
  financiamiento por tipo de seguro, diciembre de 2025", publica las tasas por ramo y la
  tabla de cesantía y vejez.

## Decisión

**Calcular la cuota de la Modalidad 10 con la estructura de financiamiento oficial del
IMSS, rama por rama, dejando fuera la aportación a INFONAVIT.**

- **Una constante por rama, con su fuente.** `src/constants/modalidad10Cuota.ts` guarda las
  tasas de cada ramo (cuota fija de SEM, cuota excedente sobre 3 UMA, prestaciones en dinero,
  gastos médicos para pensionados, Invalidez y Vida, Guarderías y Prestaciones Sociales,
  Retiro, cesantía y vejez) y la tabla de bandas de cesantía y vejez por año.
- **La tabla de cesantía y vejez tiene columna por año** (2022 a 2030), porque su tasa sube
  con el nivel salarial y se actualiza con el tiempo; la app usa la columna del año de la UMA
  vigente. Para los años anteriores a 2022 usa la columna de 2022, la más antigua publicada.
- **La persona asegurada paga las dos partes de cada ramo** (patronal y obrera), porque en
  la Modalidad 10 no hay patrón: la cotización es "obrero patronal" a cargo de la propia
  persona (Art. 227 LSS vigente).
- **INFONAVIT queda fuera.** Es ahorro para vivienda, no una prima de financiamiento, y el
  Art. 228 LSS vigente ordena reducir la parte proporcional de las prestaciones excluidas.
  El 5 % del SBC que el portal del IMSS publica por separado se documenta, no se suma.
- **La prima de Riesgos de Trabajo sigue viniendo de la clase I–V** (Art. 71 LSS vigente).
  Lo que cambia no es su tabla, sino que ahora el total se arma con la estructura real y la
  prima se suma como una de sus ramas, no como un añadido a una cuota plana.
- **La interfaz muestra el total, la tasa efectiva sobre el SBC y la prima de RT**, con el
  texto auxiliar que declara la fuente de la estructura y que la clase de riesgo se estima
  con el catálogo de ocupaciones.

## Validación contra un caso real

La fórmula se comprobó contra un **costo real observado**: la línea de captura de una
Modalidad 10 con el SBC tope de 25 UMA, clase de riesgo III y un periodo de 30 días, que
era de **$18,584 al mes**. La fórmula reproducida da **$18,584.02** para ese mismo
periodo: coincide al peso, con lo que quedan validados a la vez las tasas por ramo, la
banda de cesantía y vejez (7.513 % en 2026), el excedente sobre 3 UMA y la prima de
Riesgos de Trabajo.

Ese caso también explica por qué la app muestra un poco más: la app usa 30.4 días por
mes (su convención para el SBC mensual) y la línea de captura usa los días reales del
periodo. Con 30.4 días la cuota es $18,831.81, un 1.3 % por encima del periodo de 30
días. La diferencia está declarada, no oculta.

## Consecuencias

### Positivas

- El costo que ve la persona sale de la fórmula que el propio IMSS aplica, no de un
  porcentaje plano sin un origen verificable. La cifra cambia con el nivel salarial y con la clase de riesgo,
  como en el IMSS.
- La cuota queda auditable rama por rama: el desglose del PDF y de la pantalla muestran las
  mismas sumas que el motor usa (ADR-0006).
- La diferencia con la línea de captura oficial queda acotada y declarada: la calculadora
  oficial multiplica por los días reales del mes y la app usa 30.4 (su convención para el
  SBC mensual).

### Costes

- **La tasa efectiva es mayor que el 18.30 % plano en los salaries altos**: con 25 UMA y
  clase I la cuota ronda el 19.07 % del SBC, y con clase III el 21.12 %. Quien comparaba con
  la cifra anterior verá un número mayor; es la cifra correcta.
- **La banda de cesantía y vejez es un supuesto de la LSS vigente**, no de la Ley 73: la
  app calcula la pensión por la Ley 73 (Arts. 167 y ss.) y cotiza la Modalidad 10 con el
  esquema de financiamiento vigente. Es una mezcla declarada, no un error.
- Lo que la persona tiene que acertar es **qué grupo del catálogo de ocupaciones le
  corresponde**: el catálogo es oficial y su clase ya no se aproxima
  ([ADR-0016](0016-catalogo-oficial-de-ocupaciones-de-la-modalidad-10.md)).

## Alternativas descartadas

- **Mantener el 18.30 % plano.** Se descartó: no tiene fuente primaria, no explica cómo
  cambia la cuota y no permite auditar el monto.
- **Sumar el 5 % de INFONAVIT a la cuota.** Se descartó: es ahorro para vivienda y el
  Art. 228 LSS vigente ordena excluirlo de la cuota de financiamiento.
- **Calcular la cuota solo con el Art. 168 de la LSS vigente y sin el resto de los ramos.**
  Se descartó: dejaría fuera invalidez, vejez, guarderías y riesgos de trabajo, que son
  prestaciones que la Modalidad 10 sí cubre.
- **Usar la tasa efectiva del Cuadro A.4 (24.92 %).** Se descartó: es un promedio ponderado
  de toda la masa asalariada del IMSS, no la tasa de un independiente.

## Relación con las specs

- [Spec-06](../spec/06-captura-y-validacion-de-datos.md): el campo de costo mensual del paso 4.
- [Spec-09](../spec/09-alcance-de-la-estimacion-y-aviso-legal.md): qué queda declarado como
  estimación.
- [ADR-0014](0014-modalidad-10-incorporacion-voluntaria-al-régimen-obligatorio.md): la
  decisión de usar la Modalidad 10.
- [Investigación: Modalidad 10](../investigacion/modalidad-10-incorporacion-voluntaria.md): las
  citas textuales de las fuentes primarias.
