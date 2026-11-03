/**
 * Paso 3 del formulario de nueva simulación: edad de retiro.
 *
 * La edad de retiro NO es un dato personal: es una decisión sobre cuándo se
 * jubila la persona usuaria. Por eso vive en su propio paso y no junto a los
 * datos personales.
 *
 * La edad NO se escribe a mano: se elige una FECHA con el calendario de ruedas
 * y la edad se DERIVA de esa fecha. El campo de edad es de solo lectura.
 *
 * Contrato con el motor:
 * - la media edad (60.5, 61.5, ...) es la que se ENVÍA en `retirementAge`: el
 *   motor la consume para calcular la EDAD LEGAL (Art. 171 LSS 1973);
 * - la regla legal de si 60.5 cuenta como 61 la resuelve el motor, no esta
 *   pantalla: aquí solo se presenta el valor (RNF-013).
 */
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, HelperText } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { PersonalData } from '../models';
import { formatCurrency } from '../utils/format';
import { calculateLegalAge } from '../utils/date';
import { DateField } from './DateField';
import { DataRow } from './DataRow';

/** Edad a la que se precarga la fecha de retiro por defecto. */
export const EDAD_RETIRIO_POR_DEFECTO = 65;

/** Rango en el que la edad se presenta con precisión de medio año. */
const EDAD_MEDIA_MIN = 60;
const EDAD_MEDIA_MAX = 65;

/** Meses que equivalen a medio año (la granularidad de presentación). */
const MESES_POR_MEDIO_ANIO = 6;

/**
 * Partes de una fecha que usa el calendario de ruedas.
 * `birthDate` es la fecha de nacimiento de la persona usuaria.
 */
export interface FechaNacimiento {
  getFullYear: () => number;
  getMonth: () => number;
  getDate: () => number;
}

/**
 * Cumpleaños de la persona en el año en que cumpliría `edad` años.
 *
 * Función pura y local: no vive en `utils/date.ts` porque ese archivo lo
 * mantiene otro agente del equipo.
 */
export function cumpleanosEnEdad(
  birthDate: FechaNacimiento,
  edad: number,
): Date {
  const anio = birthDate.getFullYear() + edad;
  const mes = birthDate.getMonth();
  const dia = birthDate.getDate();
  // Un 29 de febrero se ajusta al último día del mes en los años que no son
  // bisiestos.
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const diaAjustado = Math.min(dia, diasDelMes);
  return new Date(anio, mes, diaAjustado);
}

/** Edad cumplida (en años enteros) a una fecha dada. */
export function edadCumplida(birthDate: FechaNacimiento, fecha: Date): number {
  let edad = fecha.getFullYear() - birthDate.getFullYear();
  const mes = fecha.getMonth() - birthDate.getMonth();
  if (mes < 0 || (mes === 0 && fecha.getDate() < birthDate.getDate())) {
    edad--;
  }
  return edad;
}

/** Meses cumplidos entre la fecha de nacimiento y la fecha dada. */
export function mesesCumplidos(birthDate: FechaNacimiento, fecha: Date): number {
  let meses =
    (fecha.getFullYear() - birthDate.getFullYear()) * 12 +
    (fecha.getMonth() - birthDate.getMonth());
  // El cumpleaños del mes todavía no llega: falta el mes completo anterior.
  if (fecha.getDate() < birthDate.getDate()) {
    meses--;
  }
  return meses;
}

/**
 * Edad que se MUESTRA en pantalla.
 *
 * Regla: la media edad solo se muestra cuando la edad cumplida cae en
 * [60, 65]; en ese caso se redondea al medio año MÁS CERCANO (en un empate
 * exacto, hacia abajo). A partir de 65 solo se muestran enteros, y fuera del
 * rango se muestra la edad entera cumplida.
 *
 * - 60 años y 3 meses → 60
 * - 60 años y 6 meses → 60.5
 * - 60 años y 9 meses → 60.5 (60.5 está más cerca que 61)
 * - 64 años y 7 meses → 64.5
 * - 65 años y 6 meses → 65 (a partir de 65, solo enteros)
 * - 66 años y 2 meses → 66 (fuera del rango de medios años)
 * - 59 años y 11 meses → 59
 */
export function edadMostrada(birthDate: FechaNacimiento, fecha: Date): number {
  const meses = mesesCumplidos(birthDate, fecha);
  const entera = Math.floor(meses / 12);
  if (entera < EDAD_MEDIA_MIN || entera > EDAD_MEDIA_MAX) {
    return entera;
  }
  // Redondeo al medio año más cercano; en el empate exacto (3 o 9 meses) el
  // redondeo va hacia abajo, que es como `Math.floor` resuelve el caso.
  const mesesRedondeados =
    Math.floor((meses + 2) / MESES_POR_MEDIO_ANIO) * MESES_POR_MEDIO_ANIO;
  const conMedioAnio = mesesRedondeados / 12;
  if (conMedioAnio > EDAD_MEDIA_MAX) {
    // A partir de 65 la edad se muestra como entero.
    return entera;
  }
  return conMedioAnio;
}

/** Formatea la edad para pantalla: con decimal solo si hay fracción. */
export function formateaEdad(edad: number): string {
  return Number.isInteger(edad) ? String(edad) : edad.toFixed(1);
}

export interface RetirementAgeStepProps {
  personalData: PersonalData;
  onChange: (data: Partial<PersonalData>) => void;
  theme: MD3Theme;
  projectedSBC: number;
}

export function RetirementAgeStep({ personalData, onChange, theme, projectedSBC }: RetirementAgeStepProps) {
  // La fecha precargada es el cumpleaños en el año en que cumpliría 65 años.
  const fechaInicial = useMemo(
    () => cumpleanosEnEdad(personalData.birthDate, EDAD_RETIRIO_POR_DEFECTO),
    [personalData.birthDate],
  );

  const fechaRetiro = personalData.estimatedRetirementDate;
  const hayFechaValida = fechaRetiro instanceof Date && !isNaN(fechaRetiro.getTime());
  const fechaMostrada = hayFechaValida ? fechaRetiro : fechaInicial;

  const edad = edadMostrada(personalData.birthDate, fechaMostrada);
  const edadEntera = edadCumplida(personalData.birthDate, fechaMostrada);
  // EDAD LEGAL que aplica el motor (Art. 171 LSS 1973): seis meses o más
  // cumplidos se computan como el año siguiente.
  const edadLegal = calculateLegalAge(edad);

  const elegirFecha = (fecha: Date) => {
    // Se manda la EDAD DE PRESENTACIÓN (múltiplo de medio año): el motor la
    // consume y calcula con ella la edad legal (Art. 171 LSS 1973).
    //
    // Se mandan dos actualizaciones porque el formulario recalcula la fecha
    // de retiro a partir de la edad: primero la edad (para que el motor
    // reciba el valor con su fracción) y después la fecha elegida (que es la
    // que fija la granularidad de medio año en pantalla).
    onChange({ retirementAge: edadMostrada(personalData.birthDate, fecha) });
    onChange({ estimatedRetirementDate: fecha });
  };

  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>
          Edad de retiro
        </Text>
        {/* El campo no es editable: se toca para abrir el calendario
            (DateField), el mismo patrón que la fecha de nacimiento. */}
        <DateField
          label="Fecha de retiro *"
          value={fechaMostrada}
          fallbackDate={fechaInicial}
          onConfirm={elegirFecha}
          theme={theme}
        />
        <HelperText type="info" style={{ marginBottom: 12 }}>
          Toca la fecha para elegirla en el calendario. La edad se calcula a partir de tu fecha de
          nacimiento.
        </HelperText>
        <DataRow
          label="Edad de retiro *"
          value={`${formateaEdad(edad)} años`}
          theme={theme}
          highlight
          prominent
        />
        <DataRow
          label="Salario Base de Cotización proyectado"
          value={formatCurrency(projectedSBC)}
          theme={theme}
        />
        <HelperText type="info">
          60–64 = Cesantía en Edad Avanzada (con reducción). 65+ = Vejez (sin reducción).
        </HelperText>
        {edad !== edadEntera && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            {edadLegal < 65
              ? `Para el factor de Cesantía, se considera como ${edadLegal} años (Art. 171 LSS 1973).`
              : 'Para determinar el tipo y factor de pensión, se considera como 65 años (Vejez, Art. 171 LSS 1973).'}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
});
