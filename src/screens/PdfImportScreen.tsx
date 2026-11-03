/**
 * Pantalla para importar la Constancia de Semanas Cotizadas del IMSS en PDF.
 */
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, useTheme, ActivityIndicator, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { BUTTON_RADIUS } from '../theme';
import { importPdf } from '../services/pdf/PdfImporter';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenHeader } from '../components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PdfImportScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectPdf = async () => {
    setProcessing(true);
    setError(null);
    try {
      const result = await importPdf();
      if (result.ok && result.data) {
        navigation.navigate('Validation', { extractedText: result.data.extractedText });
      } else {
        setError(result.error ?? 'No se pudo procesar el PDF.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar el PDF.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Importar Constancia IMSS"
        subtitle="Importa tu Constancia de Semanas Cotizadas en PDF para extraer los datos automáticamente"
      />

      {/* Instrucciones */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Title title="¿Cómo funciona?" titleVariant="titleMedium" />
        <Card.Content>
          {[
            '1. Descarga tu Constancia de Semanas Cotizadas desde el portal del IMSS (imss.gob.mx) — marca la casilla de incluir el "Historial de Registros Afiliatorios" para que traiga el detalle de modificaciones salariales; sin eso no se puede calcular tu SBC (Salario Base de Cotización) promedio automáticamente',
            '2. Selecciona el archivo PDF desde tu dispositivo',
            '3. La aplicación extrae los datos automáticamente',
            '4. Revisa y corrige la información extraída antes de calcular',
          ].map((step, i) => (
            <Text key={i} variant="bodySmall" style={{ color: theme.colors.onSurface, lineHeight: 22, marginBottom: 4 }}>
              {step}
            </Text>
          ))}
        </Card.Content>
      </Card>

      {/* Capacidades */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Title title="Datos que se extraen" titleVariant="titleSmall" />
        <Card.Content>
          <View style={styles.chips}>
            {['Nombre', 'CURP', 'NSS', 'Fecha de nacimiento', 'Semanas cotizadas', 'SBC', 'Historial laboral', 'Último patrón'].map((d) => (
              <Chip key={d} style={styles.chip} compact>{d}</Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Privacidad */}
      <MessageBanner variant="success" style={styles.card}>
        Procesamiento 100% local — Tu información NO se envía a ningún servidor externo. Todo el análisis del PDF se realiza en tu dispositivo.
      </MessageBanner>

      {/* Nota OCR */}
      <MessageBanner variant="warning" style={styles.card}>
        Para PDFs con texto seleccionable: extracción directa. Para PDFs escaneados (imagen): el OCR completo requiere un development build. En Expo Go, se solicita captura manual de los datos del PDF escaneado.
      </MessageBanner>

      {/* Error */}
      {error && (
        <MessageBanner variant="error" style={styles.card}>
          {error}
        </MessageBanner>
      )}

      {/* Botón principal */}
      {processing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onBackground, marginTop: 16 }}>
            Procesando PDF...
          </Text>
        </View>
      ) : (
        <Button
          mode="contained"
          onPress={selectPdf}
          icon="file-upload"
          style={styles.mainBtn}
          contentStyle={{ paddingVertical: 8 }}
        >
          Seleccionar PDF
        </Button>
      )}

      <Button
        mode="outlined"
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
      >
        Cancelar
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { marginBottom: 4 },
  loadingContainer: { alignItems: 'center', padding: 24 },
  mainBtn: { borderRadius: BUTTON_RADIUS, marginBottom: 12 },
  backBtn: { borderRadius: BUTTON_RADIUS },
});
