import { describe, expect, it, vi } from 'vitest'

const { mockDisconnect } = vi.hoisted(() => ({ mockDisconnect: vi.fn() }))

vi.mock('../client', () => ({ default: { $disconnect: mockDisconnect } }))

import { disconnectDatabase } from '../connection'

describe('disconnectDatabase', () => {
  it('disconnects the shared client', async () => {
    mockDisconnect.mockResolvedValue(undefined)

    await expect(disconnectDatabase()).resolves.toBeUndefined()

    expect(mockDisconnect).toHaveBeenCalledOnce()
  })

  it('propagates a disconnect failure', async () => {
    mockDisconnect.mockRejectedValue(new Error('socket closed'))

    await expect(disconnectDatabase()).rejects.toThrow('socket closed')
  })
})
