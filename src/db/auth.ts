import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from './client'

export function authDatabaseAdapter(): ReturnType<typeof prismaAdapter> {
  return prismaAdapter(prisma, {
    provider: 'postgresql',
  })
}

export async function createVerifiedUser({
  email,
  name,
}: {
  email: string
  name: string
}): Promise<{ id: string }> {
  return prisma.user.create({
    data: {
      email,
      name,
      emailVerified: true,
    },
  })
}

export async function createCredentialAccount({
  userId,
  accountId,
  password,
}: {
  userId: string
  accountId: string
  password: string
}): Promise<void> {
  await prisma.account.create({
    data: {
      userId,
      accountId,
      providerId: 'credential',
      password,
    },
  })
}

export async function deleteAllAuthSessions(): Promise<void> {
  await prisma.session.deleteMany({})
}

export async function deleteAllAuthAccounts(): Promise<void> {
  await prisma.account.deleteMany({})
}

export async function deleteAllAuthUsers(): Promise<void> {
  await prisma.user.deleteMany({})
}
