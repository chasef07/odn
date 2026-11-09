import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INTAKE_STEPS } from '@/lib/intake'

describe('intake step pages', () => {
  it.each(INTAKE_STEPS.map((step) => step.route))(
    '%s leaves every rule to its step schema',
    (route) => {
      const file = `src/app${route}/page.tsx`
      const setErrorLines = readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (line.includes('setError') ? [`${file}:${index + 1}`] : []))

      expect(
        setErrorLines,
        'a page rule never reaches the server; add it to the step schema in validation-schemas.ts'
      ).toEqual([])
    }
  )
})
