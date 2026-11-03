// Configuración de ESLint (flat config, ESLint 9) para el proyecto.
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['node_modules/**', '.expo/**', 'coverage/**', 'public/**', 'babel.config.js', 'eslint.config.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // El contrato está 100% tipado (sin `any`) — CHG-20261024-002 / US-004.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // Guardia de privacidad (RNF-001, RNF-016) — CHG-20261024-002 / US-002.
  // ADR-0002: arquitectura sin backend — todo cálculo es local.
  // ADR-0009: cero telemetría — ningún dato sale del dispositivo.
  // Ninguna API de red puede usarse desde src/. Si algún día se requiere
  // red, debe pasar primero por revisión de esos ADR, no por un cambio de
  // código silencioso.
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'APIs de red prohibidas en src/ (ADR-0002 sin backend, ADR-0009 sin telemetría): los datos del usuario no salen del dispositivo.',
        },
        {
          name: 'XMLHttpRequest',
          message: 'APIs de red prohibidas en src/ (ADR-0002 sin backend, ADR-0009 sin telemetría): los datos del usuario no salen del dispositivo.',
        },
        {
          name: 'WebSocket',
          message: 'APIs de red prohibidas en src/ (ADR-0002 sin backend, ADR-0009 sin telemetría): los datos del usuario no salen del dispositivo.',
        },
        {
          name: 'EventSource',
          message: 'APIs de red prohibidas en src/ (ADR-0002 sin backend, ADR-0009 sin telemetría): los datos del usuario no salen del dispositivo.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='window'][property.name=/^(fetch|XMLHttpRequest|WebSocket|EventSource)$/]",
          message: 'APIs de red prohibidas en src/ (ADR-0002 sin backend, ADR-0009 sin telemetría): los datos del usuario no salen del dispositivo.',
        },
        {
          selector: "MemberExpression[object.name='globalThis'][property.name=/^(fetch|XMLHttpRequest|WebSocket|EventSource)$/]",
          message: 'APIs de red prohibidas en src/ (ADR-0002 sin backend, ADR-0009 sin telemetría): los datos del usuario no salen del dispositivo.',
        },
      ],
    },
  },
];
