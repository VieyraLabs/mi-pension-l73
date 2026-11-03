/**
 * Indicador de progreso del formulario por pasos.
 * Combina contador textual y barra continua de progreso.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ProgressBar, useTheme } from 'react-native-paper';

export interface StepProgressProps {
  /** Paso actual (0-based). */
  step: number;
  total: number;
  /** Nombre del paso actual, mostrado junto al contador. */
  label: string;
}

export function StepProgress({ step, total, label }: StepProgressProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
        Paso {step + 1} de {total}: {label}
      </Text>
      <ProgressBar
        progress={(step + 1) / total}
        color={theme.colors.primary}
        style={[styles.bar, { backgroundColor: theme.colors.surfaceVariant }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    elevation: 2,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    alignSelf: 'stretch',
    width: '100%',
  },
});
