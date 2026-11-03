/**
 * Fila etiqueta/valor con resaltado opcional (usada en HistoryScreen).
 */
import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

export interface DataRowProps {
  label: string;
  value: string;
  theme: MD3Theme;
  highlight?: boolean;
  prominent?: boolean;
}

export function DataRow({ label, value, theme, highlight, prominent }: DataRowProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
      <Text
        variant={prominent ? 'titleMedium' : 'bodySmall'}
        style={{
          color: highlight ? theme.colors.primary : theme.colors.onSurface,
          fontWeight: highlight ? 'bold' : 'normal',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
