import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmissionStatus } from '@prisma/client'
import {
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_STATUS,
} from '../sms-support-types'

const {
  mockJobFindUnique,
  mockJobUpdateMany,
  mockTicketUpdateMany,
  mockSubmissionFindUnique,
  mockSubmissionUpdateMany,
  mockSubmissionUpdate,
  mockPrismaTransaction,
  mockCreateNoteVerification,
  mockGetVerificationUrl,
  mockRevokeNoteVerificationById,
  mockRevokeOtherNoteVerificationsForSubmission,
  mockGenerateQrCodeDataUrl,
  mockGenerateDoctorNotePDF,
  mockGeneratePDFFilename,
  mockSendApprovalEmail,
  mockSendSupportSms,
} = vi.hoisted(() => ({
  mockJobFindUnique: vi.fn(),
  mockJobUpdateMany: vi.fn(),
  mockTicketUpdateMany: vi.fn(),
  mockSubmissionFindUnique: vi.fn(),
  mockSubmissionUpdateMany: vi.fn(),
  mockSubmissionUpdate: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockCreateNoteVerification: vi.fn(),
  mockGetVerificationUrl: vi.fn(),
  mockRevokeNoteVerificationById: vi.fn(),
  mockRevokeOtherNoteVerificationsForSubmission: vi.fn(),
  mockGenerateQrCodeDataUrl: vi.fn(),
  mockGenerateDoctorNotePDF: vi.fn(),
  mockGeneratePDFFilename: vi.fn(),
  mockSendApprovalEmail: vi.fn(),
  mockSendSupportSms: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    smsSupportJob: {
      findUnique: mockJobFindUnique,
      updateMany: mockJobUpdateMany,
    },
    smsSupportTicket: {
      updateMany: mockTicketUpdateMany,
    },
    submission: {
      findUnique: mockSubmissionFindUnique,
      updateMany: mockSubmissionUpdateMany,
      update: mockSubmissionUpdate,
    },
    $transaction: mockPrismaTransaction,
  },
}))

vi.mock('@/lib/note-verification', () => ({
  createNoteVerification: mockCreateNoteVerification,
  getVerificationUrl: mockGetVerificationUrl,
  parseIssueDateInput: vi.fn(() => new Date(Date.UTC(2026, 5, 29))),
  revokeNoteVerificationById: mockRevokeNoteVerificationById,
  revokeOtherNoteVerificationsForSubmission: mockRevokeOtherNoteVerificationsForSubmission,
}))

vi.mock('@/lib/qr-code', () => ({
  generateQrCodeDataUrl: mockGenerateQrCodeDataUrl,
}))

vi.mock('@/lib/pdf/generate-pdf', () => ({
  generateDoctorNotePDF: mockGenerateDoctorNotePDF,
  generatePDFFilename: mockGeneratePDFFilename,
}))

vi.mock('@/lib/email', () => ({
  sendApprovalEmail: mockSendApprovalEmail,
}))

vi.mock('@/lib/sms-support-sms', () => ({
  sendSupportSms: mockSendSupportSms,
}))

import {
  runSupportTicketAutomation,
  SupportAutomationCancelledError,
} from '../sms-support-automation'

function approvedSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_123',
    stripePaymentIntentId: 'pi_123',
    paymentAmount: 2495,
    offerCode: null,
    offerPriceId: null,
    status: SubmissionStatus.APPROVED,
    state: 'CA',
    recipient: 'myself',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: new Date(Date.UTC(1990, 0, 1)),
    guardianFirstName: null,
    guardianLastName: null,
    guardianDateOfBirth: null,
    email: 'patient@example.com',
    phone: '(555) 123-4567',
    smsOptIn: true,
    smsOptInAt: new Date('2026-06-01T00:00:00Z'),
    smsConsentVersion: 'transactional-sms-2026-06-16',
    smsPhoneE164: '+15551234567',
    notePurpose: 'work',
    otherNotePurpose: null,
    firstDayOff: new Date(Date.UTC(2026, 5, 20)),
    lastDayOff: new Date(Date.UTC(2026, 5, 22)),
    absenceReason: 'illness',
    otherAbsenceReason: null,
    symptoms: null,
    otherSymptomText: null,
    additionalInformation: null,
    reviewedAt: new Date('2026-06-20T00:00:00Z'),
    reviewedByAdminId: 'doctor_123',
    denialReason: null,
    maybeReason: null,
    maybeInternalNote: null,
    maybeApprovedDays: null,
    maybeEmailSentAt: null,
    stripeRefundId: null,
    refundedAt: null,
    approvalEmailSentAt: new Date('2026-06-20T00:00:00Z'),
    denialEmailSentAt: null,
    approvalDiagnosis: 'flu',
    approvalWithRestrictions: false,
    createdAt: new Date('2026-06-19T00:00:00Z'),
    updatedAt: new Date('2026-06-20T00:00:00Z'),
    ...overrides,
  }
}

function supportJob(ticketOverrides: Record<string, unknown> = {}) {
  return {
    id: 'job_123',
    ticketId: 'ticket_123',
    kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
    status: 'RUNNING',
    payload: {
      kind: 'UPDATE_PURPOSE_REISSUE_NOTE',
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      updates: {
        notePurpose: 'school',
        otherNotePurpose: null,
      },
    },
    attempts: 1,
    ticket: {
      id: 'ticket_123',
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      submissionId: 'sub_123',
      phoneE164: '+15551234567',
      automationStatus: 'QUEUED',
      ...ticketOverrides,
    },
  }
}

describe('runSupportTicketAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJobFindUnique.mockResolvedValue(supportJob())
    mockSubmissionFindUnique.mockResolvedValue(approvedSubmission())
    mockCreateNoteVerification.mockResolvedValue({
      id: 'verification_123',
      verificationSlug: 'v_test',
      medicalRecordNumber: 'A1B2C3',
    })
    mockGetVerificationUrl.mockReturnValue('https://example.com/verify/v_test')
    mockGenerateQrCodeDataUrl.mockResolvedValue('data:image/png;base64,qr')
    mockGenerateDoctorNotePDF.mockResolvedValue(Buffer.from('pdf'))
    mockGeneratePDFFilename.mockReturnValue('doctor-note-sub_123.pdf')
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })
    mockJobUpdateMany.mockResolvedValue({ count: 1 })
    mockTicketUpdateMany.mockResolvedValue({ count: 1 })
    mockPrismaTransaction.mockImplementation((callback) =>
      callback({
        smsSupportTicket: { updateMany: mockTicketUpdateMany },
        smsSupportJob: { updateMany: mockJobUpdateMany },
        submission: { updateMany: mockSubmissionUpdateMany },
      })
    )
    mockSendApprovalEmail.mockResolvedValue({ success: true })
    mockSendSupportSms.mockResolvedValue({ success: true })
  })

  it('reissues with the original approval PDF diagnosis and restriction options', async () => {
    await runSupportTicketAutomation('job_123')

    expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sub_123',
        notePurpose: 'school',
      }),
      new Date(Date.UTC(2026, 5, 29)),
      'flu',
      false,
      expect.objectContaining({
        medicalRecordNumber: 'A1B2C3',
      })
    )
  })

  it('throws for historical approvals without stored PDF options and leaves failure state to the job runner', async () => {
    mockSubmissionFindUnique.mockResolvedValue(
      approvedSubmission({
        approvalDiagnosis: null,
        approvalWithRestrictions: null,
      })
    )

    await expect(runSupportTicketAutomation('job_123')).rejects.toThrow(
      'Approval PDF options are unknown'
    )

    expect(mockCreateNoteVerification).not.toHaveBeenCalled()
    expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
    expect(mockTicketUpdateMany).toHaveBeenCalledTimes(1)
    expect(mockTicketUpdateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ id: 'ticket_123' }),
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      }),
    })
  })

  it('does not run queued automation after staff escalates the ticket to admin', async () => {
    mockJobFindUnique.mockResolvedValue(
      supportJob({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      })
    )

    await expect(runSupportTicketAutomation('job_123')).rejects.toBeInstanceOf(
      SupportAutomationCancelledError
    )

    expect(mockTicketUpdateMany).not.toHaveBeenCalled()
    expect(mockSubmissionFindUnique).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(mockSendSupportSms).not.toHaveBeenCalled()
  })

  it('revokes the new verifier and does not update the submission when a running job is cancelled', async () => {
    mockJobFindUnique
      .mockResolvedValueOnce(supportJob())
      .mockResolvedValueOnce({ status: 'RUNNING' })
      .mockResolvedValueOnce({ status: 'RUNNING' })
      .mockResolvedValueOnce({ status: 'FAILED' })

    await expect(runSupportTicketAutomation('job_123')).rejects.toBeInstanceOf(
      SupportAutomationCancelledError
    )

    expect(mockCreateNoteVerification).toHaveBeenCalled()
    expect(mockGenerateDoctorNotePDF).toHaveBeenCalled()
    expect(mockRevokeNoteVerificationById).toHaveBeenCalledWith(
      'verification_123',
      expect.any(Date)
    )
    expect(mockSubmissionUpdateMany).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
  })

  it('revokes the new verifier when the final commit guard loses the cancellation race', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 0 })

    await expect(runSupportTicketAutomation('job_123')).rejects.toBeInstanceOf(
      SupportAutomationCancelledError
    )

    expect(mockRevokeNoteVerificationById).toHaveBeenCalledWith(
      'verification_123',
      expect.any(Date)
    )
    expect(mockSubmissionUpdateMany).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(mockSendSupportSms).not.toHaveBeenCalled()
  })
})
