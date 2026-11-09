import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INTAKE_STEPS } from '@/lib/intake'

describe('intake step pages', () => {
  it.each(INTAKE_STEPS.map((step) => step.route))(
    '%s leaves every rule to its step schema',
    (route) => {
      const dir = `src/app${route}`
      const setErrorLines = readdirSync(dir)
        .filter((name) => name.endsWith('.tsx'))
        .flatMap((name) =>
          readFileSync(`${dir}/${name}`, 'utf8')
            .split('\n')
            .flatMap((line, index) =>
              line.includes('setError') ? [`${dir}/${name}:${index + 1}`] : []
            )
        )

      expect(
        setErrorLines,
        'a page rule never reaches the server; add it to the step schema in validation-schemas.ts'
      ).toEqual([])
    }
  )
})
