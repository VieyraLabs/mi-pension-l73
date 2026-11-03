/**
 * Pantalla principal (Dashboard) de la aplicación.
 * Muestra tarjetas de acceso rápido a las funcionalidades principales.
 */
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenHeader } from '../components/ScreenHeader';
import { ESTIMATION_DISCLAIMER_SHORT } from '../constants/infoLegal';
import { BRAND_ON_COLOR } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DashboardCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const cards: DashboardCard[] = [
    {
      id: 'pdf',
      title: 'Importar Constancia IMSS',
      description: 'Carga tu constancia de semanas cotizadas en PDF y extrae los datos automáticamente',
      icon: 'file-pdf-box',
      onPress: () => navigation.navigate('PdfImport'),
    },
    {
      id: 'manual',
      title: 'Ingresar datos manualmente',
      description: 'Calcula tu pensión estimada paso a paso con todos los detalles',
      icon: 'calculator-variant',
      onPress: () => navigation.navigate('NewSimulation'),
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <ScreenHeader
        title="Mi Pensión L73"
        subtitle="Calculadora de Pensión IMSS Ley 73"
      >
        <View style={styles.headerBadge}>
          <View style={styles.headerBadgeRow}>
            <MaterialCommunityIcons name="alert" size={14} color={BRAND_ON_COLOR} />
            <Text variant="labelSmall" style={{ color: BRAND_ON_COLOR, marginLeft: 4 }}>
              {ESTIMATION_DISCLAIMER_SHORT}
            </Text>
          </View>
        </View>
      </ScreenHeader>

      {/* Tarjetas principales */}
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
        Nuevo Cálculo
      </Text>

      {cards.map((card) => (
        <Card
          key={card.id}
          onPress={card.onPress}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
          elevation={1}
        >
          <Card.Content style={styles.cardContent}>
            <View style={[styles.cardIconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name={card.icon} size={26} color={theme.colors.onPrimaryContainer} />
            </View>
            <View style={styles.cardTextContainer}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                {card.title}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {card.description}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
          </Card.Content>
        </Card>
      ))}

      {/* Nota legal */}
      <MessageBanner variant="warning" title="Aviso Legal" style={styles.legalCard}>
        Esta aplicación proporciona ESTIMACIONES con fines informativos únicamente.
        Los cálculos se basan en la Ley del Seguro Social de 1973 y valores de referencia (UMA, SMG).
        La resolución oficial de su pensión corresponde exclusivamente al IMSS.
        Acuda a su Subdelegación del IMSS para información precisa y oficial.
      </MessageBanner>

      {/* Info adicional */}
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
        ¿Qué calcula esta app?
      </Text>
      <Card style={[styles.infoCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Content>
          {[
            'Cuantía básica según tabla Art. 167 LSS 1973',
            'Incrementos anuales por semanas excedentes',
            'Incremento del 11% (Decreto DOF 2001/2004)',
            'Factor por edad (Cesantía 60–64 años)',
            'Asignaciones familiares (cónyuge, hijos)',
            'Ayuda asistencial',
            'Pensión Mínima Garantizada',
            'Tope 25 UMA',
            'Ajuste por Modalidad 10',
          ].map((item, i) => (
            <View key={i} style={styles.checkItem}>
              <MaterialCommunityIcons name="check" size={16} color={theme.colors.primary} style={styles.checkIcon} />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurface, lineHeight: 22, flex: 1 }}>
                {item}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  headerBadge: {
    marginTop: 14,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start' },
  checkIcon: { marginTop: 3, marginRight: 8 },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContainer: { flex: 1 },
  legalCard: {
    marginBottom: 20,
    marginTop: 8,
    borderRadius: 16,
  },
  infoCard: {
    borderRadius: 16,
    marginBottom: 20,
  },
});
