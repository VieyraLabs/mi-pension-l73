/**
 * Paso 4 del formulario de nueva simulación: UMA (Unidad de Medida y Actualización).
 * Comparte paso con la Modalidad 40.
 */
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, TextInput, Button, Switch, Divider, Chip } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { UMAConfiguration } from '../models';
import { TABLA_UMA_SMG } from '../constants/uma';

export interface UMAStepProps {
  uma: UMAConfiguration;
  onSelectYear: (year: number) => void;
  onCustomize: (dailyUMA: number) => void;
  isCustom: boolean;
  setIsCustom: (value: boolean) => void;
  theme: MD3Theme;
}

export function UMAStep({ uma, onSelectYear, onCustomize, isCustom, setIsCustom, theme }: UMAStepProps) {
  const [customValue, setCustomValue] = useState('');

  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
          Unidad de Medida y Actualización (UMA)
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          Selecciona el año de la UMA a utilizar en el cálculo.
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Switch value={isCustom} onValueChange={setIsCustom} />
          <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.onSurface }}>
            Ingresar UMA personalizada
          </Text>
        </View>

        {isCustom ? (
          <>
            <TextInput
              label="UMA diaria (MXN)"
              value={customValue}
              onChangeText={setCustomValue}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <Button
              mode="outlined"
              onPress={() => { const n = parseFloat(customValue); if (!isNaN(n)) onCustomize(n); }}
              style={{ marginTop: 8 }}
            >
              Usar esta UMA
            </Button>
          </>
        ) : (
          <>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
              Año de la UMA:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[...TABLA_UMA_SMG].slice(-5).reverse().map((r) => (
                  <Chip
                    key={r.year}
                    selected={uma.year === r.year}
                    onPress={() => onSelectYear(r.year)}
                    icon={r.isEstimate ? 'alert' : undefined}
                    style={{ marginBottom: 4 }}
                  >
                    {r.year}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <Divider style={{ marginVertical: 12 }} />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          UMA seleccionada: ${uma.dailyUMA.toFixed(2)}/día | ${uma.monthlyUMA.toFixed(2)}/mes
          {uma.isCustom ? ' (personalizada)' : ` (${uma.year})`}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  input: { marginBottom: 12 },
});
