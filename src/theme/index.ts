/**
 * Tema de la aplicación basado en Material Design 3 (React Native Paper).
 * Soporta modo claro y oscuro.
 *
 * Paleta "esmeralda profesional": el esmeralda profundo es el color de marca
 * (dinero/crecimiento — la convención de las apps financieras modernas), el
 * violeta es el secundario (comparaciones A/B, acentos) y el ámbar distingue
 * la acción de importar PDF. Los neutros son fríos (slate) en lugar de grises
 * puros, y el modo oscuro usa azul pizarra profundo, más rico que #121212.
 */
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

/**
 * Paleta de colores primarios de la aplicación.
 *
 * `brand` es un esmeralda profundo (#047857) y no un verde medio: tiene que
 * funcionar en los dos sentidos — texto blanco encima (botones) y texto de
 * marca sobre superficie clara (pestañas, etiquetas). Con #059669 el
 * contraste era 3.77:1 y 3.22:1, por debajo del 4.5:1 de WCAG AA. Con
 * #047857 es 5.48:1 sobre blanco y 4.87:1 sobre la superficie variante.
 */
const COLORS = {
  brand: '#047857',
  brandDark: '#065F46',
  brandLight: '#34D399',
  secondary: '#7C3AED',
  secondaryLight: '#A78BFA',
  accent: '#D97706',
  accentLight: '#FBBF24',
  success: '#047857',
  warning: '#D97706',
  error: '#DC2626',
  surface: '#FFFFFF',
  surfaceDark: '#0B1120',
} as const;

/**
 * Degradado de marca para superficies protagonistas (encabezados, tarjeta de
 * resultado). Los dos modos usan puntos distintos para garantizar contraste
 * con el texto que va encima. Es el único lugar que define el degradado — las
 * pantallas lo piden con `getBrandGradient(isDark)` (ver ADR-0008: sin hex afuera).
 *
 * Los puntos son deliberadamente profundos: el texto de encima es blanco y
 * este degradante mantiene un contraste ≥ 4.5:1 en ambos modos (WCAG AA).
 */
const BRAND_GRADIENT = {
  light: ['#047857', '#0F766E'] as const,
  dark: ['#065F46', '#0F766E'] as const,
};

/**
 * Color del texto y los iconos que van SOBRE el degradado de marca.
 * Es blanco en ambos modos porque el degradado es saturado; en modo oscuro
 * `onPrimary` es un verde oscuro y no serviría (contraste insuficiente).
 */
export const BRAND_ON_COLOR = '#FFFFFF';

export function getBrandGradient(isDark: boolean): readonly [string, string] {
  return isDark ? BRAND_GRADIENT.dark : BRAND_GRADIENT.light;
}

/**
 * Pares fondo/texto para banners de mensaje (MessageBanner).
 * Únicos en toda la app — evita que cada pantalla defina sus propios
 * hex literales para "aviso"/"error"/"éxito"/"info".
 */
export const BANNER_COLORS = {
  warning: { background: '#FEF3C7', text: '#92400E', dark: { background: '#451A03', text: '#FCD34D' } },
  success: { background: '#D1FAE5', text: '#065F46', dark: { background: '#064E3B', text: '#6EE7B7' } },
  error: { background: '#FEE2E2', text: '#B91C1C', dark: { background: '#450A0A', text: '#FCA5A5' } },
  info: { background: '#E0F2FE', text: '#0369A1', dark: { background: '#0C4A6E', text: '#7DD3FC' } },
} as const;

export function getBannerColors(variant: keyof typeof BANNER_COLORS, isDark: boolean) {
  const c = BANNER_COLORS[variant];
  return isDark ? c.dark : { background: c.background, text: c.text };
}

/**
 * Paleta categórica para las series de las gráficas comparativas (una línea por
 * simulación). Debe ser distinguible entre sí y del violeta del escenario base
 * «Pensionarse lo antes posible» (`secondary`), que NO se reutiliza aquí.
 *
 * Son 5 tonos separados por hue —verde, naranja, azul, rosa y cian— elegidos para
 * que sigan distinguiéndose con daltonismo rojo-verde; el color nunca es la única
 * señal porque la leyenda y la tabla etiquetan cada serie con «M10 con X UMAs».
 *
 * ADR-0008: este es el ÚNICO lugar que define estos colores; las pantallas los
 * piden con `getSeriesColors(isDark)`. La variante oscura es más luminosa para
 * mantener contraste sobre el azul pizarra del modo oscuro.
 */
const SERIES_COLORS = {
  light: ['#047857', '#D97706', '#0284C7', '#E11D48', '#0891B2'] as const,
  dark: ['#34D399', '#FBBF24', '#38BDF8', '#FB7185', '#22D3EE'] as const,
} as const;

/** Devuelve la paleta de series de las gráficas según el modo (claro/oscuro). */
export function getSeriesColors(isDark: boolean): readonly string[] {
  return isDark ? SERIES_COLORS.dark : SERIES_COLORS.light;
}

/** Tema claro (Material Design 3). */
export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.brand,
    onPrimary: '#FFFFFF',
    primaryContainer: '#D1FAE5',
    onPrimaryContainer: '#064E3B',
    secondary: COLORS.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#EDE9FE',
    onSecondaryContainer: '#4C1D95',
    tertiary: COLORS.accent,
    onTertiary: '#FFFFFF',
    surface: '#FFFFFF',
    onSurface: '#0F172A',
    surfaceVariant: '#EEF2F6',
    onSurfaceVariant: '#55637A',
    background: '#F6F8FB',
    onBackground: '#0F172A',
    error: COLORS.error,
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#7F1D1D',
    outline: '#94A3B8',
    outlineVariant: '#E2E8F0',
    elevation: {
      level0: 'transparent',
      level1: '#F1F5F9',
      level2: '#E8EEF4',
      level3: '#DDE5EE',
      level4: '#D2DCE8',
      level5: '#C7D3E2',
    },
  },
};

/** Tema oscuro (Material Design 3) — azul pizarra profundo, no gris puro. */
export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.brandLight,
    onPrimary: '#003929',
    primaryContainer: '#065F46',
    onPrimaryContainer: '#A7F3D0',
    secondary: COLORS.secondaryLight,
    onSecondary: '#2E1065',
    secondaryContainer: '#4C1D95',
    onSecondaryContainer: '#EDE9FE',
    tertiary: COLORS.accentLight,
    onTertiary: '#451A03',
    surface: '#151E31',
    onSurface: '#E2E8F0',
    surfaceVariant: '#1E293B',
    onSurfaceVariant: '#94A3B8',
    background: '#0B1120',
    onBackground: '#E2E8F0',
    error: '#F87171',
    onError: '#450A0A',
    errorContainer: '#7F1D1D',
    onErrorContainer: '#FECACA',
    outline: '#64748B',
    outlineVariant: '#334155',
    elevation: {
      level0: 'transparent',
      level1: '#182236',
      level2: '#1C2740',
      level3: '#202C48',
      level4: '#243150',
      level5: '#283658',
    },
  },
};

/**
 * Radio unificado de esquinas para botones. Antes cada pantalla usaba 8, 12 o
 * 14; un solo token mantiene las acciones principales visualmente idénticas
 * (ver ADR-0011: sistema de diseño, no valores sueltos).
 */
export const BUTTON_RADIUS = 12;

export { COLORS };
