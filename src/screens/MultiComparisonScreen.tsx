/**
 * Pantalla de comparación multi-simulación del historial (DEC-014 / DEC-015).
 *
 * Recibe los ids de las simulaciones seleccionadas, las carga del historial y
 * muestra una TABLA comparativa: filas = métricas clave, columnas =
 * simulaciones. Todas las columnas se contrastan contra la MISMA base
 * «pensionarse lo antes posible» (sin Modalidad 10, a los 60 años o el mes
 * siguiente si ya los cumpliste) y cada una aporta su propio punto de
 * equilibrio.
 *
 * La tabla es la fuente de verdad; el detalle completo de cada simulación vive
 * en un accordion opcional. Ninguna cifra se recalcula aquí: vienen del motor
 * `calculateMultiComparison`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Card, Divider, Icon, IconButton, List, Text, useTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useHistory } from '../hooks/useHistory';
import {
  calculateMultiComparison,
  COMPARISON_POST_BREAKEVEN_YEARS,
  getMultiComparisonHorizonYears,
} from '../services/pension/comparison/comparisonCalculator';
import type {
  BreakEvenPoint,
  MultiComparisonEntry,
  MultiComparisonMetrics,
  MultiComparisonResult,
} from '../services/pension/comparison/types';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { EstimationDisclaimerCard } from '../components/EstimationDisclaimerCard';
import { SummaryRow } from '../components/SummaryRow';
import { CHART_HEIGHT, CHART_PADDING_RIGHT, ChartBoundary, ChartTouchOverlay, withAlpha, yearLabel } from '../components/ComparisonChartPrimitives';
import {
  formatAge,
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatInteger,
  formatYearsMonths,
} from '../utils/format';
import type { SavedSimulation } from '../models';
import { getSeriesColors } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Base común de todas las columnas (DEC-014). */
export const MULTI_COMPARISON_BASE_LABEL = 'Pensionarse lo antes posible';

/** Anchos fijos de las celdas: la tabla se desliza en horizontal. */
const LABEL_WIDTH = 172;
const VALUE_WIDTH = 152;

/** Fila de la tabla: etiqueta fija + un valor por simulación. */
interface MetricRow {
  key: string;
  label: string;
  /** Valor principal de la celda. */
  value: (metrics: MultiComparisonMetrics) => string;
  /** Línea secundaria de la celda (edad, año…). */
  detail?: (metrics: MultiComparisonMetrics) => string | null;
  /** Resalta el valor (fila protagonista). */
  emphasized?: boolean;
}

/** Punto de equilibrio en formato corto, o «No se alcanza» si es null. */
function formatBreakEven(breakEven: BreakEvenPoint | null): string {
  if (!breakEven) return 'No se alcanza';
  return `En ${formatYearsMonths(breakEven.monthsAfterEarlyRetirement)}`;
}

/** Edad y año del punto de equilibrio (null si no hay equilibrio). */
function formatBreakEvenDetail(breakEven: BreakEvenPoint | null): string | null {
  if (!breakEven) return null;
  return `~${formatYearsMonths(Math.round(breakEven.age * 12))} de edad (${breakEven.year})`;
}

/** Titular del punto de equilibrio (frase completa, como en la comparativa individual). */
function breakEvenHeadline(breakEven: BreakEvenPoint | null, horizonMonths: number): string {
  if (!breakEven) return `No se alcanza en ${formatInteger(horizonMonths / 12)} años`;
  return `En ${formatYearsMonths(breakEven.monthsAfterEarlyRetirement)} de que se hubiera pensionado lo antes posible.`;
}

/** Línea secundaria: edad aproximada y año calendario (null si no hay equilibrio). */
function breakEvenAgeLine(breakEven: BreakEvenPoint | null): string | null {
  if (!breakEven) return null;
  return `~${formatYearsMonths(Math.round(breakEven.age * 12))} de edad (${breakEven.year})`;
}

/**
 * Filas de la tabla (DEC-015): pensión mensual, edad/fecha de retiro, semanas,
 * SBC proyectado, costo M10 y punto de equilibrio. La pensión de la base se
 * muestra al final como referencia de contraste.
 */
const METRIC_ROWS: MetricRow[] = [
  {
    key: 'pension',
    label: 'Pensión mensual (Con M10)',
    value: (m) => formatCurrency(m.monthlyPension),
    emphasized: true,
  },
  {
    key: 'retirement',
    label: 'Fecha de retiro',
    value: (m) => formatDateLong(m.retirementDate),
    detail: (m) => `${formatAge(m.retirementAge)} años`,
  },
  {
    key: 'weeks',
    label: 'Semanas al pensionarte',
    value: (m) => `${formatInteger(m.totalWeeks)} sem.`,
  },
  {
    key: 'sbc',
    label: 'SBC proyectado (diario)',
    value: (m) => formatCurrency(m.projectedDailySalary),
  },
  {
    key: 'm10cost',
    label: 'Costo total de la Modalidad 10',
    value: (m) => formatCurrency(m.totalM10Cost),
  },
  {
    key: 'forgone',
    label: 'Pensión no percibida (por contratar M10)',
    value: (m) => formatCurrency(m.forgonePension),
  },
  {
    key: 'realcost',
    label: 'Costo real de la Modalidad 10',
    value: (m) => formatCurrency(m.realM10Cost),
  },
  {
    key: 'breakeven',
    label: 'Punto de equilibrio',
    value: (m) => formatBreakEven(m.breakEven),
    detail: (m) => formatBreakEvenDetail(m.breakEven),
  },
  {
    key: 'base',
    label: 'Pensión mensual (Sin M10)',
    value: (m) => formatCurrency(m.earlyMonthlyPension),
  },
];

/** Cabecera con el nombre de cada simulación (columnas). */
function TableHeader({
  entries,
  theme,
}: {
  entries: MultiComparisonEntry[];
  theme: MD3Theme;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.cell, styles.labelCell, { borderColor: theme.colors.outlineVariant }]}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Métrica
        </Text>
      </View>
      {entries.map((entry) => (
        <View
          key={entry.simulationId}
          testID={`multi-header-${entry.simulationId}`}
          style={[
            styles.cell,
            { width: VALUE_WIDTH, borderColor: theme.colors.outlineVariant },
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.primary, fontWeight: 'bold' }}
            numberOfLines={3}
          >
            {entry.metrics.m10Label}
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatDateLong(entry.birthDate)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Filas de métricas: etiqueta fija + valor por simulación. */
function MetricsTable({
  entries,
  theme,
}: {
  entries: MultiComparisonEntry[];
  theme: MD3Theme;
}) {
  return (
    <View>
      <TableHeader entries={entries} theme={theme} />
      {METRIC_ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={[styles.cell, styles.labelCell, { borderColor: theme.colors.outlineVariant }]}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {row.label}
            </Text>
          </View>
          {entries.map((entry) => {
            const detail = row.detail?.(entry.metrics) ?? null;
            return (
              <View
                key={entry.simulationId}
                style={[styles.cell, { width: VALUE_WIDTH, borderColor: theme.colors.outlineVariant }]}
                testID={`multi-cell-${row.key}-${entry.simulationId}`}
              >
                <Text
                  variant={row.emphasized ? 'bodyMedium' : 'bodySmall'}
                  style={{
                    color: row.emphasized ? theme.colors.primary : theme.colors.onSurface,
                    fontWeight: row.emphasized ? 'bold' : '600',
                    textAlign: 'right',
                  }}
                >
                  {row.value(entry.metrics)}
                </Text>
                {detail != null && (
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant, textAlign: 'right' }}
                  >
                    {detail}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Drill-down opcional con el detalle completo de una simulación, con el mismo
 *  formato e información que el «Resumen de la comparativa» individual. */
function SimulationDetail({
  entry,
  theme,
}: {
  entry: MultiComparisonEntry;
  theme: MD3Theme;
}) {
  const { metrics } = entry;
  const horizonMonths = entry.comparison.horizonMonths;
  return (
    <View style={styles.drillDown} testID={`multi-detail-${entry.simulationId}`}>
      <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
        Costos de la Modalidad 10
      </Text>
      <SummaryRow label="Costo total de la Modalidad 10" value={formatCurrency(metrics.totalM10Cost)} theme={theme} muted labelFlex={2} valueFlex={1} />
      <SummaryRow label="Pensión no percibida (por contratar M10)" value={formatCurrency(metrics.forgonePension)} theme={theme} muted labelFlex={2} valueFlex={1} />
      <Divider style={[styles.totalDivider, { alignSelf: 'flex-end', width: '33%' }]} />
      <SummaryRow label="Costo real de la Modalidad 10" value={formatCurrency(metrics.realM10Cost)} theme={theme} emphasized labelFlex={2} valueFlex={1} />

      <Divider style={styles.detailDivider} />

      <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
        Pensión mensual
      </Text>
      <SummaryRow label="Pensión mensual (Con M10)" value={formatCurrency(metrics.monthlyPension)} theme={theme} />
      <SummaryRow label="Pensión mensual (Sin M10)" value={formatCurrency(metrics.earlyMonthlyPension)} theme={theme} />

      <Divider style={styles.detailDivider} />

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
          {breakEvenHeadline(metrics.breakEven, horizonMonths)}
        </Text>
        {breakEvenAgeLine(metrics.breakEven) != null && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
            {breakEvenAgeLine(metrics.breakEven)}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Colores de las series «con Modalidad 10»: paleta categórica del tema (una
 * entrada por simulación), sin hex hardcodeado. La base «pensionarse lo antes
 * posible» usa siempre el secundario (violeta) y no colisiona con esta paleta.
 */
function getM10SeriesColor(theme: MD3Theme, index: number): string {
  const palette = getSeriesColors(theme.dark);
  return palette[index % palette.length]!;
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="bodySmall" style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
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

/**
 * Gráfica de líneas de la comparación múltiple: una serie por simulación (con
 * su Modalidad 10) más una ÚNICA serie base «pensionarse lo antes posible»
 * (DEC-014). Al tocar una columna se muestra el flujo acumulado de cada serie
 * en ese mes, igual que en la comparativa unitaria.
 */
function MultiComparisonChart({
  multi,
  theme,
}: {
  multi: MultiComparisonResult;
  theme: MD3Theme;
}) {
  const { width } = useWindowDimensions();
  const [plotWidth, setPlotWidth] = useState(0);

  const entries = multi.entries;
  const baseSeries = entries[0]!.comparison.earlyScenario.series;
  const m10Series = entries.map((entry) => entry.comparison.m10Scenario.series);
  const monthCount = multi.horizonMonths + 1;

  // Punto de equilibrio de referencia: el de la simulación que MÁS tarda en
  // alcanzarlo (DEC-014). Si ninguna lo alcanza, no hay referencia.
  const referenceBreakEven = entries
    .map((entry) => entry.comparison.breakEven)
    .filter((b): b is BreakEvenPoint => b != null)
    .reduce<BreakEvenPoint | null>(
      (latest, b) => (latest == null || b.monthIndex > latest.monthIndex ? b : latest),
      null,
    );
  const referenceBreakEvenMonth = referenceBreakEven?.monthIndex ?? null;

  // Por defecto se selecciona la columna del punto de equilibrio de referencia
  // (o el mes 0) y la ventana arranca en el año 0 mostrando apenas 3 años tras
  // ese punto (o todo el horizonte si no hay equilibrio), como en la individual.
  const defaultSelectedMonth = referenceBreakEvenMonth ?? 0;
  const defaultVisibleMonths =
    referenceBreakEvenMonth != null
      ? Math.min(monthCount, referenceBreakEvenMonth + COMPARISON_POST_BREAKEVEN_YEARS * 12 + 1)
      : monthCount;

  const [selectedMonth, setSelectedMonth] = useState(defaultSelectedMonth);

  // Ventana visible (zoom): el zoom cambia `visibleMonths`; el pan cambia `start`.
  const MIN_VISIBLE_MONTHS = 12;
  const [visibleMonths, setVisibleMonths] = useState(defaultVisibleMonths);
  const [start, setStart] = useState(0);
  const visibleCount = Math.max(MIN_VISIBLE_MONTHS, Math.min(monthCount, visibleMonths));
  const maxStart = Math.max(0, monthCount - visibleCount);
  const clampedStart = Math.max(0, Math.min(start, maxStart));
  const end = clampedStart + visibleCount - 1;

  const containerWidth = plotWidth > 0 ? plotWidth : Math.max(0, width - 64);
  const chartWidth = containerWidth;

  const windowMonths = m10Series[0]!.slice(clampedStart, end + 1);
  const labels = windowMonths.map((point) =>
    point.monthIndex % 12 === 0 ? yearLabel(point.monthIndex) : '',
  );
  const hidePointsAtIndex = windowMonths
    .map((_, i) => i)
    .filter((i) => (clampedStart + i) % 12 !== 0);

  const datasets = [
    ...m10Series.map((series, i) => ({
      data: series.slice(clampedStart, end + 1).map((point) => point.cumulativeNet),
      color: (opacity = 1) => withAlpha(getM10SeriesColor(theme, i), opacity),
      strokeWidth: 2,
    })),
    {
      data: baseSeries.slice(clampedStart, end + 1).map((point) => point.cumulativeNet),
      color: (opacity = 1) => withAlpha(theme.colors.onSurface, opacity),
      strokeWidth: 2,
    },
  ];

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 2,
    color: (opacity = 1) => withAlpha(theme.colors.onSurfaceVariant, opacity),
    labelColor: () => theme.colors.onSurface,
    propsForDots: { r: '2.5', fillOpacity: 0.4 },
  };

  const zoomIn = () => setVisibleMonths((m) => Math.max(MIN_VISIBLE_MONTHS, Math.round(m / 2)));
  const zoomOut = () => setVisibleMonths((m) => Math.min(monthCount, m * 2));
  const panLeft = () => setStart((s) => Math.max(0, s - Math.max(12, Math.round(visibleCount / 2))));
  const panRight = () => setStart((s) => Math.min(maxStart, s + Math.max(12, Math.round(visibleCount / 2))));
  const zoomFactor = Math.max(1, monthCount / visibleCount);

  // Refs con valores frescos para que el PanResponder (creado una sola vez) lea
  // siempre el estado actual sin re-crearse en cada render.
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
      // Solo roba gestos horizontales: deja pasar el scroll vertical y los taps.
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        gestureStartRef.current = startRef.current;
      },
      onPanResponderMove: (_evt, g) => {
        const monthPx = (chartWidthRef.current - CHART_PADDING_RIGHT) / visibleCountRef.current;
        const delta = Math.round(g.dx / monthPx);
        setStart(Math.max(0, Math.min(maxStartRef.current, gestureStartRef.current - delta)));
      },
    }),
  ).current;

  const columnStep = (chartWidth - CHART_PADDING_RIGHT) / visibleCount;
  const selectedLineX =
    selectedMonth >= clampedStart && selectedMonth <= end
      ? CHART_PADDING_RIGHT + (selectedMonth - clampedStart) * columnStep
      : null;
  const selected = Math.min(selectedMonth, monthCount - 1);
  const handleSelect = (colIndex: number) => setSelectedMonth(clampedStart + colIndex);

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
            <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.75 }}>
              Punto de equilibrio de referencia
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
              {breakEvenHeadline(referenceBreakEven, multi.horizonMonths)}
            </Text>
            {breakEvenAgeLine(referenceBreakEven) != null && (
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.75 }}>
                {breakEvenAgeLine(referenceBreakEven)}
              </Text>
            )}
          </View>
        </View>

        <View onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}>
          <ChartBoundary>
            <View
              {...panResponder.panHandlers}
              style={{
                position: 'relative',
                width: chartWidth,
                height: CHART_HEIGHT,
                overflow: 'hidden',
              }}
            >
              <LineChart
                data={{ labels, datasets }}
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
              {selectedLineX != null && chartWidth > 0 && (
                <View
                  pointerEvents="none"
                  testID="multi-chart-selection-line"
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

        {entries.map((entry, i) => (
          <Legend
            key={entry.simulationId}
            label={entry.metrics.m10Label}
            color={getM10SeriesColor(theme, i)}
          />
        ))}
        <Legend label={MULTI_COMPARISON_BASE_LABEL} color={theme.colors.onSurface} />

        <View style={styles.zoomRow}>
          <IconButton
            icon="chevron-left"
            size={20}
            onPress={panLeft}
            disabled={clampedStart <= 0}
            accessibilityLabel="Desplazar a la izquierda"
            testID="multi-chart-pan-left"
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
            testID="multi-chart-zoom-out"
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
            testID="multi-chart-zoom-in"
          />
          <IconButton
            icon="chevron-right"
            size={20}
            onPress={panRight}
            disabled={clampedStart >= maxStart}
            accessibilityLabel="Desplazar a la derecha"
            testID="multi-chart-pan-right"
          />
        </View>

        <View
          style={{
            marginTop: 4,
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: theme.colors.surfaceVariant,
          }}
        >
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 2 }}>
            Mes seleccionado
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
            En {formatYearsMonths(selected)}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 2 }}>
            Flujo acumulado a esa fecha (pensión − cuotas)
          </Text>
          {entries.map((entry, i) => (
            <DetailRow
              key={entry.simulationId}
              theme={theme}
              label={entry.metrics.m10Label}
              value={formatCurrency(m10Series[i]![selected]!.cumulativeNet)}
              valueColor={getM10SeriesColor(theme, i)}
            />
          ))}
          <DetailRow
            theme={theme}
            label={MULTI_COMPARISON_BASE_LABEL}
            value={formatCurrency(baseSeries[selected]!.cumulativeNet)}
            valueColor={theme.colors.onSurface}
          />
          {entries.map((entry, i) => {
            const diff =
              m10Series[i]![selected]!.cumulativeNet - baseSeries[selected]!.cumulativeNet;
            const diffColor =
              diff > 0 ? theme.colors.primary : diff < 0 ? theme.colors.error : theme.colors.onSurface;
            return (
              <DetailRow
                key={`gain-${entry.simulationId}`}
                theme={theme}
                label={`Ganancia neta · ${entry.metrics.m10Label}`}
                value={formatCurrency(diff)}
                valueColor={diffColor}
              />
            );
          })}
        </View>

        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          Toca un punto en la gráfica para ver el detalle de ese mes.
        </Text>
      </Card.Content>
    </Card>
  );
}

export default function MultiComparisonScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'MultiComparison'>>();
  const simulationIds = route.params?.simulationIds ?? [];
  const { simulations, loading } = useHistory();

  // Simulaciones encontradas en el historial, ordenadas de MAYOR a MENOR UMA
  // de la Modalidad 10; las simulaciones SIN Modalidad 10 van al final, después
  // de la que tiene M10 con menor UMA (DEC-015).
  const selected = useMemo(() => {
    const byId = new Map(simulations.map((sim) => [sim.id, sim]));
    return simulationIds
      .map((id) => byId.get(id))
      .filter((sim): sim is SavedSimulation => sim != null)
      .sort((a, b) => {
        const activeA = a.result.input.modalidad10.active;
        const activeB = b.result.input.modalidad10.active;
        // Primero las que incluyen M10; las que no, al final.
        if (activeA !== activeB) return activeA ? -1 : 1;
        // Dentro de las que incluyen M10, de mayor a menor UMA (las que no
        // declaran UMA se tratan como las de menor valor).
        const umaA = a.result.input.modalidad10.contributionSalaryInUMAs ?? Number.NEGATIVE_INFINITY;
        const umaB = b.result.input.modalidad10.contributionSalaryInUMAs ?? Number.NEGATIVE_INFINITY;
        return umaB - umaA;
      });
  }, [simulationIds, simulations]);

  const multi = useMemo(() => {
    if (selected.length < 2) return null;
    const horizonYears = getMultiComparisonHorizonYears(selected.map((sim) => sim.result));
    return calculateMultiComparison(
      selected.map((sim) => ({ simulationId: sim.id, name: sim.name, result: sim.result })),
      horizonYears,
    );
  }, [selected]);

  // Acordeón del «Detalle por simulación»: por defecto queda expandida la
  // simulación de MAYOR UMA (la primera tras el ordenamiento) y, al expandir
  // otra, se contraen las demás (solo una abierta a la vez).
  const [expandedSimulationId, setExpandedSimulationId] = useState<string | undefined>(
    undefined,
  );
  const initializedAccordionRef = useRef(false);

  useEffect(() => {
    if (!initializedAccordionRef.current && multi) {
      initializedAccordionRef.current = true;
      setExpandedSimulationId(multi.entries[0]?.simulationId);
    }
  }, [multi]);

  if (loading) {
    return <LoadingView mensaje="Cargando simulaciones…" />;
  }

  if (simulationIds.length < 2) {
    return (
      <EmptyState
        mensaje="Selecciona al menos dos simulaciones del historial para compararlas."
        textoBoton="Volver al historial"
        onPressBoton={() => navigation.goBack()}
      />
    );
  }

  // Degradación con gracia: si las simulaciones ya no existen (se borraron del
  // historial) no se puede construir la tabla.
  if (!multi || multi.entries.length < 2) {
    return (
      <EmptyState
        mensaje="No encontramos las simulaciones seleccionadas. Puede que se hayan eliminado del historial."
        textoBoton="Volver al historial"
        onPressBoton={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <EstimationDisclaimerCard />

      <MultiComparisonChart multi={multi} theme={theme} />

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Title title="Resumen de la comparativa" titleVariant="titleMedium" />
        <Divider />
        <Card.Content style={styles.cardContent}>
          {/* La base se identifica como referencia común de TODAS las columnas. */}
          <View style={[styles.baseNote, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}
            >
              Referencia común de todas las columnas
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}
              testID="multi-base-label"
            >
              {MULTI_COMPARISON_BASE_LABEL}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}
            >
              Sin Modalidad 10, a los 60 años o el mes siguiente si ya los cumpliste. Cada columna se
              contrasta contra esta misma base.
            </Text>
          </View>

          {selected.length < simulationIds.length && (
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              Algunas simulaciones seleccionadas ya no existen en el historial.
            </Text>
          )}

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Desliza la tabla horizontalmente para ver todas las simulaciones.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
            <MetricsTable entries={multi.entries} theme={theme} />
          </ScrollView>

          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Comparación en pesos nominales, a {formatInteger(multi.horizonYears)} años de horizonte
            (hasta los 90 años de edad).
          </Text>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Title title="Detalle por simulación" titleVariant="titleMedium" />
        <Divider />
        <List.Section>
          {multi.entries.map((entry) => (
            <List.Accordion
              key={entry.simulationId}
              id={entry.simulationId}
              title={entry.metrics.m10Label}
              titleStyle={{ color: theme.colors.onSurface }}
              style={{ backgroundColor: theme.colors.surface }}
              // Identificador propio del acordeón: el título de la simulación
              // aparece también en la tabla y en la leyenda de la gráfica, así
              // que la etiqueta no sirve para apuntar a un elemento concreto.
              testID={`multi-accordion-${entry.simulationId}`}
              expanded={expandedSimulationId === entry.simulationId}
              onPress={() =>
                setExpandedSimulationId((current) =>
                  current === entry.simulationId ? undefined : entry.simulationId,
                )
              }
            >
              <SimulationDetail entry={entry} theme={theme} />
            </List.Accordion>
          ))}
        </List.Section>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 16 },
  cardContent: { paddingTop: 12, gap: 8 },
  baseNote: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  tableScroll: { marginTop: 4 },
  row: { flexDirection: 'row' },
  cell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  labelCell: { width: LABEL_WIDTH, borderRightWidth: 1 },
  drillDown: { paddingHorizontal: 16, paddingVertical: 12 },
  detailDivider: { marginVertical: 8 },
  sectionLabel: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, marginBottom: 2 },
  totalDivider: { marginVertical: 6 },
  breakEvenBlock: { marginTop: 4 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 },
});
