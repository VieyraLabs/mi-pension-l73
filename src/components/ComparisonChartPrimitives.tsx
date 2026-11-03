/**
 * Primitivas de gráfica comparativa (react-native-chart-kit) compartidas por
 * `ComparisonScreen` (comparativa unitaria) y `MultiComparisonScreen`
 * (comparativa multi-simulación): conversión de color con opacidad, etiquetas
 * del eje de tiempo, overlay táctil por columna y el límite de error que
 * degrada con gracia si el SVG nativo no monta.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

/** Altura fija de la gráfica (react-native-chart-kit). */
export const CHART_HEIGHT = 220;
/** Margen izquierdo donde van las etiquetas del eje Y. */
export const CHART_PADDING_RIGHT = 64;

/** Convierte un color hex (#RRGGBB o #RRGGBBAA) a `rgba(...)` con opacidad. */
export function withAlpha(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const rgb = clean.length === 6 ? clean : clean.slice(0, 6);
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Etiqueta del eje de tiempo: años enteros sin decimales, fracciones con 2. */
export function yearLabel(monthIndex: number): string {
  const years = monthIndex / 12;
  return Number.isInteger(years) ? String(years) : years.toFixed(2);
}

/**
 * Overlay táctil de la gráfica: una columna transparente por punto, para que
 * tocar un punto funcione igual en web y en nativo (el `onDataPointClick` de
 * react-native-chart-kit no dispara de forma confiable en web).
 */
export function ChartTouchOverlay({
  count,
  width,
  startMonth,
  onSelect,
}: {
  count: number;
  width: number;
  startMonth: number;
  onSelect: (index: number) => void;
}) {
  if (count < 1) return null;
  const step = (width - CHART_PADDING_RIGHT) / count;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const center = CHART_PADDING_RIGHT + i * step;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={`Ver detalle del mes ${startMonth + i}`}
            style={{
              position: 'absolute',
              left: center - step / 2,
              top: 0,
              width: step,
              height: CHART_HEIGHT,
            }}
          />
        );
      })}
    </>
  );
}

/** Límite de la gráfica: degrada a un aviso si falla el SVG nativo. */
export class ChartBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[comparison] Gráfica no disponible:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.fallback}>
          <Text variant="bodySmall" style={{ textAlign: 'center' }}>
            La gráfica no está disponible en este dispositivo. La tabla inferior conserva toda la
            información.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});
