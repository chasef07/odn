'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { normalizeMedicalRecordNumber } from '@/lib/note-verification'
import { checkVerificationLookupLimit, getRateLimitKey } from '@/lib/verification-rate-limit'

export type VerificationLookupState = {
  error?: string
}

const GENERIC_ERROR =
  'We could not verify this document. Please check the Medical Record # and try again.'

function getRequesterIp(headerList: Headers): string | null {
  const forwardedFor = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || headerList.get('x-real-ip') || null
}

export async function lookupMedicalRecord(
  _state: VerificationLookupState,
  formData: FormData
): Promise<VerificationLookupState> {
  const headerList = await headers()
  const rateLimitKey = getRateLimitKey(getRequesterIp(headerList))

  if (!checkVerificationLookupLimit(rateLimitKey)) {
    return {
      error: 'Too many verification attempts. Please wait a few minutes and try again.',
    }
  }

  const rawMedicalRecordNumber = String(formData.get('medicalRecordNumber') || '')
  const medicalRecordNumber = normalizeMedicalRecordNumber(rawMedicalRecordNumber)

  if (!medicalRecordNumber) {
    return { error: GENERIC_ERROR }
  }

  const verification = await prisma.noteVerification.findUnique({
    where: { medicalRecordNumber },
    select: {
      verificationSlug: true,
      status: true,
      revokedAt: true,
      submission: {
        select: {
          status: true,
          refundedAt: true,
        },
      },
    },
  })

  if (
    !verification ||
    verification.status !== 'ACTIVE' ||
    verification.revokedAt ||
    verification.submission.status !== 'APPROVED' ||
    verification.submission.refundedAt
  ) {
    return { error: GENERIC_ERROR }
  }

  redirect(`/verify/${verification.verificationSlug}`)
}
