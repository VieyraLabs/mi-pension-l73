/**
 * Paso 3 del formulario de nueva simulación: beneficiarios.
 * Comparte paso con la edad de retiro.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, TextInput, Switch, Divider } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { Beneficiaries } from '../models';
import { IconText } from './IconText';

export interface BeneficiariesStepProps {
  beneficiaries: Beneficiaries;
  onChange: (data: Partial<Beneficiaries>) => void;
  theme: MD3Theme;
}

export function BeneficiariesStep({ beneficiaries, onChange, theme }: BeneficiariesStepProps) {
  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
          Beneficiarios
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          Arts. 163–165 LSS 1973. Los beneficiarios incrementan tu pensión con asignaciones familiares.
        </Text>

        <View style={styles.switchRow}>
          <Switch
            value={beneficiaries.hasSpouse}
            onValueChange={(v) => onChange({ hasSpouse: v })}
          />
          <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.onSurface }}>
            Tiene cónyuge o concubina/o (+15%)
          </Text>
        </View>

        <View style={styles.switchRow}>
          <Switch
            value={beneficiaries.hasMinorChildren}
            onValueChange={(v) => onChange({ hasMinorChildren: v, numberOfMinorChildren: v ? 1 : 0 })}
          />
          <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.onSurface }}>
            Tiene hijos menores de 16 años (+10% por hijo)
          </Text>
        </View>

        {beneficiaries.hasMinorChildren && (
          <TextInput
            label="Número de hijos menores"
            value={String(beneficiaries.numberOfMinorChildren)}
            onChangeText={(v) => { const n = parseInt(v); if (!isNaN(n)) onChange({ numberOfMinorChildren: n }); }}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { marginLeft: 40 }]}
          />
        )}

        <View style={styles.switchRow}>
          <Switch
            value={beneficiaries.hasDependentParents}
            onValueChange={(v) => onChange({ hasDependentParents: v, numberOfDependentParents: v ? 1 : 0 })}
          />
          <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.onSurface, flex: 1 }}>
            Tiene padres dependientes económicamente (+10%) — solo si no hay cónyuge ni hijos
          </Text>
        </View>

        <Divider style={{ marginVertical: 12 }} />
        <IconText icon="check-circle" color={theme.colors.primary}>
          {!beneficiaries.hasSpouse && !beneficiaries.hasMinorChildren
            ? 'Se aplicará ayuda asistencial del 15% (sin beneficiarios)'
            : beneficiaries.hasSpouse && !beneficiaries.hasMinorChildren
              ? 'Se aplicará ayuda asistencial del 10% (cónyuge sin hijos)'
              : 'Asignaciones familiares activas'}
        </IconText>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  input: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
});
