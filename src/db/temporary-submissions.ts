import { Prisma } from '@prisma/client'
import prisma from './client'
import type { JsonValue, TemporarySubmission } from './types'

export async function createTemporarySubmission({
  paymentIntentId,
  formData,
  expiresAt,
}: {
  paymentIntentId: string
  formData: JsonValue
  expiresAt: Date
}): Promise<TemporarySubmission> {
  return prisma.temporarySubmission.create({
    data: {
      paymentIntentId,
      formData: formData as Prisma.InputJsonValue,
      expiresAt,
    },
  })
}

export async function findTemporarySubmissionByPaymentIntent(
  paymentIntentId: string
): Promise<TemporarySubmission | null> {
  return prisma.temporarySubmission.findUnique({
    where: { paymentIntentId },
  })
}

export async function findTemporarySubmissionById(id: string): Promise<TemporarySubmission | null> {
  return prisma.temporarySubmission.findUnique({
    where: { id },
  })
}

export async function attachPaymentIntentToTemporarySubmission(
  id: string,
  paymentIntentId: string
): Promise<TemporarySubmission> {
  return prisma.temporarySubmission.update({
    where: { id },
    data: { paymentIntentId },
  })
}

export async function deleteTemporarySubmission(id: string): Promise<void> {
  await prisma.temporarySubmission.delete({
    where: { id },
  })
}

export async function deleteExpiredTemporarySubmissions(now: Date): Promise<{ count: number }> {
  return prisma.temporarySubmission.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  })
}

export async function countTemporarySubmissions(): Promise<number> {
  return prisma.temporarySubmission.count()
}

export async function countExpiredTemporarySubmissions(now: Date): Promise<number> {
  return prisma.temporarySubmission.count({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  })
}

export async function findRecentTemporarySubmissions(): Promise<
  Pick<TemporarySubmission, 'id' | 'paymentIntentId' | 'createdAt' | 'expiresAt'>[]
> {
  return prisma.temporarySubmission.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      paymentIntentId: true,
      createdAt: true,
      expiresAt: true,
    },
  })
}
