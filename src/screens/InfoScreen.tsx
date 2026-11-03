/**
 * Pantalla informativa sobre la Ley 73 y conceptos relacionados.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, Card, List, useTheme, Divider, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { BUTTON_RADIUS } from '../theme';
import { INFO_LEY73 } from '../constants/infoLegal';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenHeader } from '../components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function InfoScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Información Ley 73"
        subtitle="Todo lo que necesitas saber sobre la Ley del Seguro Social de 1973"
      />

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Content>
          {INFO_LEY73.map((section) => (
            <List.Accordion
              key={section.id}
              title={section.title}
              expanded={expanded === section.id}
              onPress={() => setExpanded(expanded === section.id ? null : section.id)}
              titleStyle={{ color: theme.colors.onSurface, fontWeight: 'bold', fontSize: 14 }}
              style={{ backgroundColor: 'transparent' }}
            >
              <Divider />
              {section.content.map((paragraph, i) => (
                <Text
                  key={i}
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurface, lineHeight: 20, marginVertical: 6, paddingHorizontal: 16 }}
                >
                  {paragraph}
                </Text>
              ))}
              {section.source && (
                <Text variant="labelSmall" style={{ color: theme.colors.primary, marginTop: 8, paddingHorizontal: 16, fontStyle: 'italic' }}>
                  Fuente: {section.source}
                </Text>
              )}
              <Divider style={{ marginTop: 8 }} />
            </List.Accordion>
          ))}
        </Card.Content>
      </Card>

      <MessageBanner variant="warning" style={styles.card}>
        La información presentada es de carácter educativo e informativo. Para obtener asesoría oficial sobre tu pensión, acude a la Subdelegación del IMSS correspondiente o consulta el portal imss.gob.mx.
      </MessageBanner>

      {/* Botón FAQ */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: 'bold', marginBottom: 4 }}>
            ¿Tienes más preguntas?
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
            Consulta las Preguntas Frecuentes en la sección FAQ.
          </Text>
          <Button mode="contained" onPress={() => navigation.navigate('FAQ')} style={{ borderRadius: BUTTON_RADIUS }} icon="help-circle">
            Ver Preguntas Frecuentes
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, marginBottom: 16 },
});
