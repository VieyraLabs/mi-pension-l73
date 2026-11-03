/**
 * Paso 2 del formulario de nueva simulación: historial laboral.
 * Comparte paso con el salario base de cotización (SBC).
 *
 * Este paso NO narra la proyección de semanas: la edad de retiro todavía no
 * está decidida (se elige en el paso 3), así que una proyección de semanas
 * "al jubilarte" sería una cifra que todavía no es cierta. El mínimo de
 * semanas se revisa al final, con la edad de retiro ya definida.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, TextInput } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { WorkHistory } from '../models';

export interface WorkHistoryStepProps {
  workHistory: WorkHistory;
  onChange: (history: Partial<WorkHistory>) => void;
  theme: MD3Theme;
}

export function WorkHistoryStep({ workHistory, onChange, theme }: WorkHistoryStepProps) {
  const weeks = workHistory.totalWeeks;

  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>
          Historial laboral
        </Text>
        <TextInput
          label="Total de semanas cotizadas *"
          value={weeks > 0 ? String(weeks) : ''}
          onChangeText={(v) => {
            const n = parseInt(v);
            if (!isNaN(n)) onChange({ totalWeeks: n });
          }}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
        />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          Puedes verificar tus semanas cotizadas en el portal del IMSS (imss.gob.mx) con tu NSS.
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  input: { marginBottom: 12 },
});
