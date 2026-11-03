/**
 * Paleta de series de las gráficas comparativas (getSeriesColors).
 *
 * La distinción entre simulaciones es el requisito central de esta paleta: cada
 * color debe ser único y ninguno debe reutilizar el violeta del escenario base
 * «Pensionarse lo antes posible» (secondary), reservado para esa serie.
 *
 * Para ejecutar: npm test
 */
import { darkTheme, getSeriesColors, lightTheme } from '../theme';

describe('getSeriesColors — colores de las series de las gráficas', () => {
  test('modo claro: 5 colores, todos distintos', () => {
    const colors = getSeriesColors(false);
    expect(colors).toHaveLength(5);
    expect(new Set(colors).size).toBe(5);
  });

  test('modo oscuro: 5 colores, todos distintos', () => {
    const colors = getSeriesColors(true);
    expect(colors).toHaveLength(5);
    expect(new Set(colors).size).toBe(5);
  });

  test('la primera serie es el color de marca (emerald)', () => {
    expect(getSeriesColors(false)[0]).toBe(lightTheme.colors.primary);
    expect(getSeriesColors(true)[0]).toBe(darkTheme.colors.primary);
  });

  test('ninguna serie reutiliza el violeta del escenario base', () => {
    expect(getSeriesColors(false)).not.toContain(lightTheme.colors.secondary);
    expect(getSeriesColors(true)).not.toContain(darkTheme.colors.secondary);
  });
});
