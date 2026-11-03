/**
 * Control de UMAs del paso de Modalidad 10.
 *
 * Permite subir y bajar de UMA en UMA dentro del rango legal y escribir el
 * valor directamente con hasta dos decimales. El rango lo fija la ley: el
 * piso es el salario mínimo del área geográfica y el techo son 25 UMA
 * (Art. 28 LSS vigente).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, TextInput } from 'react-native-paper';
import { round2 } from '../utils/format';

export interface UMAStepperProps {
  /** Valor actual en UMAs. */
  value: number;
  /** Piso del rango en UMAs. */
  min: number;
  /** Techo del rango en UMAs. */
  max: number;
  /** Cuántas UMAs suma o resta cada pulsación. */
  step?: number;
  /** Se dispara con el nuevo valor en UMAs. */
  onChange: (value: number) => void;
  label?: string;
}

function formatValue(value: number): string {
  return String(round2(value));
}

export function UMAStepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label = 'UMAs',
}: UMAStepperProps) {
  const [draft, setDraft] = useState(() => formatValue(value));

  // El texto acompaña al valor cuando el cambio viene de fuera (por ejemplo,
  // al cambiar de año de UMA); mientras se escribe, manda lo que se escribió.
  useEffect(() => {
    if (Number.parseFloat(draft) === value) return;
    setDraft(formatValue(value));
  }, [value, draft]);

  const clamp = (candidate: number) => Math.min(Math.max(candidate, min), max);

  const stepBy = (delta: number) => {
    const next = clamp(round2(value + delta));
    setDraft(formatValue(next));
    onChange(next);
  };

  const handleChangeText = (text: string) => {
    setDraft(text);
    const parsed = Number.parseFloat(text);
    if (!Number.isNaN(parsed)) onChange(round2(parsed));
  };

  return (
    <View style={styles.container}>
      <IconButton
        icon="minus"
        size={20}
        onPress={() => stepBy(-step)}
        disabled={value <= min}
        accessibilityLabel="Quitar una UMA"
        style={styles.button}
      />
      <TextInput
        label={label}
        value={draft}
        onChangeText={handleChangeText}
        mode="outlined"
        dense
        keyboardType="decimal-pad"
        style={styles.input}
        selectTextOnFocus
      />
      <IconButton
        icon="plus"
        size={20}
        onPress={() => stepBy(step)}
        disabled={value >= max}
        accessibilityLabel="Sumar una UMA"
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    margin: 0,
  },
  input: {
    flex: 1,
    minWidth: 72,
  },
});
