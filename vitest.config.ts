import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const DB_TESTS = 'src/db/**/*.db.test.ts'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./vitest.env-setup.ts', './vitest.setup.ts'],
          include: ['**/*.{test,spec}.{ts,tsx}'],
          exclude: ['node_modules', '.next', 'out', '.claude/**', 'docs-legacy/**', DB_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: [DB_TESTS],
          globalSetup: './vitest.db-setup.ts',
          setupFiles: ['./vitest.env-setup.ts', './src/db/__tests__/db-setup.ts'],
          fileParallelism: false,
          env: { TZ: 'America/Los_Angeles' },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'out/',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/types.ts',
        'vitest.setup.ts',
        'scripts/**',
        'src/app/layout.tsx',
        'src/app/not-found.tsx',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
