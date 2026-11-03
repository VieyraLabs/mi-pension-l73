/**
 * Pantalla de historial de simulaciones guardadas.
 */
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, IconButton, useTheme, ActivityIndicator, Divider, Portal, Dialog, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BUTTON_RADIUS } from '../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useHistory } from '../hooks/useHistory';
import { MAX_SIMULATIONS } from '../storage/simulationStorage';
import { formatAge, formatCurrency, formatDateLong, formatDateShort, formatInteger, formatTime, formatUMAs, formatWeeksTargetText, getWeeksLabel } from '../utils/format';
import { DataRow } from '../components/DataRow';
import { normalizeLocalCalendarDate } from '../utils/weeksProjection';
import { m10MonthlyCostFromInput } from '../utils/modalidad10';
import { isSamePerson } from '../services/pension/comparison/personIdentity';
import type { PersonIdentity } from '../services/pension/comparison/personIdentity';
import type { SavedSimulation } from '../models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Fecha de retiro guardada en la simulación (misma fuente que ResultScreen).
 * El storage JSON revive los campos Date del modelo como strings ISO.
 */
function getRetirementDate(personalData: { estimatedRetirementDate: Date | string }): Date {
  return normalizeLocalCalendarDate(
    new Date(personalData.estimatedRetirementDate as unknown as string),
  );
}

/** Fecha de nacimiento guardada (misma normalización que la fecha de retiro). */
function getBirthDate(personalData: { birthDate: Date | string }): Date {
  return normalizeLocalCalendarDate(
    new Date(personalData.birthDate as unknown as string),
  );
}

/**
 * Identidad de la persona de una simulación (DEC-018). El nombre de la persona
 * es la fuente principal; las simulaciones antiguas sin `name` en el input caen
 * a la etiqueta con la que se guardaron en el historial.
 */
function getPersonIdentity(sim: SavedSimulation): PersonIdentity {
  const personalData = sim.result.input.personalData;
  return {
    name: personalData.name ?? sim.name,
    birthDate: personalData.birthDate,
  };
}

/**
 * Resumen de la Modalidad 10 de una simulación: si está activa, las UMAs del
 * SBC declarado y, entre paréntesis, el costo mensual de contratarla (la misma
 * cifra que ResultScreen). Los registros anteriores a la captura en UMAs
 * conservan el "Sí" sin monto.
 */
function formatModalidad10Summary(sim: SavedSimulation): string {
  const { modalidad10, uma } = sim.result.input;
  if (!modalidad10.active) return 'No';

  const umas = modalidad10.contributionSalaryInUMAs;
  if (umas == null) return 'Sí';

  const { total } = m10MonthlyCostFromInput(modalidad10, uma);
  return `Sí · ${formatUMAs(umas)} UMA (${formatCurrency(total)}/mes)`;
}

export default function HistoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { simulations, loading, remove, clear } = useHistory();

  // Estado para los dialogs
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [simToDelete, setSimToDelete] = useState<{ id: string; name: string } | null>(null);
  const [clearDialogVisible, setClearDialogVisible] = useState(false);

  // Modo de comparación: marcar simulaciones para la tabla comparativa.
  const [comparing, setComparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const startComparing = () => {
    setSelectedIds([]);
    setComparing(true);
  };

  const exitComparing = () => {
    setComparing(false);
    setSelectedIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selected) => selected !== id) : [...prev, id],
    );
  };

  // La primera simulación marcada fija la persona: solo sus simulaciones son
  // seleccionables (RF-022 / DEC-018).
  const firstSelected = comparing
    ? simulations.find((sim) => sim.id === selectedIds[0])
    : undefined;

  const isBlocked = (sim: SavedSimulation): boolean =>
    firstSelected != null &&
    sim.id !== firstSelected.id &&
    !selectedIds.includes(sim.id) &&
    !isSamePerson(getPersonIdentity(firstSelected), getPersonIdentity(sim));

  const confirmCompare = () => {
    if (selectedIds.length < 2) return;
    navigation.navigate('MultiComparison', { simulationIds: selectedIds });
  };

  const handleDelete = (id: string, name: string) => {
    setSimToDelete({ id, name });
    setDeleteDialogVisible(true);
  };

  const confirmDelete = () => {
    if (simToDelete) {
      remove(simToDelete.id);
      setDeleteDialogVisible(false);
      setSimToDelete(null);
    }
  };

  const handleClear = () => {
    setClearDialogVisible(true);
  };

  const confirmClear = () => {
    clear();
    setClearDialogVisible(false);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onSurface, fontWeight: 'bold', flex: 1 }}
        >
          Historial de simulaciones ({simulations.length}/{MAX_SIMULATIONS})
        </Text>
        <View style={styles.headerActions}>
          {comparing ? (
            <Button onPress={exitComparing} compact>
              Cancelar
            </Button>
          ) : (
            <>
              {simulations.length >= 2 && (
                <Button onPress={startComparing} icon="compare" compact>
                  Comparar
                </Button>
              )}
              {simulations.length > 0 && (
                <Button onPress={handleClear} textColor={theme.colors.error} compact>
                  Limpiar todo
                </Button>
              )}
            </>
          )}
        </View>
      </View>

      {comparing && (
        <View style={[styles.compareHint, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Marca dos o más simulaciones de la misma persona para compararlas. Toca la tarjeta
            completa de cada simulación para seleccionarla.
          </Text>
        </View>
      )}

      {simulations.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={40} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 16 }}>
            No hay simulaciones guardadas.{'\n'}Crea tu primera simulación desde el inicio.
          </Text>
          <Button
            mode="contained"
            style={[styles.emptyBtn, { borderRadius: BUTTON_RADIUS }]}
            contentStyle={{ paddingVertical: 6 }}
            onPress={() => navigation.navigate('NewSimulation' as never)}
          >
            Nueva simulación
          </Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {simulations.map((sim) => {
            const isSelected = selectedIds.includes(sim.id);
            const blocked = isBlocked(sim);
            return (
            <Card
              key={sim.id}
              testID={`compare-card-${sim.id}`}
              // En modo comparación, tocar CUALQUIER parte de la tarjeta marca o
              // desmarca la simulación (el checkbox es solo el indicador visual).
              // Las de otra persona no reciben `onPress`: no son seleccionables.
              onPress={comparing && !blocked ? () => toggleSelection(sim.id) : undefined}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface },
                blocked && styles.cardBlocked,
                comparing && isSelected && { borderWidth: 2, borderColor: theme.colors.primary },
              ]}
              elevation={comparing && isSelected ? 3 : 1}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  {comparing && (
                    <Checkbox
                      status={isSelected ? 'checked' : 'unchecked'}
                      onPress={() => toggleSelection(sim.id)}
                      disabled={blocked}
                      testID={`compare-select-${sim.id}`}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                      {sim.name}
                    </Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatDateShort(new Date(sim.creationDate))} · {formatTime(new Date(sim.creationDate))}
                    </Text>
                  </View>
                  {!comparing && (
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <IconButton
                        icon="eye-outline"
                        iconColor={theme.colors.primary}
                        size={20}
                        accessibilityLabel="Ver simulación"
                        onPress={() => navigation.navigate('Result', { simulationId: sim.id })}
                      />
                      <IconButton
                        icon="delete-outline"
                        iconColor={theme.colors.error}
                        size={20}
                        accessibilityLabel="Eliminar simulación"
                        onPress={() => handleDelete(sim.id, sim.name)}
                      />
                    </View>
                  )}
                </View>
                {blocked && (
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    testID={`compare-blocked-${sim.id}`}
                  >
                    Es otra persona (nació el {formatDateLong(getBirthDate(sim.result.input.personalData))})
                  </Text>
                )}
                <View style={[styles.pensionBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                    {formatCurrency(sim.result.monthlyPension)}/mes
                  </Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.cardData}>
                  <DataRow
                    label="Fecha de retiro"
                    value={`${formatDateLong(getRetirementDate(sim.result.input.personalData))} (${formatAge(sim.result.input.personalData.retirementAge)} años)`}
                    theme={theme}
                  />
                  {/* La etiqueta y el valor de proyección se comparten con
                      ResultScreen y el PDF. Los registros históricos sin
                      proyección conservan como valor las semanas capturadas. */}
                  <DataRow
                    label={getWeeksLabel(sim.result.weeksProjection)}
                    value={
                      sim.result.weeksProjection
                        ? formatWeeksTargetText(
                            sim.result.weeksProjection,
                            sim.result.input.personalData.retirementAge,
                          )
                        : `${formatInteger(sim.result.input.workHistory.totalWeeks)} sem.`
                    }
                    theme={theme}
                  />
                  <DataRow
                    label="SBC proyectado (diario)"
                    value={formatCurrency(
                      sim.result.input.projectedAverageDailySalary ?? sim.result.input.averageSalary.dailySalary,
                    )}
                    theme={theme}
                  />
                  <DataRow label="Modalidad 10" value={formatModalidad10Summary(sim)} theme={theme} />
                </View>
              </Card.Content>
            </Card>
            );
          })}
        </ScrollView>
      )}

      {comparing && simulations.length > 0 && (
        <View
          style={[
            styles.compareFooter,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant },
          ]}
        >
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
            {selectedIds.length} seleccionada{selectedIds.length === 1 ? '' : 's'}
          </Text>
          <Button
            mode="contained"
            onPress={confirmCompare}
            disabled={selectedIds.length < 2}
            style={{ borderRadius: BUTTON_RADIUS }}
            accessibilityLabel="Comparar simulaciones seleccionadas"
          >
            Comparar
          </Button>
        </View>
      )}

      {/* Dialog para eliminar simulación individual */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)} style={{ backgroundColor: theme.colors.surface, borderRadius: 20 }}>
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Eliminar simulación</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              ¿Deseas eliminar "{simToDelete?.name}"?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancelar</Button>
            <Button onPress={confirmDelete} textColor={theme.colors.error}>Eliminar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog para limpiar todo el historial */}
      <Portal>
        <Dialog visible={clearDialogVisible} onDismiss={() => setClearDialogVisible(false)} style={{ backgroundColor: theme.colors.surface, borderRadius: 20 }}>
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Limpiar historial</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              ¿Deseas eliminar todas las simulaciones guardadas?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setClearDialogVisible(false)}>Cancelar</Button>
            <Button onPress={confirmClear} textColor={theme.colors.error}>Limpiar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBtn: { marginTop: 24 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compareHint: { paddingHorizontal: 16, paddingVertical: 10 },
  compareFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cardBlocked: { opacity: 0.45 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, elevation: 2 },
  list: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  pensionBadge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  cardData: { gap: 2 },
});
