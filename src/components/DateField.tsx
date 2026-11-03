/**
 * Campo de fecha de solo lectura que abre el calendario de ruedas
 * (`DateWheelPicker`) al tocarlo.
 *
 * Es el patrón ÚNICO para capturar fechas en el formulario: el campo no se
 * escribe a mano, se toca para elegir la fecha en el calendario. Lo usan la
 * fecha de nacimiento (paso 1), la fecha de retiro (paso 3) y la fecha de
 * nacimiento revisada en la validación de la constancia IMSS.
 *
 * Accesibilidad: el `Pressable` envuelve al campo (y el campo no intercepta
 * los toques) para que todo el renglón sea pulsable y anuncie
 * «Abrir calendario».
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, TextInput } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { formatDateLong } from '../utils/format';
import { DateWheelPicker } from './DateWheelPicker';

export interface DateFieldProps {
  /** Etiqueta del campo. */
  label: string;
  /** Fecha vigente; si falta o es inválida, el campo se muestra vacío. */
  value?: Date;
  /** Fecha sobre la que se arma la rueda cuando `value` no es utilizable. */
  fallbackDate: Date;
  /** Se dispara al aceptar, con la fecha elegida. */
  onConfirm: (date: Date) => void;
  theme: MD3Theme;
}

/** Indica si la fecha existe y es utilizable (evita «Invalid Date» en pantalla). */
function esFechaUtilizable(value?: Date): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function DateField({ label, value, fallbackDate, onConfirm, theme }: DateFieldProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const utilizable = esFechaUtilizable(value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir calendario"
        onPress={() => setPickerVisible(true)}
        style={styles.dateRow}
      >
        <View pointerEvents="none" style={styles.dateField}>
          <TextInput
            label={label}
            value={utilizable ? formatDateLong(value) : ''}
            editable={false}
            mode="outlined"
            style={styles.input}
            accessibilityLabel={label}
          />
        </View>
        <Icon source="calendar" size={22} color={theme.colors.onSurfaceVariant} />
      </Pressable>
      <DateWheelPicker
        visible={pickerVisible}
        value={utilizable ? value : fallbackDate}
        onChange={onConfirm}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 12 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateField: { flex: 1 },
});
