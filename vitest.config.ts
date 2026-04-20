import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load env file based on mode (test will load .env.test)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      globalSetup: './vitest.global-setup.ts',
      setupFiles: ['./vitest.setup.ts'],
      env: {
        // Load test environment variables from .env.test
        ...env,
      },
      include: ['**/*.{test,spec}.{ts,tsx}'],
      exclude: ['node_modules', '.next', 'out', '.claude/**', 'docs-legacy/**'],
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
          'scripts/**', // Utility scripts
          'src/app/layout.tsx', // Next.js specific files
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
  }
})
