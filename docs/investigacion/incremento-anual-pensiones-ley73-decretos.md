# Investigación — Incremento anual de pensiones Ley 73 (inflación) y tasa para la comparativa M10

Bitácora documental que acompaña a DEC-013 del project-spec: fijar la tasa anual de
incremento post-retiro que usará la comparativa "contratar Modalidad 10 vs pensionarse
lo antes posible".

**Regla de este documento:** se cita lo que se pudo verificar en fuente primaria; lo que
quedó pendiente se marca como tal, nunca como hecho.

> **Corrección (2026-10-31):** una versión anterior de esta nota asumió que las pensiones
> Ley 73 se incrementan en el mismo porcentaje que el salario mínimo general. **Eso es
> incorrecto.** El IMSS ajusta estas pensiones cada febrero conforme a la **inflación
> (INPC)** del año anterior, no conforme al salario mínimo. La serie correcta es la de la
> §3.

---

## 1. Objetivo

Determinar el valor de la constante versionada de incremento anual post-retiro. Criterio
acordado (DEC-013): **constante fija = promedio de los incrementos anuales de los últimos
5 años**, marcada como ESTIMACIÓN.

## 2. La regla

Las pensiones del régimen de la Ley 73 se incrementan **cada febrero**, en un porcentaje
ligado a la **inflación del año anterior** (INPC, INEGI). Esta es la práctica aplicada por
el IMSS para las pensiones en curso de pago del régimen anterior.

- El **incremento único del 11%** (Decreto DOF 20-dic-2001, reformado 5-ene-2004) es una
  regla distinta: se aplica una sola vez al calcular la cuantía inicial, y es la que el
  motor ya implementa en `src/services/pension/steps/DecreeIncrementStep.ts`
  (`DECREE_11_INCREMENT`).
- El **incremento anual post-retiro** (el que importa a la comparativa) es el ajuste por
  inflación de cada febrero, y **no** está modelado aún en el repo.

**Pendiente de verificación en fuente primaria:** confirmar la cita del fundamento exacto
que ordena el incremento anual por inflación (INPC) para pensiones en curso de pago del
régimen 73 (regla de desindexación y su régimen transitorio, DOF 27-ene-2016, y la
comunicación anual del IMSS), antes de publicar la constante.

## 3. La serie de los últimos 5 años

| Año de ajuste (febrero) | Inflación del año anterior (INPC) | Aumento aproximado de pensión |
|---|---|---|
| Febrero 2022 | 2021 | **+7.36%** |
| Febrero 2023 | 2022 | **+7.82%** |
| Febrero 2024 | 2023 | **+4.66%** |
| Febrero 2025 | 2024 | **+4.21%** |
| Febrero 2026 | 2025 | **+3.69%** |

**Promedio aritmético simple de los últimos 5 años** =
(7.36 + 7.82 + 4.66 + 4.21 + 3.69) / 5 = **≈ 5.55% anual**.

Fuente: serie aportada por el usuario; los valores 2021–2024 coinciden con la inflación
anual oficial del INPC (INEGI). El dato de 2025 queda **pendiente de confirmación** contra
el INPC publicado por INEGI.

## 4. Tasa propuesta para la constante

**≈ 5.55% anual**, marcada ESTIMACIÓN, con fuente y vigencia en `src/constants/` (según
runbook 05). Se aplica cada año (febrero) a las pensiones de **ambas** curvas de la
comparativa (DEC-012), en pesos nominales (DEC-009).

## 5. Supuestos y advertencias

- El promedio 5.55% es un supuesto de modelado a partir de la serie 2022–2026; **no** es
  una proyección neutral ni una garantía de los próximos años.
- El incremento se aplica anualmente, en febrero, con la inflación del año anterior.
- La comparativa es en **pesos nominales**: no se descuenta inflación (DEC-009).
- Pendiente: confirmar en fuente primaria (a) el fundamento del incremento anual por
  inflación y (b) el INPC de 2025.

## 6. Cómo se comprueba en el código (al implementar)

| Elemento | Dónde vivirá | Cómo se verifica |
| --- | --- | --- |
| Constante de incremento anual post-retiro (≈5.55%, ESTIMACIÓN) | `src/constants/` (nueva constante versionada con fuente + vigencia) | test unitario que valide fuente/vigencia y valor |
| Aplicación anual a ambas curvas | función pura del motor de comparativa | test unitario de la serie acumulada |
| Promedio de 5 años documentado | este archivo + DEC-013 | revisión manual |
