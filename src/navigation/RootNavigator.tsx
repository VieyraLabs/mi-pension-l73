/**
 * Navegador raíz de la aplicación.
 * Usa React Navigation con Bottom Tabs y Stack Navigator.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import NewSimulationScreen from '../screens/NewSimulationScreen';
import ResultScreen from '../screens/ResultScreen';
import HistoryScreen from '../screens/HistoryScreen';
import InfoScreen from '../screens/InfoScreen';
import FAQScreen from '../screens/FAQScreen';
import PdfImportScreen from '../screens/PdfImportScreen';
import ValidationScreen from '../screens/ValidationScreen';
import ComparisonScreen from '../screens/ComparisonScreen';
import MultiComparisonScreen from '../screens/MultiComparisonScreen';
import type { ImportedSimulationData } from '../models';

// ─────────────────────────────────────────────
// Tipos de rutas
// ─────────────────────────────────────────────

export type RootStackParamList = {
  MainTabs: undefined;
  NewSimulation: { importedData?: ImportedSimulationData } | undefined;
  Result: { simulationId?: string };
  Comparison: { simulationId?: string };
  MultiComparison: { simulationIds: string[] };
  PdfImport: undefined;
  Validation: { extractedText: string };
  FAQ: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  History: undefined;
  Info: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.onPrimaryContainer,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarActiveBackgroundColor: theme.colors.primaryContainer,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { borderRadius: 16, marginVertical: 6 },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          height: 64,
          paddingTop: 6,
          paddingBottom: 6,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Info"
        component={InfoScreen}
        options={{
          title: 'Info',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="information" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontWeight: 'bold' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NewSimulation"
        component={NewSimulationScreen}
        options={{ title: 'Nueva Simulación' }}
      />
      <Stack.Screen
        name="Result"
        component={ResultScreen}
        options={{ title: 'Resultado de Pensión' }}
      />
      <Stack.Screen
        name="Comparison"
        component={ComparisonScreen}
        options={{ title: 'Comparativa M10 vs Pensionarse Antes' }}
      />
      <Stack.Screen
        name="MultiComparison"
        component={MultiComparisonScreen}
        options={{ title: 'Comparar simulaciones' }}
      />
      <Stack.Screen
        name="PdfImport"
        component={PdfImportScreen}
        options={{ title: 'Importar Constancia IMSS' }}
      />
      <Stack.Screen
        name="Validation"
        component={ValidationScreen}
        options={{ title: 'Validar Datos Importados' }}
      />
      <Stack.Screen
        name="FAQ"
        component={FAQScreen}
        options={{ title: 'Preguntas Frecuentes' }}
      />
    </Stack.Navigator>
  );
}
