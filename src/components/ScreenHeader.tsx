/**
 * Encabezado de pantalla con degradado de marca.
 * Unifica el patrón Surface+primary que repetían Dashboard, Info, FAQ,
 * PdfImport: un solo lugar decide el degradado, el radio y el
 * espaciado. Los colores siempre salen del tema (ver ADR-0008).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { getBrandGradient, BRAND_ON_COLOR } from '../theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Contenido extra sobre el degradado (chips, avisos cortos). */
  children?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, children }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={getBrandGradient(theme.dark)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <Text variant="headlineMedium" style={[styles.title, { color: BRAND_ON_COLOR }]}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="bodyMedium" style={[styles.subtitle, { color: BRAND_ON_COLOR }]}>
          {subtitle}
        </Text>
      )}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.92,
  },
});
