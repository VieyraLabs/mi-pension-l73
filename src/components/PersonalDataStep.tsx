/**
 * Paso 1 del formulario de nueva simulación: datos personales.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, TextInput, HelperText } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { PersonalData } from '../models';
import { calculateAge } from '../utils/date';
import { DateField } from './DateField';
import { DEFAULT_BIRTH_DATE } from '../hooks/usePensionForm';

export interface PersonalDataStepProps {
  personalData: PersonalData;
  onChange: (data: Partial<PersonalData>) => void;
  theme: MD3Theme;
}

export function PersonalDataStep({ personalData, onChange, theme }: PersonalDataStepProps) {
  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>
          Información personal
        </Text>
        <TextInput
          label="Nombre *"
          value={personalData.name ?? ''}
          onChangeText={(v) => onChange({ name: v })}
          mode="outlined"
          style={styles.input}
        />
        {/* La fecha no se escribe a mano: se elige con el calendario
            (DateField), igual que la fecha de retiro del paso 3. */}
        <DateField
          label="Fecha de nacimiento *"
          value={personalData.birthDate}
          fallbackDate={DEFAULT_BIRTH_DATE}
          onConfirm={(fecha) => onChange({ birthDate: fecha })}
          theme={theme}
        />
        {personalData.birthDate && (
          <HelperText type="info">
            Edad actual: {calculateAge(personalData.birthDate)} años
          </HelperText>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  input: { marginBottom: 12 },
});
