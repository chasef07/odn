import { describe, expect, it } from 'vitest'
import { TITLE_LENGTH, threadTitle } from '@/lib/agent/threads'
import type { AgentUIMessage } from '@/lib/agent/tools'

function question(...texts: string[]): AgentUIMessage[] {
  return [{ id: 'u1', role: 'user', parts: texts.map((text) => ({ type: 'text', text })) }]
}

describe('threadTitle', () => {
  it('is the first question with its whitespace collapsed', () => {
    expect(threadTitle(question('  Notes sold\n  per   month? '))).toBe('Notes sold per month?')
  })

  it('joins the text parts of the first message', () => {
    expect(threadTitle(question('Notes', 'by state'))).toBe('Notes by state')
  })

  it('keeps a question of exactly the title length and shortens a longer one with an ellipsis', () => {
    const exact = 'a'.repeat(TITLE_LENGTH)
    expect(threadTitle(question(exact))).toBe(exact)

    const shortened = threadTitle(question(`${exact}b`))
    expect(shortened).toHaveLength(TITLE_LENGTH)
    expect(shortened).toBe(`${'a'.repeat(TITLE_LENGTH - 1)}…`)
  })
})
