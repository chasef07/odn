import nextVitals from 'eslint-config-next/core-web-vitals'
import prettierConfig from 'eslint-config-prettier'
import localRules from './eslint-rules/no-comments.mjs'

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
    files: ['src/lib/pdf/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'jsx-a11y/alt-text': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: [
      'src/**/__tests__/**',
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
    ],
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn', 'info'] }],
    },
  },
]

export default eslintConfig
