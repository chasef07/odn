import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockClient,
  mockPrismaAdapter,
  mockUserCreate,
  mockUserDeleteMany,
  mockAccountCreate,
  mockAccountDeleteMany,
  mockSessionDeleteMany,
} = vi.hoisted(() => {
  const mockUserCreate = vi.fn()
  const mockUserDeleteMany = vi.fn()
  const mockAccountCreate = vi.fn()
  const mockAccountDeleteMany = vi.fn()
  const mockSessionDeleteMany = vi.fn()
  return {
    mockClient: {
      user: { create: mockUserCreate, deleteMany: mockUserDeleteMany },
      account: { create: mockAccountCreate, deleteMany: mockAccountDeleteMany },
      session: { deleteMany: mockSessionDeleteMany },
    },
    mockPrismaAdapter: vi.fn(),
    mockUserCreate,
    mockUserDeleteMany,
    mockAccountCreate,
    mockAccountDeleteMany,
    mockSessionDeleteMany,
  }
})

vi.mock('../client', () => ({ default: mockClient }))
vi.mock('better-auth/adapters/prisma', () => ({ prismaAdapter: mockPrismaAdapter }))

import {
  authDatabaseAdapter,
  createCredentialAccount,
  createVerifiedUser,
  deleteAllAuthAccounts,
  deleteAllAuthSessions,
  deleteAllAuthUsers,
} from '../auth'

describe('auth database', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds the better-auth adapter over the shared client for postgresql', () => {
    const adapter = vi.fn()
    mockPrismaAdapter.mockReturnValue(adapter)

    expect(authDatabaseAdapter()).toBe(adapter)

    expect(mockPrismaAdapter).toHaveBeenCalledWith(mockClient, {
      provider: 'postgresql',
    })
  })

  it('creates an email-verified user', async () => {
    mockUserCreate.mockResolvedValue({ id: 'user_1' })

    await expect(
      createVerifiedUser({ email: 'doc@example.com', name: 'Dr. Doc' })
    ).resolves.toEqual({ id: 'user_1' })

    expect(mockUserCreate).toHaveBeenCalledWith({
      data: {
        email: 'doc@example.com',
        name: 'Dr. Doc',
        emailVerified: true,
      },
    })
  })

  it('creates a credential account holding the password hash', async () => {
    mockAccountCreate.mockResolvedValue({ id: 'account_1' })

    await expect(
      createCredentialAccount({ userId: 'user_1', accountId: 'doc@example.com', password: 'hash' })
    ).resolves.toBeUndefined()

    expect(mockAccountCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        accountId: 'doc@example.com',
        providerId: 'credential',
        password: 'hash',
      },
    })
  })

  it('deletes every session, account, and user', async () => {
    mockSessionDeleteMany.mockResolvedValue({ count: 1 })
    mockAccountDeleteMany.mockResolvedValue({ count: 1 })
    mockUserDeleteMany.mockResolvedValue({ count: 1 })

    await deleteAllAuthSessions()
    await deleteAllAuthAccounts()
    await deleteAllAuthUsers()

    expect(mockSessionDeleteMany).toHaveBeenCalledWith({})
    expect(mockAccountDeleteMany).toHaveBeenCalledWith({})
    expect(mockUserDeleteMany).toHaveBeenCalledWith({})
  })
})
