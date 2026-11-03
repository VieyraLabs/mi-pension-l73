/**
 * Pruebas del paso de historial laboral: el paso NO debe narrar la
 * proyección de semanas, porque la edad de retiro todavía no está decidida
 * (se elige en el paso 3). Solo ofrece una guía evergreen sobre dónde
 * verificar las semanas cotizadas.
 *
 * Para ejecutar: npm test
 */
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderScreen } from '../test-utils/renderScreen';
import { WorkHistoryStep } from '../components/WorkHistoryStep';
import { lightTheme } from '../theme';
import type { WorkHistory } from '../models';

function renderStep(totalWeeks: number) {
  const workHistory: WorkHistory = { totalWeeks, employmentRelations: [] };
  renderScreen(
    <WorkHistoryStep
      workHistory={workHistory}
      onChange={() => {}}
      theme={lightTheme}
    />,
  );
}

describe('WorkHistoryStep — semanas cotizadas', () => {
  test('captura el total de semanas cotizadas', () => {
    renderStep(480);

    expect(screen.getByDisplayValue('480')).toBeTruthy();
  });

  test('NO narra la proyección de semanas al jubilarte', () => {
    renderStep(480);

    expect(screen.queryByText(/Al jubilarte tendrás/)).toBeNull();
    expect(screen.queryByText(/se proyectan/)).toBeNull();
    expect(screen.queryByText(/La proyección asume/)).toBeNull();
    expect(screen.queryByText(/Mínimo requerido/)).toBeNull();
  });

  test('mantiene la guía evergreen sobre el portal del IMSS', () => {
    renderStep(480);

    expect(
      screen.getByText(
        'Puedes verificar tus semanas cotizadas en el portal del IMSS (imss.gob.mx) con tu NSS.',
      ),
    ).toBeTruthy();
  });
});
