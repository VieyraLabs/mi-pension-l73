/**
 * Servicio de exportación de resultados de pensión a PDF.
 * Usa expo-print y expo-sharing para generar y compartir el PDF.
 *
 * EXCEPCIÓN DE TEMA (CHG-20261024-002 / US-008): el HTML que genera este
 * servicio usa colores hex fijos y NO los tokens de src/theme. El PDF es un
 * documento de impresión con diseño propio y estable: debe verse igual siempre
 * que se imprime o comparte, sin adaptarse al tema claro/oscuro de la app.
 * Cambiar sus colores es un cambio de diseño del documento, no del tema.
 * (Paleta sincronizada a mano con la de src/theme: esmeralda #059669,
 * ámbar #D97706 y neutros slate.)
 */
import * as Print from 'expo-print';
import { calculateM10MonthlyBreakdown } from '../../utils/modalidad10';
import { MODALIDAD_10_RISK_CLASS_LABELS } from '../../constants/ley73';
import { getMinimumDailySalary } from '../../constants/uma';
import * as Sharing from 'expo-sharing';
import type { PensionResult } from '../../models';
import { formatCurrency, formatPercent, formatDateLong, formatInteger, formatUMAs, formatWeeksTargetText, formatAge, getWeeksLabel } from '../../utils/format';

/**
 * Genera el contenido HTML del reporte de pensión.
 */
function generateHtml(result: PensionResult): string {
  const { input } = result;
  const calculationDate = new Date(result.calculationDate);

  // Semanas cotizadas: las actuales y las objetivo al jubilarse. La
  // proyección la produce el motor; el PDF muestra las mismas cifras y el
  // mismo texto que la pantalla, para que ambos no puedan divergir.
  // Las simulaciones guardadas antes de existir la proyección no la traen:
  // en ese caso se muestran las semanas cotizadas capturadas.
  const weeksProjection = result.weeksProjection;
  const currentWeeks = weeksProjection?.currentWeeks ?? input.workHistory.totalWeeks;
  const targetWeeksText = weeksProjection
    ? formatWeeksTargetText(weeksProjection, input.personalData.retirementAge)
    : `${formatInteger(currentWeeks)} sem.`;

  const m10 = input.modalidad10;
  const m10Breakdown = input.projectedAverageBreakdown;
  const m10Cost = calculateM10MonthlyBreakdown({
    dailySalary: m10.contributionSalary ?? 0,
    riskClass: m10.riskClass ?? 1,
    dailyUMA: input.uma.dailyUMA,
    minimumDailySalary: getMinimumDailySalary(input.uma, m10.salaryZone),
    year: input.uma.year,
  });
  const m10SummaryHtml = m10.active
    ? `
    <tr><td>Salario base declarado</td><td>${formatCurrency(m10.contributionSalary ?? 0)}/día</td></tr>
    <tr><td>Equivalente en UMAs</td><td>${formatUMAs(m10.contributionSalaryInUMAs ?? 0)} UMA</td></tr>
    <tr><td>Meses que planeas cotizar</td><td>${formatInteger(m10.expectedMonths ?? 0)} meses</td></tr>
    <tr><td>Costo mensual (sin INFONAVIT)</td><td>${formatCurrency(m10Cost.total)}/mes</td></tr>
    <tr><td>Tasa efectiva sobre el SBC declarado</td><td>${formatPercent(m10Cost.effectivePct * 100)}</td></tr>
    <tr><td>Prima de Riesgos de Trabajo (${MODALIDAD_10_RISK_CLASS_LABELS[m10Cost.riskClass]})</td><td>${formatCurrency(m10Cost.riesgosTrabajo)}/mes</td></tr>
    <tr><td>Cesantía y vejez (${m10Cost.cesantiaBandLabel}, ${formatPercent(m10Cost.cesantiaPct)})</td><td>${formatCurrency(m10Cost.cesantiaVejez)}/mes</td></tr>
    <tr><td>¿Sigues trabajando mientras citas?</td><td>${m10.continuesWorkingWhileContributing ?? true ? 'Sí' : 'No'}</td></tr>
    ${m10Breakdown && m10Breakdown.m10Weeks > 0
      ? `<tr><td>Semanas de Modalidad 10 (de las 250)</td><td>${formatInteger(m10Breakdown.m10Weeks)} sem.</td></tr>
    <tr><td>Semanas ordinarias (de las 250)</td><td>${formatInteger(m10Breakdown.ordinaryWeeks)} sem.</td></tr>
    <tr><td>Salario promedio de las 250 semanas</td><td>${formatCurrency(input.projectedAverageDailySalary ?? input.averageSalary.dailySalary)}/día</td></tr>`
      : ''}
  `
    : '';

  const stepsHtml = result.steps
    .map(
      (step) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; font-weight: bold;">${step.title}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; color: #555;">${step.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; font-weight: bold; color: #047857; text-align: right;">${formatCurrency(step.value)}</td>
    </tr>
    ${step.legalBasis ? `<tr><td colspan="3" style="padding: 2px 8px 8px; font-size: 10px; color: #888; font-style: italic;">📋 ${step.legalBasis}</td></tr>` : ''}
    ${step.isEstimate ? `<tr><td colspan="3" style="padding: 2px 8px 8px; font-size: 10px; color: #D97706;">⚠️ ESTIMACIÓN</td></tr>` : ''}
  `,
    )
    .join('');

  const warningsHtml = result.warnings
    .map((warning) => `<li style="margin-bottom: 8px; font-size: 11px; line-height: 1.5;">${warning}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte de Pensión IMSS Ley 73</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #0F172A; }
    h1 { color: #065F46; border-bottom: 3px solid #059669; padding-bottom: 8px; font-size: 20px; }
    h2 { color: #065F46; font-size: 16px; margin-top: 24px; }
    .estimacion-banner { background: #FEF3C7; border-left: 4px solid #D97706; padding: 12px; margin: 16px 0; border-radius: 4px; font-size: 12px; color: #92400E; }
    .resultado-principal { background: linear-gradient(135deg, #047857, #0F766E); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 16px 0; }
    .resultado-principal .monto { font-size: 32px; font-weight: bold; }
    .resultado-principal .label { font-size: 13px; opacity: 0.85; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0; }
    .sub-monto { background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center; }
    .sub-monto .valor { font-size: 18px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { background: #D1FAE5; color: #065F46; padding: 10px 8px; text-align: left; font-size: 12px; }
    .footer { margin-top: 32px; border-top: 2px solid #eee; padding-top: 12px; font-size: 10px; color: #64748B; }
    .chip { display: inline-block; background: #D1FAE5; color: #065F46; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin: 2px; }
  </style>
</head>
<body>
  <h1>🧮 Calculadora de Pensión IMSS Ley 73</h1>
  <p style="font-size: 12px; color: #55637A;">Generado el ${formatDateLong(calculationDate)} | Mi Pensión L73</p>

  <div class="estimacion-banner">
    ⚠️ <strong>AVISO LEGAL:</strong> Este reporte contiene ESTIMACIONES con fines informativos únicamente.
    La resolución oficial de la pensión corresponde exclusivamente al IMSS conforme a sus procedimientos institucionales.
  </div>

  <!-- Datos del asegurado -->
  <h2>Datos del asegurado</h2>
  <table>
    <tr><th>Campo</th><th>Valor</th></tr>
    ${input.personalData.name ? `<tr><td>Nombre</td><td>${input.personalData.name}</td></tr>` : ''}
    <tr><td>Edad de retiro</td><td>${formatAge(input.personalData.retirementAge)} años</td></tr>
    <tr><td>Tipo de pensión</td><td>${result.pensionType === 'vejez' ? 'Vejez (Art. 138 LSS 1973)' : 'Cesantía en Edad Avanzada (Art. 145 LSS 1973)'}</td></tr>
    <tr><td>Semanas cotizadas actuales</td><td>${formatInteger(currentWeeks)} sem.</td></tr>
    <tr><td>${getWeeksLabel(weeksProjection)}</td><td>${targetWeeksText}</td></tr>
    <tr><td>SBC actual (diario)</td><td>${formatCurrency(input.averageSalary.dailySalary)}</td></tr>
    <tr><td>SBC proyectado al retiro (diario)</td><td>${formatCurrency(input.projectedAverageDailySalary ?? input.averageSalary.dailySalary)}</td></tr>
    <tr><td>UMA utilizada</td><td>${formatCurrency(input.uma.dailyUMA)}/día (${input.uma.year}${input.uma.isCustom ? ', personalizada' : ''})</td></tr>
    ${input.modalidad10.active ? `<tr><td>Modalidad 10</td><td>Activa — &#36;${input.modalidad10.contributionSalary}/día</td></tr>` : ''}
    ${m10SummaryHtml}
  </table>

  <!-- Resultado principal -->
  <div class="resultado-principal">
    <div class="label">Pensión mensual estimada</div>
    <div class="monto">${formatCurrency(result.monthlyPension)}</div>
    <div class="grid-2" style="margin-top: 12px;">
      <div class="sub-monto">
        <div class="label">Anual</div>
        <div class="valor">${formatCurrency(result.annualPension)}</div>
      </div>
      <div class="sub-monto">
        <div class="label">Diario</div>
        <div class="valor">${formatCurrency(result.dailyAmount)}</div>
      </div>
    </div>
  </div>

  <!-- Indicadores -->
  <p>
    ${result.capApplied ? '<span class="chip">⚠️ Tope 25 UMA aplicado</span>' : ''}
    ${result.pmgApplied ? '<span class="chip">⚠️ PMG aplicada</span>' : ''}
    <span class="chip">Factor edad: ${formatPercent(result.ageFactor * 100)}</span>
  </p>

  <!-- Desglose del cálculo -->
  <h2>Desglose del cálculo (Ley 73)</h2>
  <table>
    <tr>
      <th>Paso</th>
      <th>Descripción</th>
      <th style="text-align: right;">Valor</th>
    </tr>
    ${stepsHtml}
  </table>

  <!-- Advertencias -->
  <h2>Notas y advertencias</h2>
  <ul style="padding-left: 16px; color: #92400E;">
    ${warningsHtml}
  </ul>

  <div class="footer">
    <p><strong>Mi Pensión L73</strong> — Calculadora de Pensión IMSS Ley 73</p>
    <p>Esta aplicación es solo para fines informativos. No constituye asesoría legal ni financiera.</p>
    <p>Para información oficial sobre tu pensión, visita imss.gob.mx o acude a la Subdelegación del IMSS de tu zona.</p>
    <p>Fuentes: Ley del Seguro Social de 1973 (DOF 12-mar-1973); Criterios operativos IMSS.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Genera el PDF del resultado de la pensión y lo abre para compartir.
 */
export async function exportPensionResultToPdf(result: PensionResult): Promise<void> {
  const html = generateHtml(result);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Compartir reporte de pensión',
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ uri });
  }
}
