import nextVitals from 'eslint-config-next/core-web-vitals'
import prettierConfig from 'eslint-config-prettier'
import noComments from './eslint-rules/no-comments.mjs'
import envSdk from './eslint-rules/env-sdk.mjs'
import adminRules from './eslint-rules/admin-server-action.mjs'
import dbBoundary from './eslint-rules/db-boundary.mjs'

const localRules = { rules: { ...noComments.rules, ...envSdk.rules, ...dbBoundary.rules } }
const TESTS = ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}']

const eslintConfig = [
  ...nextVitals,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      '.claude/**',
      'next-env.d.ts',
    ],
  },
  {
    plugins: { local: localRules },
    rules: {
      'local/no-comments': 'error',
    },
  },
  {
    files: ['src/app/admin/**/*.{ts,tsx}'],
    plugins: { admin: adminRules },
    rules: {
      'admin/server-action': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: TESTS,
    rules: {
      'local/no-sdk-client': 'error',
      'local/no-import-time-config': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: [...TESTS, 'src/lib/env.ts', 'src/lib/public-env.ts'],
    rules: {
      'local/no-process-env': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}', 'scripts/**/*.{ts,tsx,js,mjs}'],
    ignores: ['src/db/**'],
    rules: {
      'local/db-boundary': 'error',
    },
  },
  {
    files: ['src/lib/pdf/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'jsx-a11y/alt-text': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: TESTS,
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn', 'info'] }],
    },
  },
]

export default eslintConfig
