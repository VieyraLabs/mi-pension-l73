/**
 * Pantalla de comparativa «Contratar Modalidad 10 vs Pensionarse lo antes
 * posible». Muestra la gráfica de tiempo (años) vs costo acumulado (pesos),
 * el punto de equilibrio, un control de horizonte y una tabla que explica las
 * cifras. La tabla es la fuente de verdad: si la gráfica no monta (p. ej. en
 * web o en un runner sin SVG), la pantalla degrada con gracia y solo muestra
 * la tabla con un aviso.
 */
import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Card, Divider, Icon, IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import type { MD3Theme } from 'react-native-paper';
import { useHistory } from '../hooks/useHistory';
import {
  calculateComparison,
  COMPARISON_POST_BREAKEVEN_YEARS,
  getMaxHorizonYears,
} from '../services/pension/comparison/comparisonCalculator';
import type { ComparisonResult, ComparisonScenario } from '../services/pension/comparison/types';
import { EstimationDisclaimerCard } from '../components/EstimationDisclaimerCard';
import { EmptyState } from '../components/EmptyState';
import { SummaryRow } from '../components/SummaryRow';
import { formatCompactCurrency, formatCurrency, formatInteger, formatYearsMonths } from '../utils/format';
import { BUTTON_RADIUS } from '../theme';
import { CHART_HEIGHT, CHART_PADDING_RIGHT, ChartBoundary, ChartTouchOverlay, withAlpha, yearLabel } from '../components/ComparisonChartPrimitives';

/** Línea principal del punto de equilibrio: tiempo desde pensionarse «antes». */
function breakEvenHeadline(comparison: ComparisonResult): string {
  const b = comparison.breakEven;
  if (!b) {
    return `No se alcanza en ${formatInteger(comparison.horizonMonths / 12)} años`;
  }
  return `En ${formatYearsMonths(b.monthsAfterEarlyRetirement)} de que se hubiera pensionado lo antes posible.`;
}

/** Línea secundaria: edad aproximada y año calendario (null si no hay equilibrio). */
function breakEvenAgeLine(comparison: ComparisonResult): string | null {
  const b = comparison.breakEven;
  if (!b) return null;
  const ageMonths = Math.round(b.age * 12);
  return `~${formatYearsMonths(ageMonths)} de edad (${b.year})`;
}

function ChartSection({
  comparison,
  theme,
}: {
  comparison: ComparisonResult;
  theme: MD3Theme;
}) {
  const { width } = useWindowDimensions();
  const [plotWidth, setPlotWidth] = useState(0);

  const monthCount = comparison.horizonMonths + 1;
  const breakEvenMonth = comparison.breakEven?.monthIndex ?? null;

  // Por defecto se selecciona la columna del punto de equilibrio (o el mes 0).
  const defaultSelectedMonth = breakEvenMonth ?? 0;
  // Por defecto la ventana arranca en el año 0 y muestra apenas 3 años tras el
  // punto de equilibrio (o todo el horizonte si no hay equilibrio).
  const defaultVisibleMonths =
    breakEvenMonth != null
      ? Math.min(monthCount, breakEvenMonth + COMPARISON_POST_BREAKEVEN_YEARS * 12 + 1)
      : monthCount;

  const [selectedMonth, setSelectedMonth] = useState(defaultSelectedMonth);
  const [visibleMonths, setVisibleMonths] = useState(defaultVisibleMonths);
  const [start, setStart] = useState(0);

  // Ancho fijo de la gráfica (los ejes no se mueven al hacer zoom).
  const containerWidth = plotWidth > 0 ? plotWidth : Math.max(0, width - 64);
  const chartWidth = containerWidth;

  // Ventana visible: arranca en `start` y muestra `visibleMonths` meses.
  // El zoom cambia `visibleMonths`; el pan cambia `start`.
  const MIN_VISIBLE_MONTHS = 12;
  const visibleCount = Math.max(MIN_VISIBLE_MONTHS, Math.min(monthCount, visibleMonths));
  const maxStart = Math.max(0, monthCount - visibleCount);
  const clampedStart = Math.max(0, Math.min(start, maxStart));
  const end = clampedStart + visibleCount - 1;

  const windowMonths = comparison.m10Scenario.series.slice(clampedStart, end + 1);
  const monthlyM10 = windowMonths.map((p) => p.cumulativeNet);
  const monthlyEarly = comparison.earlyScenario.series.slice(clampedStart, end + 1).map((p) => p.cumulativeNet);
  // Etiquetas del eje X: solo años enteros (mes 0, 12, 24…); el resto va vacío.
  const labels = windowMonths.map((p) => (p.monthIndex % 12 === 0 ? yearLabel(p.monthIndex) : ''));
  // Puntos visibles solo en cada año; los meses intermedios alimentan la línea
  // pero no muestran su punto.
  const hidePointsAtIndex = windowMonths
    .map((_, i) => i)
    .filter((i) => (clampedStart + i) % 12 !== 0);
  const data = {
    labels,
    datasets: [
      {
        data: monthlyM10,
        color: (opacity = 1) => withAlpha(theme.colors.primary, opacity),
        strokeWidth: 2,
      },
      {
        data: monthlyEarly,
        color: (opacity = 1) => withAlpha(theme.colors.onSurface, opacity),
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 2,
    color: (opacity = 1) => withAlpha(theme.colors.onSurfaceVariant, opacity),
    labelColor: () => theme.colors.onSurface,
    // Puntos atenuados: pequeños y semitransparentes para no tapar la línea.
    propsForDots: { r: '2.5', fillOpacity: 0.4 },
  };

  const handleSelect = (colIndex: number) => {
    setSelectedMonth(clampedStart + colIndex);
  };

  const m10Value = comparison.m10Scenario.series[selectedMonth]!.cumulativeNet;
  const earlyValue = comparison.earlyScenario.series[selectedMonth]!.cumulativeNet;
  const difference = m10Value - earlyValue;

  // Color de la diferencia: verde si «contratar M10» supera a «pensionarse
  // antes», rojo si queda por debajo, neutro si empatan.
  const differenceColor =
    difference > 0
      ? theme.colors.primary
      : difference < 0
        ? theme.colors.error
        : theme.colors.onSurface;

  // Posición X de la línea vertical de selección (misma geometría que el overlay).
  const columnStep = (chartWidth - CHART_PADDING_RIGHT) / visibleCount;
  const selectedLineX =
    selectedMonth >= clampedStart && selectedMonth <= end
      ? CHART_PADDING_RIGHT + (selectedMonth - clampedStart) * columnStep
      : null;

  // Refs con valores frescos para que el PanResponder (creado una sola vez)
  // lea siempre el estado actual sin re-crearse en cada render.
  const chartWidthRef = useRef(chartWidth);
  chartWidthRef.current = chartWidth;
  const visibleCountRef = useRef(visibleCount);
  visibleCountRef.current = visibleCount;
  const maxStartRef = useRef(maxStart);
  maxStartRef.current = maxStart;
  const startRef = useRef(clampedStart);
  startRef.current = clampedStart;
  const gestureStartRef = useRef(clampedStart);

  const panResponder = useRef(
    PanResponder.create({
      // Solo roba gestos horizontales: deja pasar el scroll vertical de la
      // pantalla y los taps de las columnas (Pressable).
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        gestureStartRef.current = startRef.current;
      },
      onPanResponderMove: (_evt, g) => {
        const monthPx =
          (chartWidthRef.current - CHART_PADDING_RIGHT) / visibleCountRef.current;
        const delta = Math.round(g.dx / monthPx);
        setStart(
          Math.max(0, Math.min(maxStartRef.current, gestureStartRef.current - delta)),
        );
      },
    }),
  ).current;

  const zoomIn = () => setVisibleMonths((m) => Math.max(MIN_VISIBLE_MONTHS, Math.round(m / 2)));
  const zoomOut = () => setVisibleMonths((m) => Math.min(monthCount, m * 2));
  const panLeft = () =>
    setStart((s) => Math.max(0, s - Math.max(12, Math.round(visibleCount / 2))));
  const panRight = () =>
    setStart((s) => Math.min(maxStart, s + Math.max(12, Math.round(visibleCount / 2))));

  // Factor de zoom mostrado: cuánto del horizonte total se está viendo.
  const zoomFactor = Math.max(1, monthCount / visibleCount);

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <Card.Title title="Flujo acumulado" titleVariant="titleMedium" />
      <Divider />
      <Card.Content style={{ paddingTop: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: theme.colors.primaryContainer,
          }}
        >
          <Icon source="flag-checkered" size={22} color={theme.colors.onPrimaryContainer} />
          <View style={{ flex: 1 }}>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onPrimaryContainer, opacity: 0.75 }}
            >
              Punto de equilibrio
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}
            >
              {breakEvenHeadline(comparison)}
            </Text>
            {breakEvenAgeLine(comparison) != null && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onPrimaryContainer, opacity: 0.75 }}
              >
                {breakEvenAgeLine(comparison)}
              </Text>
            )}
          </View>
        </View>

        <View onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}>
          <ChartBoundary>
            <View
              {...panResponder.panHandlers}
              style={{ position: 'relative', width: chartWidth, height: CHART_HEIGHT, overflow: 'hidden' }}
            >
              <LineChart
                data={data}
                width={chartWidth}
                height={CHART_HEIGHT}
                chartConfig={chartConfig}
                fromZero
                withShadow={false}
                yLabelsOffset={0}
                formatYLabel={(value) => formatCompactCurrency(Number(value))}
                hidePointsAtIndex={hidePointsAtIndex}
                style={{ borderRadius: 16 }}
              />
              {selectedLineX != null && (
                <View
                  pointerEvents="none"
                  testID="chart-selection-line"
                  style={{
                    position: 'absolute',
                    left: selectedLineX - 0.5,
                    top: 0,
                    width: 1,
                    height: CHART_HEIGHT,
                    backgroundColor: theme.colors.outline,
                  }}
                />
              )}
              {chartWidth > 0 && (
                <ChartTouchOverlay
                  count={visibleCount}
                  width={chartWidth}
                  startMonth={clampedStart}
                  onSelect={handleSelect}
                />
              )}
            </View>
          </ChartBoundary>
        </View>

        <Text
          variant="labelSmall"
          style={{ alignSelf: 'center', marginTop: 2, color: theme.colors.onSurfaceVariant }}
        >
          Años
        </Text>

        <Legend scenario={comparison.m10Scenario} color={theme.colors.primary} />
        <Legend scenario={comparison.earlyScenario} color={theme.colors.onSurface} />

        <View style={styles.zoomRow}>
          <IconButton
            icon="chevron-left"
            size={20}
            onPress={panLeft}
            disabled={clampedStart <= 0}
            accessibilityLabel="Desplazar a la izquierda"
            testID="chart-pan-left"
          />
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Zoom
          </Text>
          <IconButton
            icon="minus"
            size={20}
            onPress={zoomOut}
            disabled={visibleCount >= monthCount}
            accessibilityLabel="Alejar"
            testID="chart-zoom-out"
          />
          <Text variant="labelSmall" style={{ color: theme.colors.onSurface }}>
            ×{zoomFactor.toFixed(1)}
          </Text>
          <IconButton
            icon="plus"
            size={20}
            onPress={zoomIn}
            disabled={visibleCount <= MIN_VISIBLE_MONTHS}
            accessibilityLabel="Acercar"
            testID="chart-zoom-in"
          />
          <IconButton
            icon="chevron-right"
            size={20}
            onPress={panRight}
            disabled={clampedStart >= maxStart}
            accessibilityLabel="Desplazar a la derecha"
            testID="chart-pan-right"
          />
        </View>

        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          Toca un punto en la gráfica para ver el detalle de ese mes.
        </Text>

        <View
          style={{
            marginTop: 4,
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: theme.colors.surfaceVariant,
          }}
        >
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 2 }}
          >
            Mes seleccionado
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
            En {formatYearsMonths(selectedMonth)}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 2 }}
          >
            Flujo acumulado a esa fecha (pensión − cuotas)
          </Text>
          <DetailRow
            theme={theme}
            label="Al contratar Modalidad 10"
            value={formatCurrency(m10Value)}
          />
          <DetailRow
            theme={theme}
            label="Al pensionarte lo antes posible"
            value={formatCurrency(earlyValue)}
          />
          <DetailRow
            theme={theme}
            label="Ganancia neta por contratar M10"
            value={formatCurrency(difference)}
            valueColor={differenceColor}
          />
        </View>

      </Card.Content>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  theme,
  valueColor,
}: {
  label: string;
  value: string;
  theme: MD3Theme;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          color: valueColor ?? theme.colors.onSurface,
          fontWeight: '600',
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Legend({ scenario, color }: { scenario: ComparisonScenario; color: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="bodySmall" style={{ flex: 1 }}>
        {scenario.label}
      </Text>
    </View>
  );
}

function TableSection({
  comparison,
  theme,
}: {
  comparison: ComparisonResult;
  theme: MD3Theme;
}) {
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <Card.Title title="Resumen de la comparativa" titleVariant="titleMedium" />
      <Divider />
      <Card.Content style={{ paddingTop: 12 }}>
        <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
          Costos de la Modalidad 10
        </Text>
        <SummaryRow label="Costo total de la Modalidad 10" value={formatCurrency(comparison.totalM10Cost)} theme={theme} muted labelFlex={2} valueFlex={1} />
        <SummaryRow label="Pensión no percibida (por contratar M10)" value={formatCurrency(comparison.forgonePension)} theme={theme} muted labelFlex={2} valueFlex={1} />
        <Divider style={[styles.totalDivider, { alignSelf: 'flex-end', width: '33%' }]} />
        <SummaryRow
          label="Costo real de la Modalidad 10"
          value={formatCurrency(comparison.totalM10Cost + comparison.forgonePension)}
          theme={theme}
          emphasized
          labelFlex={2}
          valueFlex={1}
        />

        <Divider style={styles.summaryDivider} />

        <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
          Pensión mensual
        </Text>
        <SummaryRow
          label="Pensión mensual (Con M10)"
          value={formatCurrency(comparison.m10MonthlyPension)}
          theme={theme}
        />
        <SummaryRow
          label="Pensión mensual (Sin M10)"
          value={formatCurrency(comparison.earlyMonthlyPension)}
          theme={theme}
        />

        <Divider style={styles.summaryDivider} />

        <View style={styles.sectionHeaderRow}>
          <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
            ¿En qué momento conviene?
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            (el punto de equilibrio)
          </Text>
        </View>
        <View style={styles.breakEvenBlock}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
            {breakEvenHeadline(comparison)}
          </Text>
          {breakEvenAgeLine(comparison) != null && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {breakEvenAgeLine(comparison)}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

export default function ComparisonScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { simulations } = useHistory();

  const simulationId = (route.params as { simulationId?: string })?.simulationId;
  const selectedSimulation = simulations.find((s) => s.id === simulationId);
  const result = selectedSimulation?.result;

  // La proyección es siempre hasta los 90 años de edad de la persona.
  const horizon = result ? getMaxHorizonYears(result) : 1;

  const comparison = useMemo(
    () => (result ? calculateComparison(result, horizon) : null),
    [result, horizon],
  );

  if (!result || !comparison) {
    return (
      <EmptyState
        mensaje="No hay resultado disponible para comparar."
        textoBoton="Volver"
        onPressBoton={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <EstimationDisclaimerCard />

      <ChartSection comparison={comparison} theme={theme} />

      <TableSection comparison={comparison} theme={theme} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: BUTTON_RADIUS, marginBottom: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sectionLabel: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, marginBottom: 2 },
  summaryDivider: { marginVertical: 12 },
  totalDivider: { marginVertical: 6 },
  breakEvenBlock: { marginTop: 4 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 },
});
