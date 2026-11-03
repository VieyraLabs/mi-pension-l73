/**
 * Pantalla de nueva simulación — formulario por pasos (stepper).
 * Reúne todos los datos necesarios para calcular la pensión.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { BUTTON_RADIUS } from '../theme';
import { usePensionForm } from '../hooks/usePensionForm';
import { StepProgress } from '../components/StepProgress';
import { calculatePension, validateInput } from '../services/pension/PensionCalculator';
import { calculateProjectedSBC } from '../services/pension/history/projectedSBC';
import { getLastRegisteredDailySalary } from '../services/pension/history/contributionHistory';
import { buildM10ContributionPeriod } from '../utils/modalidad10';
import { getMinimumDailySalary } from '../constants/uma';
import { useHistory } from '../hooks/useHistory';
import { showAlert } from '../utils/alert';
import { getLocalReferenceDate } from '../utils/weeksProjection';
import { MessageBanner } from '../components/MessageBanner';
import { PersonalDataStep } from '../components/PersonalDataStep';
import { WorkHistoryStep } from '../components/WorkHistoryStep';
import { SalaryStep } from '../components/SalaryStep';
import { RetirementAgeStep } from '../components/RetirementAgeStep';
import { UMAStep } from '../components/UMAStep';
import { Modalidad10Step } from '../components/Modalidad10Step';
import { BeneficiariesStep } from '../components/BeneficiariesStep';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Props = NativeStackScreenProps<RootStackParamList, 'NewSimulation'>;

/**
 * Estructura del formulario: 4 pasos.
 * 1. Datos personales
 * 2. Historial laboral (+ salario base de cotización)
 * 3. Edad de retiro (+ beneficiarios)
 * 4. UMA (+ Modalidad 10)
 */
const STEPS = [
  'Datos personales',
  'Historial laboral',
  'Edad de retiro',
  'UMA',
];

export default function NewSimulationScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();
  const {
    input,
    updatePersonalData,
    updateWorkHistory,
    updateDailySalary,
    updateMonthlySalary,
    selectUMAByYear,
    setCustomUMA,
    updateModalidad10,
    setModalidad10ContributionSalary,
    setModalidad10UMAs,
    updateBeneficiaries,
  } = usePensionForm();
  const { save } = useHistory();

  const [step, setStep] = useState(0);
  const [monthlySalaryMode, setMonthlySalaryMode] = useState(false);
  const [customUMA, setCustomUMAMode] = useState(false);
  const [preloadedFromPdf, setPreloadedFromPdf] = useState(false);
  const [preloadedSbcIsAverage, setPreloadedSbcIsAverage] = useState(false);
  const importedSbcPeriods = useMemo(
    () => (route.params?.importedData?.sbcPeriods ?? []).map((period) => ({
      ...period,
      startDate: new Date(period.startDate),
      endDate: new Date(period.endDate),
    })),
    [route.params?.importedData?.sbcPeriods],
  );
  /**
   * Último salario registrado: el del tramo más reciente del historial
   * importado, o el SBC capturado si no hay historial.
   */
  const lastRegisteredSBC = useMemo(
    () => getLastRegisteredDailySalary(importedSbcPeriods, input.averageSalary.dailySalary),
    [importedSbcPeriods, input.averageSalary.dailySalary],
  );

  /**
   * Periodo de cotización de la Modalidad 10 al SBC declarado. Si la persona
   * sigue trabajando, su último salario registrado se suma a ese SBC; si no,
   * el periodo usa solo el salario de la Modalidad 10.
   */
  const m10Period = useMemo(() => {
    if (!input.modalidad10.active || !input.modalidad10.contributionSalary) return null;
    return buildM10ContributionPeriod({
      referenceDate: getLocalReferenceDate(),
      retirementDate: input.personalData.estimatedRetirementDate,
      m10DailySalary: input.modalidad10.contributionSalary,
      ordinaryDailySalary: lastRegisteredSBC,
      continuesWorking: input.modalidad10.continuesWorkingWhileContributing ?? true,
      annualSalaryIncreasePct: input.modalidad10.annualSalaryIncrease,
    });
  }, [
    input.modalidad10.active,
    input.modalidad10.contributionSalary,
    input.modalidad10.continuesWorkingWhileContributing,
    input.modalidad10.annualSalaryIncrease,
    input.personalData.estimatedRetirementDate.getTime(),
    lastRegisteredSBC,
  ]);

  const projection = useMemo(
    () => calculateProjectedSBC({
      segments: importedSbcPeriods,
      currentSBC: input.averageSalary.dailySalary,
      retirementDate: input.personalData.estimatedRetirementDate,
      referenceDate: getLocalReferenceDate(),
      m10Period,
    }),
    [
      importedSbcPeriods,
      input.averageSalary.dailySalary,
      input.personalData.estimatedRetirementDate.getTime(),
      m10Period,
    ],
  );
  const projectedSBC = projection.averageDailySalary;

  // Precarga el formulario con los datos revisados en ValidationScreen
  // (importación de PDF). Solo corre una vez, al entrar a la pantalla.
  useEffect(() => {
    const importedData = route.params?.importedData;
    if (!importedData) return;

    const { name, birthDate, totalWeeks, averageSBC } = importedData;

    const parsedBirthDate = birthDate ? new Date(birthDate + 'T00:00:00') : undefined;
    updatePersonalData({
      ...(name ? { name } : {}),
      ...(parsedBirthDate && !isNaN(parsedBirthDate.getTime()) ? { birthDate: parsedBirthDate } : {}),
    });
    if (totalWeeks) {
      updateWorkHistory({ totalWeeks });
    }
    // Solo se precarga cuando hay un SBC promedio calculado con el historial
    // detallado de modificaciones salariales — el último SBC registrado no
    // es el promedio y no debe usarse como si lo fuera (ver ValidationScreen).
    if (averageSBC) {
      updateDailySalary(averageSBC);
      setPreloadedSbcIsAverage(true);
    }
    setPreloadedFromPdf(true);
    // Solo debe correr cuando cambian los datos importados de la ruta, no en cada render.
  }, [route.params?.importedData]);

  const goToStep = (n: number) => setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + n)));

  const canGoToNextStep = (() => {
    switch (step) {
      case 0: {
        const { name, birthDate } = input.personalData;
        return (
          (name?.trim().length ?? 0) > 0 &&
          birthDate instanceof Date &&
          !isNaN(birthDate.getTime())
        );
      }
      case 1: {
        const { totalWeeks } = input.workHistory;
        const { dailySalary } = input.averageSalary;
        return (
          Number.isInteger(totalWeeks) && totalWeeks >= 1 && totalWeeks <= 5000 &&
          dailySalary > 0 && dailySalary <= 100000
        );
      }
      case 2: {
        const { estimatedRetirementDate, retirementAge } = input.personalData;
        return (
          estimatedRetirementDate instanceof Date &&
          !isNaN(estimatedRetirementDate.getTime()) &&
          retirementAge >= 60 && retirementAge <= 100 &&
          Number.isInteger(retirementAge * 2)
        );
      }
      default:
        return true;
    }
  })();

  const calculate = async () => {
    // El SBC proyectado acompaña al motor cuando hay historial importado o
    // Modalidad 10: es el mismo número que ve la persona en el formulario.
    const hasProjection = importedSbcPeriods.length > 0 || m10Period != null;
    const inputWithProjection = hasProjection
      ? {
          ...input,
          projectedAverageDailySalary: projectedSBC,
          projectedAverageBreakdown: projection.breakdown,
        }
      : input;
    const validation = validateInput(inputWithProjection);
    if (!validation.valid) {
      showAlert('Datos insuficientes', validation.errors.join('\n'));
      return;
    }
    const result = calculatePension(inputWithProjection);
    const saved = await save(result, input.personalData.name?.trim() || 'Simulación');
    navigation.navigate('Result', { simulationId: saved.id });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <PersonalDataStep personalData={input.personalData} onChange={updatePersonalData} theme={theme} />;
      case 1:
        return (
          <View style={styles.stepStack}>
            <WorkHistoryStep
              workHistory={input.workHistory}
              onChange={updateWorkHistory}
              theme={theme}
            />
            <SalaryStep
              averageSalary={input.averageSalary}
              onChangeDaily={updateDailySalary}
              onChangeMonthly={updateMonthlySalary}
              monthlyMode={monthlySalaryMode}
              setMonthlyMode={setMonthlySalaryMode}
              theme={theme}
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepStack}>
            <RetirementAgeStep
              personalData={input.personalData}
              onChange={updatePersonalData}
              projectedSBC={projectedSBC}
              theme={theme}
            />
            <BeneficiariesStep
              beneficiaries={input.beneficiaries}
              onChange={updateBeneficiaries}
              theme={theme}
            />
          </View>
        );
      case 3:
        return (
          <View style={styles.stepStack}>
            <UMAStep
              uma={input.uma}
              onSelectYear={selectUMAByYear}
              onCustomize={setCustomUMA}
              isCustom={customUMA}
              setIsCustom={setCustomUMAMode}
              theme={theme}
            />
            <Modalidad10Step
              modalidad10={input.modalidad10}
              onChange={updateModalidad10}
              onChangeSalary={setModalidad10ContributionSalary}
              onChangeUMAs={setModalidad10UMAs}
              dailyUMA={input.uma.dailyUMA}
              umaYear={input.uma.year}
              minimumDailySalary={getMinimumDailySalary(input.uma, input.modalidad10.salaryZone)}
              theme={theme}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Indicador de progreso */}
      <StepProgress step={step} total={STEPS.length} label={STEPS[step] ?? ''} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {preloadedFromPdf && (
          <MessageBanner variant="info" style={[styles.card, { marginBottom: 16 }]}>
            Este formulario se precargó con los datos de tu constancia IMSS. Revisa cada paso —
            {preloadedSbcIsAverage
              ? ' el SBC es un promedio calculado a partir del historial detallado de modificaciones salariales de tus patrones; verifícalo.'
              : ' tu constancia no incluía el historial de modificaciones salariales necesario para calcular el SBC promedio, así que ese campo quedó en blanco. Complétalo manualmente.'}
          </MessageBanner>
        )}
        {renderStep()}
      </ScrollView>

      {/* Botones de navegación */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <Button
          mode="outlined"
          onPress={() => goToStep(-1)}
          disabled={step === 0}
          style={styles.btn}
        >
          Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button mode="contained" onPress={() => goToStep(1)} disabled={!canGoToNextStep} style={[styles.btn, styles.primaryBtn]} icon="arrow-right">
            Siguiente
          </Button>
        ) : (
          <Button mode="contained" onPress={calculate} style={[styles.btn, styles.primaryBtn]} icon="calculator">
            Calcular Pensión
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 20 },
  card: { borderRadius: 16 },
  /** Separación entre las tarjetas que comparten un mismo paso. */
  stepStack: { gap: 16 },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
  },
  btn: { flex: 1 },
  primaryBtn: { borderRadius: BUTTON_RADIUS },
});
