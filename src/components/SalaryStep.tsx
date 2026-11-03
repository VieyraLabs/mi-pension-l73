/**
 * Paso 2 del formulario de nueva simulación: salario base de cotización (SBC).
 * Se captura en el mismo paso que el historial laboral.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, TextInput, SegmentedButtons, HelperText } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { AverageContributionSalary } from '../models';
import { dailyToMonthly, monthlyToDaily } from '../utils/format';

export interface SalaryStepProps {
  averageSalary: AverageContributionSalary;
  onChangeDaily: (value: number) => void;
  onChangeMonthly: (value: number) => void;
  monthlyMode: boolean;
  setMonthlyMode: (value: boolean) => void;
  theme: MD3Theme;
}

export function SalaryStep({
  averageSalary,
  onChangeDaily,
  onChangeMonthly,
  monthlyMode,
  setMonthlyMode,
  theme,
}: SalaryStepProps) {
  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
          Salario Base de Cotización (SBC)
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          Ingresa el promedio del SBC de tus últimas 250 semanas cotizadas. Si tuviste huecos sin cotización, el promedio se calcula sobre las semanas que sí cotizaste.
        </Text>
        <SegmentedButtons
          value={monthlyMode ? 'mensual' : 'diario'}
          onValueChange={(v) => setMonthlyMode(v === 'mensual')}
          buttons={[
            { value: 'diario', label: 'Salario diario' },
            { value: 'mensual', label: 'Salario mensual' },
          ]}
          style={{ marginBottom: 16 }}
        />
        {!monthlyMode ? (
          <>
            <TextInput
              label="Salario diario promedio (MXN) *"
              value={averageSalary.dailySalary > 0 ? String(averageSalary.dailySalary) : ''}
              onChangeText={(v) => { const n = parseFloat(v); if (!isNaN(n)) onChangeDaily(n); }}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              left={<TextInput.Affix text="$" />}
            />
            {averageSalary.dailySalary > 0 && (
              <HelperText type="info">
                Equivalente mensual: ${dailyToMonthly(averageSalary.dailySalary).toFixed(2)} MXN
              </HelperText>
            )}
          </>
        ) : (
          <>
            <TextInput
              label="Salario mensual promedio (MXN) *"
              value={averageSalary.monthlySalary > 0 ? String(averageSalary.monthlySalary) : ''}
              onChangeText={(v) => { const n = parseFloat(v); if (!isNaN(n)) onChangeMonthly(n); }}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              left={<TextInput.Affix text="$" />}
            />
            {averageSalary.monthlySalary > 0 && (
              <HelperText type="info">
                Equivalente diario: ${monthlyToDaily(averageSalary.monthlySalary).toFixed(2)} MXN
              </HelperText>
            )}
          </>
        )}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          El SBC es el salario registrado ante el IMSS, no necesariamente el salario neto recibido.
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  input: { marginBottom: 12 },
});
