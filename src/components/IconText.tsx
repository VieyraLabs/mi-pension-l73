/**
 * Línea de estado: icono vectorial + texto, en una sola fila.
 *
 * Sustituye a los prefijos de emoji (✓ ⚠️ ✏️) que dependían de la fuente de
 * emojis del sistema y se renderizaban distinto en iOS, Android y web. El
 * icono es MaterialCommunityIcons (el set por defecto de React Native Paper),
 * por lo que se ve idéntico en las tres plataformas y sigue el tema de color.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface IconTextProps {
  /** Nombre del icono de MaterialCommunityIcons. */
  icon: IconName;
  /** Color del icono y del texto (compartido por defecto). */
  color: string;
  /** Tamaño del icono (default 16). */
  size?: number;
  /** Variante tipográfica de Paper para el texto (default bodySmall). */
  variant?: React.ComponentProps<typeof Text>['variant'];
  /** Estilo extra del texto. */
  style?: StyleProp<TextStyle>;
  /** Estilo extra del contenedor de la fila. */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function IconText({
  icon,
  color,
  size = 16,
  variant = 'bodySmall',
  style,
  containerStyle,
  children,
}: IconTextProps) {
  return (
    <View style={[styles.row, containerStyle]}>
      <MaterialCommunityIcons name={icon} size={size} color={color} style={styles.icon} />
      <Text variant={variant} style={[{ color, flex: 1 }, style]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { marginTop: 3, marginRight: 6 },
});
