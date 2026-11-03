/**
 * Paso 4 del formulario de nueva simulación: Modalidad 10
 * (incorporación voluntaria al régimen obligatorio).
 *
 * Comparte paso con la UMA. Muestra el SBC declarado, su equivalente en UMAs,
 * si la persona sigue trabajando mientras cotiza, el costo mensual estimado y
 * los meses proyectados (derivados, no editables).
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  HelperText,
  Icon,
  Portal,
  RadioButton,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { MD3Theme } from 'react-native-paper';
import type { Modalidad10, SalaryZone } from '../models';
import { MODALIDAD_10_RISK_CLASS_LABELS } from '../constants/ley73';
import {
  M10_OCCUPATION_CATALOG,
  getOccupationDivision,
  resolveRiskClass,
} from '../constants/ocupaciones';
import { BRAND_ON_COLOR, getBrandGradient } from '../theme';
import { formatCurrency, formatPercent, round2 } from '../utils/format';
import { calculateM10MonthlyBreakdown, m10SalaryRange } from '../utils/modalidad10';
import { DataRow } from './DataRow';
import { UMAStepper } from './UMAStepper';

export interface Modalidad10StepProps {
  modalidad10: Modalidad10;
  /** Actualiza los campos generales (activación, incremento, si sigue trabajando). */
  onChange: (data: Partial<Modalidad10>) => void;
  /** Fija el SBC diario declarado. */
  onChangeSalary: (dailySalary: number) => void;
  /** Fija el número de UMAs. */
  onChangeUMAs: (umas: number) => void;
  /** UMA diaria vigente. */
  dailyUMA: number;
  /** Año de la UMA vigente: fija la columna de la tabla de cesantía y vejez. */
  umaYear: number;
  /** Salario mínimo de la zona geográfica elegida (piso del SBC). */
  minimumDailySalary: number;
  theme: MD3Theme;
}

export function Modalidad10Step({
  modalidad10,
  onChange,
  onChangeSalary,
  onChangeUMAs,
  dailyUMA,
  umaYear,
  minimumDailySalary,
  theme,
}: Modalidad10StepProps) {
  const range = m10SalaryRange(dailyUMA, minimumDailySalary);
  const salary = modalidad10.contributionSalary ?? range.minimumDailySalary;
  const umas = modalidad10.contributionSalaryInUMAs ?? range.minimumUMAs;
  const salaryZone = modalidad10.salaryZone ?? 'general';
  const riskClass = modalidad10.riskClass ?? 1;
  const costBreakdown = calculateM10MonthlyBreakdown({
    dailySalary: salary,
    riskClass,
    dailyUMA,
    minimumDailySalary,
    year: umaYear,
  });
  const selectedDivision = getOccupationDivision(modalidad10.occupationDivision);
  const months = modalidad10.expectedMonths ?? 0;

  const handleSelectDivision = (code: string) =>
    onChange({ occupationDivision: code, occupationGroup: undefined, riskClass: undefined });
  const handleSelectGroup = (code: string) => {
    const resolved = resolveRiskClass(modalidad10.occupationDivision, code);
    onChange({ occupationGroup: code, riskClass: resolved });
  };
  const handleSelectZone = (zone: SalaryZone) => onChange({ salaryZone: zone });

  // El monto se escribe como lo captura la persona; el texto se sincroniza
  // cuando el valor cambia desde afuera.
  const [salaryDraft, setSalaryDraft] = useState(() => String(round2(salary)));
  useEffect(() => {
    if (Number.parseFloat(salaryDraft) === salary) return;
    setSalaryDraft(String(round2(salary)));
  }, [salary, salaryDraft]);

  const handleSalaryChangeText = (text: string) => {
    setSalaryDraft(text);
    const parsed = Number.parseFloat(text);
    if (!Number.isNaN(parsed)) onChangeSalary(parsed);
  };

  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
          Modalidad 10 (opcional)
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
          Art. 222 LSS vigente — incorporación voluntaria al régimen obligatorio: sigues
          cotizando con un SBC entre el salario mínimo de tu zona y 25 UMA.
        </Text>

        {/* Toda la fila es táctil: el switch solo es la tira pequeña. */}
        <TouchableOpacity
          onPress={() => onChange({ active: !modalidad10.active })}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={getBrandGradient(theme.dark)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.m10Toggle, modalidad10.active ? {} : { opacity: 0.55 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {modalidad10.active && (
                <Icon source="check-circle" size={18} color={BRAND_ON_COLOR} />
              )}
              <Text variant="bodyMedium" style={{ color: BRAND_ON_COLOR, fontWeight: 'bold', flex: 1, marginLeft: modalidad10.active ? 8 : 0 }}>
                {modalidad10.active ? 'Cotizando en Modalidad 10' : '¿Deseas cotizar en Modalidad 10? Toca aquí'}
              </Text>
            </View>
            <Switch
              value={modalidad10.active}
              onValueChange={(v) => onChange({ active: v })}
            />
          </LinearGradient>
        </TouchableOpacity>

        {modalidad10.active && (
          <>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <TextInput
                  label="Salario de cotización M10 (diario, MXN) *"
                  value={salaryDraft}
                  onChangeText={handleSalaryChangeText}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.field}>
                <UMAStepper
                  value={umas}
                  min={range.minimumUMAs}
                  max={range.maximumUMAs}
                  onChange={onChangeUMAs}
                />
              </View>
            </View>
            <HelperText type="info" style={{ marginBottom: 12 }}>
              Rango legal (Art. 28 LSS vigente): mínimo {formatCurrency(range.minimumDailySalary)}/día
              {' '}(salario mínimo de tu zona = {range.minimumUMAs} UMA) y máximo {range.maximumUMAs} UMA
              {' '}({formatCurrency(range.maximumDailySalary)}/día).
            </HelperText>

            <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginBottom: 6 }}>
              Ocupación y clase de riesgo
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
              Tu clase de riesgo (I–V) determina la prima de Riesgos de Trabajo. Elige la
              división y el grupo que correspondan a tu actividad: es el mismo catálogo
              que usa el IMSS para calcular tu cuota.
            </Text>

            <Text variant="labelMedium" style={styles.fieldLabel}>División</Text>
            <OptionSelector
              label="División"
              placeholder="Selecciona una opción"
              value={modalidad10.occupationDivision}
              options={M10_OCCUPATION_CATALOG.map((d) => ({ value: d.code, label: d.name }))}
              onSelect={handleSelectDivision}
              theme={theme}
            />

            {selectedDivision && (
              <>
                <Text variant="labelMedium" style={styles.fieldLabel}>Grupo principal</Text>
                <OptionSelector
                  label="Grupo principal"
                  placeholder="Selecciona una opción"
                  value={modalidad10.occupationGroup}
                  options={selectedDivision.groups.map((g) => ({ value: g.code, label: g.name }))}
                  onSelect={handleSelectGroup}
                  theme={theme}
                />
              </>
            )}

            <Text variant="labelMedium" style={styles.fieldLabel}>Zona geográfica</Text>
            <SegmentedButtons
              value={salaryZone}
              onValueChange={(v) => handleSelectZone(v as SalaryZone)}
              buttons={[
                { value: 'general', label: 'Resto del país' },
                { value: 'frontera_norte', label: 'Frontera Norte' },
              ]}
              style={{ marginBottom: 8 }}
            />
            <HelperText type="info" style={{ marginBottom: 12 }}>
              Determina el salario mínimo que sirve de piso del SBC declarado.
              {salaryZone === 'frontera_norte' ? ' Frontera Norte usa un salario mínimo mayor.' : ''}
            </HelperText>

            <View style={styles.switchRow}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
                ¿Continúas trabajando mientras citas en Modalidad 10?
              </Text>
              <Switch
                value={modalidad10.continuesWorkingWhileContributing ?? true}
                onValueChange={(v) => onChange({ continuesWorkingWhileContributing: v })}
              />
            </View>
            <HelperText type="info" style={{ marginBottom: 12 }}>
              {modalidad10.continuesWorkingWhileContributing ?? true
                ? 'Se suma tu último salario registrado al SBC de la Modalidad 10 en el SBC promedio proyectado.'
                : 'Solo se usa el salario de la Modalidad 10 en el SBC promedio proyectado.'}
            </HelperText>

            <DataRow
              label="Costo mensual de la Modalidad 10"
              value={`${formatCurrency(costBreakdown.total)}/mes`}
              theme={theme}
              highlight
              prominent
            />
            <DataRow
              label="Tasa efectiva sobre el SBC declarado"
              value={formatPercent(costBreakdown.effectivePct * 100)}
              theme={theme}
            />
            <DataRow
              label={`Prima de Riesgos de Trabajo (${MODALIDAD_10_RISK_CLASS_LABELS[riskClass]}, ${formatPercent(costBreakdown.riskPrimaPct * 100)})`}
              value={`${formatCurrency(costBreakdown.riesgosTrabajo)}/mes`}
              theme={theme}
            />
            <HelperText type="info" style={{ marginBottom: 12 }}>
              Cuota calculada con la estructura de financiamiento oficial del IMSS (Cuadro A.3
              del Anexo A al Informe del Consejo Técnico 2025-2026), sin la aportación
              opcional a INFONAVIT (5 % del SBC). Cesantía y vejez: {costBreakdown.cesantiaBandLabel}
              {' '}({formatPercent(costBreakdown.cesantiaPct)}). La clase de riesgo es la que el
              IMSS asigna al grupo elegido en el catálogo oficial de ocupaciones.
            </HelperText>

            <DataRow
              label="Meses cotizando en M10 (proyectados)"
              value={`${months} ${months === 1 ? 'mes' : 'meses'}`}
              theme={theme}
              highlight
              prominent
            />
            <HelperText type="info" style={{ marginBottom: 12 }}>
              M10 va del día 1 del mes siguiente a hoy hasta el último día del mes de retiro,
              ambos inclusive.
            </HelperText>

            <TextInput
              label="Incremento salarial anual esperado (%) — opcional"
              value={
                modalidad10.annualSalaryIncrease != null
                  ? String(modalidad10.annualSalaryIncrease)
                  : ''
              }
              onChangeText={(v) => {
                const n = parseFloat(v);
                if (!isNaN(n)) onChange({ annualSalaryIncrease: n });
              }}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: -4, marginBottom: 8 }}>
              Ejemplo: si esperas que el salario de cotización M10 crezca ~5% cada año…
            </Text>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

/**
 * Selector de una sola opción: un campo con la elección actual que abre un
 * diálogo con la lista completa de opciones.
 *
 * Los nombres del catálogo oficial son largos —«Trabajadores en actividades
 * agrícolas, ganaderas, forestales, caza y pesca»— y tanto las etiquetas de
 * chip como las de `Menu.Item` los recortan a una sola línea: dos divisiones
 * empiezan igual, así que quedarían indistinguibles. En el diálogo cada
 * opción se muestra entera.
 */
function OptionSelector({
  label,
  placeholder,
  value,
  options,
  onSelect,
  theme,
}: {
  label: string;
  placeholder: string;
  /** Valor de la opción elegida, si la hay. */
  value?: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  theme: MD3Theme;
}) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <TouchableRipple
        onPress={() => setVisible(true)}
        borderless
        accessibilityRole="button"
        accessibilityLabel={`Seleccionar ${label}`}
        accessibilityState={{ expanded: visible }}
      >
        <View
          style={[
            styles.selector,
            { borderColor: theme.colors.outline },
          ]}
        >
          <Text
            variant="bodyMedium"
            style={{
              flex: 1,
              color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
            }}
          >
            {selected?.label ?? placeholder}
          </Text>
          <Icon source="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>

      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>{label}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              <RadioButton.Group
                value={value ?? ''}
                onValueChange={(v) => {
                  onSelect(v);
                  setVisible(false);
                }}
              >
                {options.map((option) => (
                  <RadioButton.Item key={option.value} value={option.value} label={option.label} />
                ))}
              </RadioButton.Group>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  input: { marginBottom: 12 },
  /** Fila con el SBC declarado y su equivalente en UMAs. */
  fieldRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  field: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  /** Campo selector: caja con la opción elegida y el chevron. */
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  dialogScrollArea: { maxHeight: 320, paddingHorizontal: 0 },
  fieldLabel: { marginBottom: 6 },
  m10Toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
});
