/**
 * Pantalla de resultado de la simulación de pensión.
 * Muestra el resumen, resultado principal y desglose detallado.
 */
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, Divider, useTheme, Chip, List } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useHistory } from '../hooks/useHistory';
import { exportPensionResultToPdf } from '../services/export/pdfExport';
import {
  formatCurrency,
  formatPercent,
  formatInteger,
  formatUMAs,
  formatWeeksTargetText,
  formatAge,
  formatDateLong,
  getWeeksLabel,
} from '../utils/format';
import { showAlert } from '../utils/alert';
import { m10MonthlyCostFromInput } from '../utils/modalidad10';
import { MODALIDAD_10_RISK_CLASS_LABELS } from '../constants/ley73';
import { normalizeLocalCalendarDate } from '../utils/weeksProjection';
import { BUTTON_RADIUS, getBannerColors, getBrandGradient, BRAND_ON_COLOR } from '../theme';
import { EstimationDisclaimerCard } from '../components/EstimationDisclaimerCard';
import { EmptyState } from '../components/EmptyState';
import { SummaryRow } from '../components/SummaryRow';
import type { PensionResult } from '../models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ResultScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { simulations } = useHistory();
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Obtener simulación específica del route params o la más reciente
  const simulationId = (route.params as { simulationId?: string })?.simulationId;
  const selectedSimulation = simulations.find((s) => s.id === simulationId);
  const result: PensionResult | undefined = selectedSimulation?.result;

  if (!result) {
    return (
      <EmptyState
        mensaje="No hay resultado disponible."
        textoBoton="Volver"
        onPressBoton={() => navigation.goBack()}
      />
    );
  }

  const warningColors = getBannerColors('warning', theme.dark);
  const successColors = getBannerColors('success', theme.dark);
  const infoColors = getBannerColors('info', theme.dark);

  // Semanas cotizadas: las que ya están cotizadas y las que se tendrá al
  // jubilarse. La proyección la produce el motor (`weeksProjection`); aquí
  // solo se muestra, con el mismo texto y el mismo formato que usan el PDF y
  // el historial, para que el resumen y el desglose no puedan contradecirse.
  // Las simulaciones guardadas antes de existir la proyección no la traen: en
  // ese caso se muestran las semanas cotizadas capturadas.
  const weeksProjection = result.weeksProjection;
  const retirementDate = normalizeLocalCalendarDate(
    new Date(result.input.personalData.estimatedRetirementDate as unknown as string),
  );
  const currentWeeks = weeksProjection?.currentWeeks ?? result.input.workHistory.totalWeeks;
  const targetWeeksText = weeksProjection
    ? formatWeeksTargetText(weeksProjection, result.input.personalData.retirementAge)
    : `${formatInteger(currentWeeks)} sem.`;

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportPensionResultToPdf(result);
    } catch (error) {
      console.error('[ResultScreen] Error al generar el PDF:', error);
      showAlert('Error', 'No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <EstimationDisclaimerCard />

      {/* Resultado principal — la cifra es lo primero que el usuario busca */}
      <LinearGradient
        colors={getBrandGradient(theme.dark)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mainResultCard}
      >
        <Text variant="titleSmall" style={{ color: BRAND_ON_COLOR, opacity: 0.85 }}>
          Pensión mensual estimada
        </Text>
        <Text variant="displaySmall" style={{ color: BRAND_ON_COLOR, fontWeight: 'bold', marginVertical: 8 }}>
          {formatCurrency(result.monthlyPension)}
        </Text>
        <View style={styles.subResults}>
          <View style={styles.subResult}>
            <Text variant="labelSmall" style={{ color: BRAND_ON_COLOR, opacity: 0.85 }}>Anual</Text>
            <Text variant="titleSmall" style={{ color: BRAND_ON_COLOR, fontWeight: 'bold' }}>
              {formatCurrency(result.annualPension)}
            </Text>
          </View>
          <View style={[styles.subResultDivider, { backgroundColor: BRAND_ON_COLOR }]} />
          <View style={styles.subResult}>
            <Text variant="labelSmall" style={{ color: BRAND_ON_COLOR, opacity: 0.85 }}>Diario</Text>
            <Text variant="titleSmall" style={{ color: BRAND_ON_COLOR, fontWeight: 'bold' }}>
              {formatCurrency(result.dailyAmount)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Indicadores clave */}
      <View style={styles.chipsRow}>
        {result.capApplied && (
          <Chip
            icon="alert"
            compact
            style={{ backgroundColor: warningColors.background }}
            textStyle={{ color: warningColors.text }}
          >
            Tope 25 UMA
         </Chip>
        )}
        {result.pmgApplied && (
          <Chip
            icon="alert"
            compact
            style={{ backgroundColor: warningColors.background }}
            textStyle={{ color: warningColors.text }}
          >
            PMG aplicada
         </Chip>
        )}
        {result.input.modalidad10.active && (
          <Chip
            icon="check"
            compact
            style={{ backgroundColor: successColors.background }}
            textStyle={{ color: successColors.text }}
          >
            Modalidad 10
         </Chip>
        )}
        <Chip
          icon="information"
          compact
          style={{ backgroundColor: infoColors.background }}
          textStyle={{ color: infoColors.text }}
        >
          Factor edad: {formatPercent(result.ageFactor * 100)}
        </Chip>
      </View>

      {/* Resumen */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Title title="Resumen" titleVariant="titleMedium" />
        <Divider />
        <Card.Content style={{ paddingTop: 12 }}>
          {result.input.personalData.name && (
            <SummaryRow label="Nombre" value={result.input.personalData.name} theme={theme} />
          )}
          <SummaryRow label="Fecha de retiro" value={formatDateLong(retirementDate)} theme={theme} />
          <SummaryRow label="Edad de retiro" value={`${formatAge(result.input.personalData.retirementAge)} años`} theme={theme} />
          <SummaryRow label="Tipo de pensión" value={result.pensionType === 'vejez' ? 'Vejez (Art. 138)' : 'Cesantía Edad Avanzada (Art. 145)'} theme={theme} />
          <SummaryRow label="Semanas cotizadas actuales" value={`${formatInteger(currentWeeks)} sem.`} theme={theme} />
          <SummaryRow label={getWeeksLabel(weeksProjection)} value={targetWeeksText} theme={theme} />
          <SummaryRow label="SBC actual (diario)" value={formatCurrency(result.input.averageSalary.dailySalary)} theme={theme} />
          <SummaryRow label="SBC proyectado al retiro (diario)" value={formatCurrency(result.input.projectedAverageDailySalary ?? result.input.averageSalary.dailySalary)} theme={theme} />
          <SummaryRow label="UMA utilizada" value={`$${result.input.uma.dailyUMA}/día (${result.input.uma.year}${result.input.uma.isCustom ? ', personalizada' : ''})`} theme={theme} />
          {result.input.modalidad10.active && (() => {
            const m10 = result.input.modalidad10;
            const breakdown = result.input.projectedAverageBreakdown;
            const riskClass = m10.riskClass ?? 1;
            const costBreakdown = m10MonthlyCostFromInput(m10, result.input.uma);
            return (
              <View style={[styles.m10Block, { borderTopColor: theme.colors.outlineVariant }]}>
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.primary, marginBottom: 6 }}
                >
                  Modalidad 10
                </Text>
                <SummaryRow
                  label="Salario base declarado"
                  value={`${formatCurrency(m10.contributionSalary ?? 0)}/día`}
                  theme={theme}
                />
                <SummaryRow
                  label="Equivalente en UMAs"
                  value={`${formatUMAs(m10.contributionSalaryInUMAs ?? 0)} UMA`}
                  theme={theme}
                />
                <SummaryRow
                  label="Meses que planeas cotizar"
                  value={`${m10.expectedMonths ?? 0} meses`}
                  theme={theme}
                />
                <SummaryRow
                  label="Costo mensual (sin INFONAVIT)"
                  value={`${formatCurrency(costBreakdown.total)}/mes`}
                  theme={theme}
                />
                <SummaryRow
                  label="Tasa efectiva sobre el SBC declarado"
                  value={formatPercent(costBreakdown.effectivePct * 100)}
                  theme={theme}
                />
                <SummaryRow
                  label={`Prima de Riesgos de Trabajo (${MODALIDAD_10_RISK_CLASS_LABELS[riskClass]})`}
                  value={`${formatCurrency(costBreakdown.riesgosTrabajo)}/mes`}
                  theme={theme}
                />
                <SummaryRow
                  label="¿Sigues trabajando mientras citas?"
                  value={m10.continuesWorkingWhileContributing ?? true ? 'Sí' : 'No'}
                  theme={theme}
                />
                {breakdown && breakdown.m10Weeks > 0 && (
                  <>
                    <SummaryRow
                      label="Semanas de Modalidad 10 (de las 250)"
                      value={`${formatInteger(breakdown.m10Weeks)} sem.`}
                      theme={theme}
                    />
                    <SummaryRow
                      label="Semanas ordinarias (de las 250)"
                      value={`${formatInteger(breakdown.ordinaryWeeks)} sem.`}
                      theme={theme}
                    />
                    <SummaryRow
                      label="Salario promedio de las 250 semanas"
                      value={`${formatCurrency(result.input.projectedAverageDailySalary ?? result.input.averageSalary.dailySalary)}/día`}
                      theme={theme}
                    />
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, fontStyle: 'italic' }}
                    >
                      Promedio = (SBC ordinario × semanas ordinarias + SBC M10 × semanas M10) ÷ {breakdown.totalWeeks}
                    </Text>
                  </>
                )}
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}
                >
                  Los meses de Modalidad 10 se cotizan al salario declarado y entran al promedio
                  de las últimas 250 semanas cotizadas (Art. 167 LSS 1973).
                </Text>
              </View>
            );
          })()}
        </Card.Content>
      </Card>

      {/* Desglose detallado — List.Accordion: táctil completo y accesible */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <List.Accordion
          title="Desglose del cálculo"
          titleStyle={{ fontWeight: 'bold', color: theme.colors.onSurface }}
          expanded={breakdownExpanded}
          onPress={() => setBreakdownExpanded(!breakdownExpanded)}
        >
          {result.steps.map((step) => (
            <View key={step.id} style={[styles.breakdownItem, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={styles.breakdownContent}>
                <Text variant="bodyMedium" style={styles.breakdownTitle}>
                  {step.title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, width: '100%', fontSize: 11, lineHeight: 16 }}>
                  {step.description}
                  {step.legalBasis && <Text style={{ color: theme.colors.primary }}> 📋 {step.legalBasis}</Text>}
                  {step.isEstimate && <Text style={{ color: theme.colors.secondary }}> ⚠️ ESTIMACIÓN</Text>}
                </Text>
              </View>
              <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 13, alignSelf: 'center' }}>
                {formatCurrency(step.value)}
              </Text>
            </View>
          ))}
        </List.Accordion>
      </Card>

      {/* Advertencias */}
      {result.warnings.length > 0 && (
        <Card style={[styles.card, { backgroundColor: warningColors.background }]} elevation={0}>
          <Card.Title title="Notas y advertencias" titleVariant="titleSmall" />
          <Card.Content>
            {result.warnings.map((warning, i) => (
              <Text key={i} variant="bodySmall" style={{ color: warningColors.text, marginBottom: 8, lineHeight: 18 }}>
                • {warning}
              </Text>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Acciones — la primaria arriba, sin riesgo de quedar fuera de pantalla */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="file-pdf-box"
          onPress={exportPdf}
          loading={exporting}
          style={styles.primaryAction}
          contentStyle={{ paddingVertical: 6 }}
        >
          Exportar PDF
        </Button>
        <View style={styles.secondaryActions}>
          <Button
            mode="outlined"
            icon="home"
            onPress={() => navigation.popToTop()}
            style={styles.actionBtn}
          >
            Ir al inicio
          </Button>
          <Button
            mode="outlined"
            icon="compare-horizontal"
            onPress={() => navigation.navigate('Comparison', { simulationId })}
            style={styles.actionBtn}
          >
            Comparar
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, marginBottom: 16 },
  m10Block: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  mainResultCard: {
    borderRadius: 20,
    marginBottom: 16,
    padding: 24,
    alignItems: 'center',
  },
  subResults: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', marginTop: 8 },
  subResult: { alignItems: 'center' },
  subResultDivider: { width: 1, height: 28, opacity: 0.3 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  actions: { gap: 12, marginBottom: 20 },
  primaryAction: { borderRadius: BUTTON_RADIUS },
  secondaryActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, borderRadius: BUTTON_RADIUS },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  breakdownContent: { flex: 1 },
  breakdownTitle: { fontWeight: 'bold', fontSize: 13, marginBottom: 4, width: '100%' },
});
