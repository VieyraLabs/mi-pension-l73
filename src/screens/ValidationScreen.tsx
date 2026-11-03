/**
 * Pantalla de validación de datos importados desde PDF.
 * Permite al usuario revisar y corregir los datos extraídos.
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, TextInput, useTheme, Divider, Chip, List } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ConstanciaIMSSParser } from '../services/pdf/parsers/PersonalDataParser';
import { DataRow } from '../components/DataRow';
import { DateField } from '../components/DateField';
import { IconText } from '../components/IconText';
import { DEFAULT_BIRTH_DATE } from '../hooks/usePensionForm';
import { formatCurrency, formatDateShort } from '../utils/format';
import type { ContributionSummary, SBCPeriodSegment } from '../services/pension/history/types';
import { showAlert } from '../utils/alert';
import { BUTTON_RADIUS, getBannerColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Validation'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Interpreta una fecha «AAAA-MM-DD» como fecha LOCAL (sin desfase de zona
 * horaria); undefined si falta, está incompleta o es inválida.
 */
function fechaDesdeIso(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const partes = iso.split('-').map(Number);
  const fecha = new Date(partes[0]!, partes[1]! - 1, partes[2]!);
  return isNaN(fecha.getTime()) ? undefined : fecha;
}

/** Formatea una fecha local como «AAAA-MM-DD» sin depender de la zona horaria. */
function fechaAIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export default function ValidationScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();
  const { extractedText } = route.params;

  const [data, setData] = useState({
    name: '',
    curp: '',
    nss: '',
    totalWeeks: '',
    averageSBC: '',
    lastSBC: '',
    birthDate: '',
  });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  /** Detalle del SBC promedio reconstruido por el parser; null si la constancia no trae historial detallado. */
  const [sbcDetail, setSbcDetail] = useState<{ segments: SBCPeriodSegment[]; summary: ContributionSummary } | null>(null);

  const warningColors = getBannerColors('warning', theme.dark);
  const errorColors = getBannerColors('error', theme.dark);

  useEffect(() => {
    const result = ConstanciaIMSSParser.parse(extractedText);
    if (result.ok && result.data) {
      const d = result.data;
      setData({
        name: d.name ?? '',
        curp: d.curp ?? '',
        nss: d.nss ?? '',
        totalWeeks: d.totalWeeks ? String(d.totalWeeks) : '',
        averageSBC: d.averageSBC ? String(d.averageSBC) : '',
        lastSBC: d.lastSBC ? String(d.lastSBC) : '',
        birthDate: d.birthDate ? d.birthDate.toISOString().split('T')[0] ?? '' : '',
      });
      setWarnings(result.warnings);
      setMissingFields(result.missingFields);
      // Se muestra tal cual lo calculó el parser (misma fuente de verdad que averageSBC);
      // la UI nunca recalcula el promedio.
      setSbcDetail(
        d.sbcPeriods && d.sbcPeriods.length > 0 && d.contributionSummary
          ? { segments: d.sbcPeriods, summary: d.contributionSummary }
          : null,
      );
    }
  }, [extractedText]);

  const confirmData = () => {
    if (!data.totalWeeks || parseInt(data.totalWeeks) <= 0) {
      showAlert('Error', 'Por favor ingresa el número de semanas cotizadas.');
      return;
    }

    const totalWeeks = parseInt(data.totalWeeks);
    const averageSBC = data.averageSBC ? parseFloat(data.averageSBC) : undefined;
    const lastSBC = data.lastSBC ? parseFloat(data.lastSBC) : undefined;

    showAlert(
      'Datos listos',
      'Tu formulario de nueva simulación se precargará con estos datos. Revisa cada paso antes de calcular tu pensión.',
      [
        {
          text: 'Continuar',
          onPress: () =>
            navigation.navigate('NewSimulation', {
              importedData: {
                name: data.name || undefined,
                birthDate: data.birthDate || undefined,
                totalWeeks: !isNaN(totalWeeks) ? totalWeeks : undefined,
                averageSBC: averageSBC && !isNaN(averageSBC) ? averageSBC : undefined,
                lastSBC: lastSBC && !isNaN(lastSBC) ? lastSBC : undefined,
                sbcPeriods: sbcDetail?.segments.map(({ startDate, endDate, ...period }) => ({
                  ...period,
                  startDate: startDate.toISOString(),
                  endDate: endDate.toISOString(),
                })),
              },
            }),
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Advertencias */}
      {warnings.length > 0 && (
        <Card style={[styles.card, { backgroundColor: warningColors.background }]} elevation={0}>
          <Card.Title title="Notas de extracción" titleVariant="titleSmall" />
          <Card.Content>
            {warnings.map((warning, i) => (
              <Text key={i} variant="bodySmall" style={{ color: warningColors.text, lineHeight: 18, marginBottom: 4 }}>
                • {warning}
              </Text>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Campos faltantes */}
      {missingFields.length > 0 && (
        <Card style={[styles.card, { backgroundColor: errorColors.background }]} elevation={0}>
          <Card.Content>
            <IconText icon="alert" color={errorColors.text} variant="labelSmall" containerStyle={{ marginBottom: 8 }}>
              Campos no encontrados en el PDF (completa manualmente):
            </IconText>
            <View style={styles.chips}>
              {missingFields.map((field) => (
                <Chip
                  key={field}
                  compact
                  style={{ backgroundColor: theme.colors.errorContainer }}
                  textStyle={{ color: theme.colors.onErrorContainer }}
                >
                  {field}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Datos personales */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Title title="Datos personales extraídos" titleVariant="titleMedium" />
        <Divider />
        <Card.Content style={{ paddingTop: 12 }}>
          <TextInput label="Nombre completo" value={data.name} onChangeText={(v) => setData({ ...data, name: v })} mode="outlined" style={styles.input} />
          <TextInput label="CURP" value={data.curp} onChangeText={(v) => setData({ ...data, curp: v })} mode="outlined" style={styles.input} autoCapitalize="characters" />
          <TextInput label="NSS (Número de Seguridad Social)" value={data.nss} onChangeText={(v) => setData({ ...data, nss: v })} mode="outlined" style={styles.input} keyboardType="numeric" />
          {/* La fecha no se escribe a mano: se elige con el calendario
              (DateField); el valor interno sigue siendo «AAAA-MM-DD». */}
          <DateField
            label="Fecha de nacimiento"
            value={fechaDesdeIso(data.birthDate)}
            fallbackDate={DEFAULT_BIRTH_DATE}
            onConfirm={(fecha) => setData({ ...data, birthDate: fechaAIso(fecha) })}
            theme={theme}
          />
        </Card.Content>
      </Card>

      {/* Datos de cotización */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Title title="Datos de cotización" titleVariant="titleMedium" />
        <Divider />
        <Card.Content style={{ paddingTop: 12 }}>
          <TextInput
            label="Total de semanas cotizadas *"
            value={data.totalWeeks}
            onChangeText={(v) => setData({ ...data, totalWeeks: v })}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <DataRow
            label="Último SBC registrado (solo referencia, no es el promedio)"
            value={data.lastSBC ? formatCurrency(parseFloat(data.lastSBC)) : 'No disponible'}
            theme={theme}
            highlight
            prominent
          />
          <TextInput
            label="SBC promedio de las últimas 250 semanas (diario, MXN)"
            value={data.averageSBC}
            onChangeText={(v) => setData({ ...data, averageSBC: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          {data.averageSBC !== '' ? (
            <IconText icon="check-circle" color={theme.colors.onSurfaceVariant} containerStyle={{ marginTop: -8, marginBottom: 12 }}>
              Calculado a partir del historial detallado de modificaciones salariales de tus patrones. Verifícalo.
            </IconText>
          ) : (
            <IconText icon="alert" color={errorColors.text} containerStyle={{ marginTop: -8, marginBottom: 12 }}>
              Esta constancia no incluye el historial de modificaciones salariales necesario para calcularlo.
              Descarga la "Constancia de Semanas Cotizadas en el IMSS e Historial de Registros Afiliatorios de la
              Persona Asegurada" desde los servicios digitales del IMSS, o complétalo manualmente.
            </IconText>
          )}
          {sbcDetail && (
            <Text variant="bodySmall" style={{ color: theme.colors.primary, marginTop: -4, marginBottom: 12 }}>
              ↓ Despliega «Cómo se calculó tu SBC promedio» para auditar cómo se obtuvo este valor. Puedes corregirlo manualmente si lo deseas.
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Desglose auditable del SBC promedio reconstruido (solo con historial detallado) */}
      {sbcDetail && (
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <List.Accordion
            title={`Cómo se calculó tu SBC promedio (${sbcDetail.segments.length} ${sbcDetail.segments.length === 1 ? 'periodo' : 'periodos'})`}
            description={`${formatCurrency(sbcDetail.summary.averageSalary)}/día · ${sbcDetail.summary.selectedWeeks} de 250 semanas`}
          >
            <List.Subheader style={styles.sectionLabel}>Periodos SBC considerados en el promedio</List.Subheader>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8, lineHeight: 18 }}>
              Cuando tuviste más de un patrón a la vez, el SBC del periodo es la suma de ambos, pero las semanas cuentan una sola vez.
            </Text>
            {sbcDetail.segments.map((segment, i) => (
              <View key={`${segment.startDate.getTime()}-${i}`}>
                <DataRow
                  label={`${formatDateShort(segment.startDate)} – ${formatDateShort(segment.endDate)}`}
                  value={`${formatCurrency(segment.sbc)}/día`}
                  theme={theme}
                  highlight={segment.employers.length > 1}
                />
                {segment.employers.length > 1 ? (
                  <View style={{ marginBottom: 8 }}>
                    {segment.employers.map(({ employerName, sbc }, employerIndex) => (
                      <View key={`${employerIndex}-${employerName}-${sbc}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Text
                          variant="labelSmall"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{ color: theme.colors.onSurfaceVariant, flex: 1, minWidth: 0, marginRight: 8 }}
                        >
                          • {employerName}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurface, flexShrink: 0 }}>
                          {formatCurrency(sbc)}/día
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : segment.employerNames.length === 1 ? (
                  <View style={{ marginBottom: 8 }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {segment.employerNames[0]}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
            <Divider style={styles.innerDivider} />
            <List.Subheader style={styles.sectionLabel}>Resumen de las últimas 250 semanas cotizadas</List.Subheader>
            <DataRow
              label="Semanas usadas en el promedio"
              value={`${sbcDetail.summary.selectedWeeks} de 250`}
              theme={theme}
              highlight
            />
            <DataRow
              label="Semanas cotizadas del historial"
              value={String(sbcDetail.summary.contributedWeeks)}
              theme={theme}
            />
            <DataRow
              label="Semanas sin cotización en la ventana del promedio"
              value={String(sbcDetail.summary.skippedWeeks)}
              theme={theme}
            />
            <DataRow
              label="Ventana de fechas usada"
              value={`${formatDateShort(sbcDetail.summary.firstWeekUsed)} – ${formatDateShort(sbcDetail.summary.lastWeekUsed)}`}
              theme={theme}
            />
            {(!sbcDetail.summary.isComplete || sbcDetail.summary.skippedWeeks > 0) && (
              <View style={[styles.partialBanner, { backgroundColor: warningColors.background }]}>
                {!sbcDetail.summary.isComplete && (
                  <IconText icon="alert" color={warningColors.text} style={{ lineHeight: 18 }}>
                    Reconstrucción parcial: tu historial solo registra {sbcDetail.summary.contributedWeeks} semanas cotizadas de las 250 que exige el cálculo; el promedio se obtuvo con las disponibles.
                  </IconText>
                )}
                {sbcDetail.summary.skippedWeeks > 0 && (
                  <Text variant="bodySmall" style={{ color: warningColors.text, lineHeight: 18 }}>
                    Se omitieron {sbcDetail.summary.skippedWeeks} semanas sin cotización dentro de la ventana del promedio; no cuentan para el promedio.
                  </Text>
                )}
              </View>
            )}
          </List.Accordion>
        </Card>
      )}

      <IconText icon="pencil" color={theme.colors.onSurfaceVariant} containerStyle={{ marginBottom: 16 }} style={{ lineHeight: 18 }}>
        Revisa y corrige los datos extraídos. Los datos marcados con * son requeridos para el cálculo de la pensión.
      </IconText>

      <Button mode="contained" onPress={confirmData} icon="check" style={styles.btn}>
        Confirmar y continuar
      </Button>
      <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.btn}>
        Volver a importar
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 12, marginBottom: 16 },
  sectionLabel: { marginTop: 4 },
  innerDivider: { marginVertical: 8 },
  partialBanner: { borderRadius: 8, padding: 12, marginTop: 8, gap: 4 },
  input: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { marginBottom: 12, borderRadius: BUTTON_RADIUS },
});
