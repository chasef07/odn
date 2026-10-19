import nextVitals from 'eslint-config-next/core-web-vitals'
import prettierConfig from 'eslint-config-prettier'
import noComments from './eslint-rules/no-comments.mjs'
import envSdk from './eslint-rules/env-sdk.mjs'
import adminRules from './eslint-rules/admin-server-action.mjs'
import dbBoundary from './eslint-rules/db-boundary.mjs'
import dates from './eslint-rules/dates.mjs'
import noSql from './eslint-rules/no-sql.mjs'

const localRules = {
  rules: {
    ...noComments.rules,
    ...envSdk.rules,
    ...dbBoundary.rules,
    ...noSql.rules,
    ...dates.rules,
  },
}
const TESTS = ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}']

const eslintConfig = [
  ...nextVitals,
  prettierConfig,
  {
    linterOptions: { noInlineConfig: true },
  },
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
      'local/no-sql': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: [...TESTS, 'src/lib/dates.ts'],
    rules: {
      'local/no-adhoc-dates': 'error',
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
  {
    name: 'logger owns console.debug for development output',
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    name: 'review page re-registers its keyboard shortcuts only on the listed queue state and resets the classification draft for each submission',
    files: ['src/app/admin/review/page.tsx'],
    rules: { 'react-hooks/exhaustive-deps': 'off', 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    name: 'dialogs reset their fields each time they open',
    files: ['src/components/admin/MaybeReasonDialog.tsx', 'src/components/admin/SelectDenialDialog.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    name: 'DateOfBirthInput syncs its split fields from the external form value',
    files: ['src/components/form/DateOfBirthInput.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
]

export default eslintConfig
