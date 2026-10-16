import { describe, expect, it } from 'vitest'
import { capitalizeName } from '@/lib/name-case'

describe('capitalizeName', () => {
  it.each([
    ['john', 'John'],
    ['JOHN', 'John'],
    ['mary jane', 'Mary Jane'],
    ['mary-jane', 'Mary-Jane'],
    ["o'brien", "O'Brien"],
    ['o’brien', 'O’Brien'],
    ['o‘brien', 'O‘Brien'],
    ['  anne  marie ', '  Anne  Marie '],
    ['josé muñoz', 'José Muñoz'],
    ['', ''],
  ])('%j becomes %j', (input, expected) => {
    expect(capitalizeName(input)).toBe(expected)
  })
})
