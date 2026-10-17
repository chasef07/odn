import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { loadEnv } from 'vite'

const DB_TESTS = 'src/db/**/*.db.test.ts'

export default defineConfig(({ mode }) => {
  const { DATABASE_URL: _ignored, ...env } = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    test: {
      globals: true,
      env: {
        DATABASE_URL: 'postgresql://unit-tests-have-no-database',
        NEXT_PUBLIC_SITE_URL: 'https://onlinedoctornote.com',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
        STRIPE_SECRET_KEY: 'sk_test_placeholder',
        STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
        STRIPE_PRICE_ID: 'price_placeholder',
        CRON_SECRET: 'cron_placeholder',
        BETTER_AUTH_SECRET: 'better_auth_placeholder_secret_32_chars',
        BETTER_AUTH_URL: 'http://localhost:3000',
        RESEND_API_KEY: 're_placeholder',
        RESEND_WEBHOOK_SECRET: 'whsec_resend_placeholder',
        RESEND_FROM_EMAIL: 'noreply@onlinedoctornote.com',
        DOCTOR_NAME: 'Jason Buchwald',
        DOCTOR_CREDENTIALS: 'MD FACEP',
        DOCTOR_SIGNATURE_URL: '/images/doctor-signature.png',
        VERIFICATION_BASE_URL: 'https://phealthclinic.com',
        TELNYX_SMS_ENABLED: 'false',
        ...env,
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            setupFiles: ['./vitest.setup.ts'],
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
            setupFiles: ['./src/db/__tests__/db-setup.ts'],
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
  }
})
