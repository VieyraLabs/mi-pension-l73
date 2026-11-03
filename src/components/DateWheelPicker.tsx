/**
 * Selector de fecha con ruedas, al estilo del "Wheel Date Picker" de iOS.
 *
 * No hay librería de date picker en el proyecto (política de cero dependencias
 * nuevas), así que la rueda se construye con `react-native` (Modal +
 * ScrollView con `snapToInterval`) y `react-native-paper` (Surface, Text,
 * Button) sobre el tema Material 3.
 *
 * Accesibilidad:
 * - cada elemento de la rueda es pulsable y expone su `accessibilityLabel`
 *   ("Año 2030", "Mes julio", "Día 1"), de modo que se puede localizar con
 *   `getByLabelText` y se puede operar con el teclado o con un lector de
 *   pantalla;
 * - el estado seleccionado se marca con `accessibilityState.selected`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Button, Surface, Text, useTheme } from 'react-native-paper';

/** Altura de cada renglón de la rueda. */
const ITEM_HEIGHT = 44;
/** Altura visible de la rueda (tres renglones: el seleccionado al centro). */
const WHEEL_HEIGHT = ITEM_HEIGHT * 3;
/** Renglón de respiro arriba y abajo del área visible. */
const WHEEL_PADDING = ITEM_HEIGHT;

/** Meses en español (el rótulo de la rueda es el que lee la persona). */
const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Elemento de una rueda. */
interface WheelItem {
  value: number;
  label: string;
  accessibilityLabel: string;
}

export interface DateWheelPickerProps {
  /** Si el modal está abierto. */
  visible: boolean;
  /** Fecha sobre la que se arma la rueda al abrir. */
  value: Date;
  /** Se dispara al aceptar, con la fecha elegida. */
  onChange: (date: Date) => void;
  /** Se dispara al cancelar o al cerrar el modal. */
  onDismiss: () => void;
  /** Límite inferior de la rueda de años (inclusive). */
  minDate?: Date;
  /** Límite superior de la rueda de años (inclusive). */
  maxDate?: Date;
  /** Título del modal. */
  title?: string;
}

/** Días que tiene el mes indicado (28, 29, 30 o 31). */
export function diasEnMes(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Estado interno de la fecha que se está armando en la rueda. */
interface Borrador {
  year: number;
  month: number;
  day: number;
}

function aBorrador(fecha: Date): Borrador {
  return { year: fecha.getFullYear(), month: fecha.getMonth(), day: fecha.getDate() };
}

interface WheelProps {
  items: WheelItem[];
  selectedValue: number;
  onSelect: (value: number) => void;
}

/** Una rueda desplazable con un renglón por opción. */
function Wheel({ items, selectedValue, onSelect }: WheelProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === selectedValue),
  );

  // Mantiene la rueda alineada con la selección vigente.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const item = items[index];
    if (item && item.value !== selectedValue) {
      onSelect(item.value);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.wheel}
      contentContainerStyle={styles.wheelContent}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
      onMomentumScrollEnd={handleMomentumEnd}
    >
      {items.map((item) => {
        const isSelected = item.value === selectedValue;
        return (
          <Pressable
            key={item.value}
            accessibilityLabel={item.accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(item.value)}
            style={styles.wheelItem}
          >
            <Text
              variant="bodyLarge"
              style={isSelected ? { color: theme.colors.primary, fontWeight: 'bold' } : undefined}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function DateWheelPicker({
  visible,
  value,
  onChange,
  onDismiss,
  minDate,
  maxDate,
  title = 'Selecciona la fecha',
}: DateWheelPickerProps) {
  const theme = useTheme();
  const [borrador, setBorrador] = useState<Borrador>(() => aBorrador(value));

  // Al abrir, la rueda arranca en la fecha recibida.
  useEffect(() => {
    if (visible) {
      setBorrador(aBorrador(value));
    }
  }, [visible]);

  const anios = useMemo<WheelItem[]>(() => {
    const min = minDate ? minDate.getFullYear() : value.getFullYear() - 100;
    const max = maxDate ? maxDate.getFullYear() : value.getFullYear() + 100;
    const items: WheelItem[] = [];
    for (let anio = min; anio <= max; anio++) {
      items.push({ value: anio, label: String(anio), accessibilityLabel: `Año ${anio}` });
    }
    return items;
  }, [minDate, maxDate, value]);

  const meses = useMemo<WheelItem[]>(
    () =>
      NOMBRES_MES.map((nombre, index) => ({
        value: index,
        label: nombre,
        accessibilityLabel: `Mes ${nombre}`,
      })),
    [],
  );

  const dias = useMemo<WheelItem[]>(() => {
    const total = diasEnMes(borrador.year, borrador.month);
    const items: WheelItem[] = [];
    for (let dia = 1; dia <= total; dia++) {
      items.push({ value: dia, label: String(dia), accessibilityLabel: `Día ${dia}` });
    }
    return items;
  }, [borrador.year, borrador.month]);

  const seleccionarAnio = (year: number) => {
    setBorrador((prev) => ({
      ...prev,
      year,
      day: Math.min(prev.day, diasEnMes(year, prev.month)),
    }));
  };

  const seleccionarMes = (month: number) => {
    setBorrador((prev) => ({
      ...prev,
      month,
      day: Math.min(prev.day, diasEnMes(prev.year, month)),
    }));
  };

  const seleccionarDia = (day: number) => {
    setBorrador((prev) => ({ ...prev, day }));
  };

  const aceptar = () => {
    onChange(new Date(borrador.year, borrador.month, borrador.day));
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Surface style={[styles.surface, { backgroundColor: theme.colors.surface }]} elevation={3}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
            {title}
          </Text>
          <View style={styles.wheels}>
            <View style={styles.wheelColumn}>
              <Wheel
                items={anios}
                selectedValue={borrador.year}
                onSelect={seleccionarAnio}
              />
            </View>
            <View style={styles.wheelColumn}>
              <Wheel
                items={meses}
                selectedValue={borrador.month}
                onSelect={seleccionarMes}
              />
            </View>
            <View style={styles.wheelColumn}>
              <Wheel
                items={dias}
                selectedValue={borrador.day}
                onSelect={seleccionarDia}
              />
            </View>
          </View>
          <View style={styles.actions}>
            <Button onPress={onDismiss}>Cancelar</Button>
            <Button mode="contained" onPress={aceptar}>
              Aceptar
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  surface: {
    borderRadius: 16,
    padding: 16,
  },
  wheels: {
    flexDirection: 'row',
    gap: 8,
  },
  wheelColumn: {
    flex: 1,
  },
  wheel: {
    height: WHEEL_HEIGHT,
  },
  wheelContent: {
    paddingVertical: WHEEL_PADDING,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
});
