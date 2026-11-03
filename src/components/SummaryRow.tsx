/**
 * Fila etiqueta/valor para tarjetas de resumen (usada en ResultScreen).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

export interface SummaryRowProps {
  label: string;
  value: string;
  theme: MD3Theme;
  /** Resalta el valor como total (negrita, color primario, tamaño mayor). */
  emphasized?: boolean;
  /** Atenúa el valor (sumando): color secundario y sin negrita. */
  muted?: boolean;
  /** Ancho relativo de la etiqueta (default 1). */
  labelFlex?: number;
  /** Ancho relativo del valor (default 1). */
  valueFlex?: number;
}

export function SummaryRow({
  label,
  value,
  theme,
  emphasized = false,
  muted = false,
  labelFlex = 1,
  valueFlex = 1,
}: SummaryRowProps) {
  const valueVariant: 'bodySmall' | 'bodyMedium' = emphasized ? 'bodyMedium' : 'bodySmall';
  const valueColor = emphasized
    ? theme.colors.primary
    : muted
      ? theme.colors.onSurfaceVariant
      : theme.colors.onSurface;
  const valueWeight: 'bold' | 'normal' = emphasized || !muted ? 'bold' : 'normal';

  return (
    <View style={styles.row}>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: labelFlex }}>{label}</Text>
      <Text
        variant={valueVariant}
        style={{ color: valueColor, fontWeight: valueWeight, flex: valueFlex, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
});
