import { Linter, type ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import noSql from '../no-sql.mjs'

const linter = new Linter()
const config: Linter.Config = {
  plugins: { local: noSql as ESLint.Plugin },
  rules: { 'local/no-sql': 'error' },
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
}

function violations(code: string): number {
  return linter.verify(code, config).length
}

describe('local/no-sql', () => {
  it('flags statement text in strings and templates, across interpolations', () => {
    const flagged = [
      "const q = 'SELECT id FROM users'",
      'const q = `SELECT ${cols} FROM users WHERE id = 1`',
      'const q = `${prefix} SELECT id FROM users`',
      "const q = 'INSERT INTO users (id) VALUES (1)'",
      "const q = 'UPDATE users SET name = 1'",
      "const q = 'DELETE FROM users'",
      "const q = 'TRUNCATE users'",
      'const q = \'TRUNCATE TABLE "Submissions" CASCADE\'',
      "const q = 'CREATE OR REPLACE FUNCTION f() RETURNS int'",
      "const q = 'WITH RECURSIVE t AS (SELECT 1) SELECT * FROM t'",
      "const q = 'ALTER TYPE \"Status\" ADD VALUE \\'X\\''",
    ]
    for (const code of flagged) expect(violations(code), code).toBe(1)
  })

  it('leaves UI copy alone, which keeps the rule case-sensitive', () => {
    const allowed = [
      "const t = 'Select a date from the calendar'",
      "const t = 'Update your details'",
      "const t = 'TRUNCATE is a word'",
      "const t = 'Delete from history'",
      "const t = 'Create table for two at 7'",
    ]
    for (const code of allowed) expect(violations(code), code).toBe(0)
  })
})
