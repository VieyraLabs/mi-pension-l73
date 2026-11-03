/**
 * Banner de mensaje reutilizable (aviso/éxito/error/info).
 * Reemplaza los bloques `<Card style={{backgroundColor: ...}}>` con hex
 * hardcodeado que cada pantalla repetía a mano, con emoji y colores
 * inconsistentes entre sí.
 *
 * Soporta modo oscuro: el color de fondo y de texto se adaptan al `theme.dark`.
 * El icono de estado es vectorial (MaterialCommunityIcons) en lugar de emoji:
 * se renderiza igual en iOS, Android y web y no depende de la fuente de emojis
 * del sistema.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getBannerColors } from '../theme';

export type MessageBannerVariant = 'warning' | 'success' | 'error' | 'info';

const ICON_BY_VARIANT: Record<
  MessageBannerVariant,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  warning: 'alert',
  success: 'check-circle',
  error: 'close-circle',
  info: 'information',
};

export interface MessageBannerProps {
  variant: MessageBannerVariant;
  children: React.ReactNode;
  /** Título opcional antes del cuerpo del mensaje. */
  title?: string;
  style?: object;
}

export function MessageBanner({ variant, children, title, style }: MessageBannerProps) {
  const theme = useTheme();
  const colors = getBannerColors(variant, theme.dark);

  return (
    <Card style={[{ backgroundColor: colors.background, borderRadius: 12, marginBottom: 16 }, style]} elevation={0}>
      <Card.Content style={styles.content}>
        <MaterialCommunityIcons
          name={ICON_BY_VARIANT[variant]}
          size={20}
          color={colors.text}
          style={styles.icon}
        />
        <View style={styles.body}>
          {title && (
            <Text variant="titleSmall" style={[styles.title, { color: colors.text }]}>
              {title}
            </Text>
          )}
          <Text variant="bodySmall" style={{ color: colors.text, lineHeight: 18 }}>
            {children}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { marginTop: 2, marginRight: 10 },
  body: { flex: 1 },
  title: { fontWeight: '600', marginBottom: 2 },
});
