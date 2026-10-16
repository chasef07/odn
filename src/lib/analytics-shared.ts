import { SubmissionStatus } from '@prisma/client'
import { toNationalDigits } from '@/lib/phone-utils'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

export function toIsoDate(date: Date): string {
  return date.toISOString()
}

export function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePhone(phone: string): string {
  return toNationalDigits(phone)
}

export type CustomerKeyInput = {
  email: string
  phone: string
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date
}

export function getCustomerKey(submission: CustomerKeyInput): string {
  const email = normalizeEmail(submission.email)
  if (email) {
    return `email:${email}`
  }

  const phone = normalizePhone(submission.phone)
  if (phone) {
    return `phone:${phone}`
  }

  return `patient:${submission.patientFirstName.toLowerCase()}:${submission.patientLastName.toLowerCase()}:${toCalendarDate(submission.patientDateOfBirth)}`
}

export function isOpenStatus(status: SubmissionStatus): boolean {
  return (
    status === SubmissionStatus.PENDING_REVIEW ||
    status === SubmissionStatus.MAYBE ||
    status === SubmissionStatus.MANUAL
  )
}
