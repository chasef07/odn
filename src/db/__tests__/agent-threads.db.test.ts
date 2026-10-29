import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findAgentThread, listAgentThreads, saveAgentThread } from '../agent-threads'
import { seedAdmins } from './seed'

const question = { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Notes sold?' }] }
const answer = { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: '42 notes.' }] }

async function saveAt(
  at: string,
  thread: { id: string; adminUserId: string; title?: string; messages?: unknown[] }
) {
  vi.setSystemTime(new Date(at))
  await saveAgentThread({ title: 'Notes sold?', messages: [question], ...thread })
}

describe('agent threads', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await seedAdmins('admin_a', 'admin_b')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a thread with its title, messages and both timestamps on the first save', async () => {
    await saveAt('2026-10-01T12:00:00.000Z', { id: 't1', adminUserId: 'admin_a' })

    expect(await findAgentThread('t1')).toEqual({
      id: 't1',
      adminUserId: 'admin_a',
      title: 'Notes sold?',
      messages: [question],
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
      updatedAt: new Date('2026-10-01T12:00:00.000Z'),
    })
  })

  it('replaces the messages and bumps updated_at on a later save, keeping the title and created_at', async () => {
    await saveAt('2026-10-01T12:00:00.000Z', { id: 't1', adminUserId: 'admin_a' })
    await saveAt('2026-10-01T12:05:00.000Z', {
      id: 't1',
      adminUserId: 'admin_a',
      title: 'Another title',
      messages: [question, answer],
    })

    expect(await findAgentThread('t1')).toEqual({
      id: 't1',
      adminUserId: 'admin_a',
      title: 'Notes sold?',
      messages: [question, answer],
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
      updatedAt: new Date('2026-10-01T12:05:00.000Z'),
    })
  })

  it('refuses to save over another admin thread and leaves it unchanged', async () => {
    await saveAt('2026-10-01T12:00:00.000Z', { id: 't1', adminUserId: 'admin_a' })

    await expect(
      saveAt('2026-10-01T12:05:00.000Z', {
        id: 't1',
        adminUserId: 'admin_b',
        messages: [question, answer],
      })
    ).rejects.toThrow('t1')

    expect(await findAgentThread('t1')).toMatchObject({
      adminUserId: 'admin_a',
      messages: [question],
      updatedAt: new Date('2026-10-01T12:00:00.000Z'),
    })
  })

  it('finds a thread by id only, and returns null for a missing id', async () => {
    await saveAt('2026-10-01T12:00:00.000Z', { id: 't1', adminUserId: 'admin_a' })
    await saveAt('2026-10-01T12:00:00.000Z', { id: 't2', adminUserId: 'admin_a', title: 'Two' })

    expect(await findAgentThread('t2')).toMatchObject({ id: 't2', title: 'Two' })
    expect(await findAgentThread('missing')).toBeNull()
  })

  it('lists only that admin threads, most recently updated first, without messages', async () => {
    await saveAt('2026-10-01T12:00:00.000Z', { id: 'old', adminUserId: 'admin_a', title: 'Old' })
    await saveAt('2026-10-03T12:00:00.000Z', { id: 'new', adminUserId: 'admin_a', title: 'New' })
    await saveAt('2026-10-02T12:00:00.000Z', { id: 'mid', adminUserId: 'admin_a', title: 'Mid' })
    await saveAt('2026-10-04T12:00:00.000Z', { id: 'theirs', adminUserId: 'admin_b' })

    expect(await listAgentThreads('admin_a')).toEqual([
      { id: 'new', title: 'New', updatedAt: new Date('2026-10-03T12:00:00.000Z') },
      { id: 'mid', title: 'Mid', updatedAt: new Date('2026-10-02T12:00:00.000Z') },
      { id: 'old', title: 'Old', updatedAt: new Date('2026-10-01T12:00:00.000Z') },
    ])
    expect(await listAgentThreads('nobody')).toEqual([])
  })
})
