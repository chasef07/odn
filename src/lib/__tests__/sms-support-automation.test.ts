import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmissionStatus } from '@/db/types'
import {
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_STATUS,
} from '../sms-support-types'

const {
  mockFindSupportJobWithTicket,
  mockFindSupportJobStatus,
  mockTransition,
  mockFindSubmissionById,
  mockCommitSupportAutomationSubmissionUpdate,
  mockRecordApprovalEmailSent,
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
  mockFindSupportJobWithTicket: vi.fn(),
  mockFindSupportJobStatus: vi.fn(),
  mockTransition: vi.fn(),
  mockFindSubmissionById: vi.fn(),
  mockCommitSupportAutomationSubmissionUpdate: vi.fn(),
  mockRecordApprovalEmailSent: vi.fn(),
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

vi.mock('@/db/sms-support', () => ({
  findSupportJobStatus: mockFindSupportJobStatus,
  findSupportJobWithTicket: mockFindSupportJobWithTicket,
}))

vi.mock('@/db/sms-support-lifecycle', () => ({
  transition: mockTransition,
}))

vi.mock('@/db/submissions', () => ({
  commitSupportAutomationSubmissionUpdate: mockCommitSupportAutomationSubmissionUpdate,
  findSubmissionById: mockFindSubmissionById,
  recordApprovalEmailSent: mockRecordApprovalEmailSent,
}))

vi.mock('@/lib/note-verification', () => ({
  createNoteVerification: mockCreateNoteVerification,
  getVerificationUrl: mockGetVerificationUrl,
  parseIssueDateInput: vi.fn(() => new Date(Date.UTC(2026, 5, 29))),
}))

vi.mock('@/db/note-verifications', () => ({
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
    mockFindSupportJobWithTicket.mockResolvedValue(supportJob())
    mockFindSupportJobStatus.mockResolvedValue({ status: 'RUNNING' })
    mockFindSubmissionById.mockResolvedValue(approvedSubmission())
    mockCreateNoteVerification.mockResolvedValue({
      id: 'verification_123',
      verificationSlug: 'v_test',
      medicalRecordNumber: 'A1B2C3',
    })
    mockGetVerificationUrl.mockReturnValue('https://example.com/verify/v_test')
    mockGenerateQrCodeDataUrl.mockResolvedValue('data:image/png;base64,qr')
    mockGenerateDoctorNotePDF.mockResolvedValue(Buffer.from('pdf'))
    mockGeneratePDFFilename.mockReturnValue('doctor-note-sub_123.pdf')
    mockTransition.mockResolvedValue({ ok: true, value: { id: 'ticket_123' } })
    mockCommitSupportAutomationSubmissionUpdate.mockResolvedValue('updated')
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
    mockFindSubmissionById.mockResolvedValue(
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
    expect(mockTransition).toHaveBeenCalledTimes(1)
    expect(mockTransition).toHaveBeenCalledWith('claimAutomation', 'ticket_123', {
      at: expect.any(Date),
    })
    expect(mockCommitSupportAutomationSubmissionUpdate).not.toHaveBeenCalled()
  })

  it('closes the ticket with a summary after the reissue is emailed', async () => {
    await runSupportTicketAutomation('job_123')

    expect(mockTransition).toHaveBeenCalledTimes(2)
    expect(mockTransition).toHaveBeenNthCalledWith(1, 'claimAutomation', 'ticket_123', {
      at: expect.any(Date),
    })
    expect(mockTransition).toHaveBeenNthCalledWith(2, 'automationSucceeded', 'ticket_123', {
      at: expect.any(Date),
      adminSummary: `Automated ${SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE} update completed and emailed.`,
    })
    expect(mockTransition.mock.invocationCallOrder[0]).toBeLessThan(
      mockFindSubmissionById.mock.invocationCallOrder[0]
    )
    expect(mockSendApprovalEmail.mock.invocationCallOrder[0]).toBeLessThan(
      mockTransition.mock.invocationCallOrder[1]
    )
  })

  it('finishes without throwing when the ticket left automation before it could close', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockTransition
      .mockResolvedValueOnce({ ok: true, value: { id: 'ticket_123' } })
      .mockResolvedValueOnce({
        ok: false,
        refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.NEEDS_CSR },
      })

    await expect(runSupportTicketAutomation('job_123')).resolves.toBeUndefined()

    expect(mockSendApprovalEmail).toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('Support ticket was not closed after automation:', {
      ticketId: 'ticket_123',
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.NEEDS_CSR },
    })
    warn.mockRestore()
  })

  it('claims the ticket before rejecting a job whose ticket has no linked submission', async () => {
    mockFindSupportJobWithTicket.mockResolvedValue(supportJob({ submissionId: null }))

    await expect(runSupportTicketAutomation('job_123')).rejects.toThrow(
      'Support ticket has no linked submission'
    )

    expect(mockTransition).toHaveBeenCalledTimes(1)
    expect(mockTransition).toHaveBeenCalledWith('claimAutomation', 'ticket_123', {
      at: expect.any(Date),
    })
    expect(mockFindSubmissionById).not.toHaveBeenCalled()
  })

  it('does not run queued automation after admin escalates the ticket', async () => {
    mockFindSupportJobWithTicket.mockResolvedValue(
      supportJob({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      })
    )
    mockTransition.mockResolvedValue({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.NEEDS_CSR },
    })

    await expect(runSupportTicketAutomation('job_123')).rejects.toBeInstanceOf(
      SupportAutomationCancelledError
    )

    expect(mockTransition).toHaveBeenCalledTimes(1)
    expect(mockTransition).toHaveBeenCalledWith('claimAutomation', 'ticket_123', {
      at: expect.any(Date),
    })
    expect(mockCommitSupportAutomationSubmissionUpdate).not.toHaveBeenCalled()
    expect(mockFindSubmissionById).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(mockSendSupportSms).not.toHaveBeenCalled()
  })

  it('revokes the new verifier and does not update the submission when a running job is cancelled', async () => {
    mockFindSupportJobStatus
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
    expect(mockCommitSupportAutomationSubmissionUpdate).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
  })

  it('revokes the new verifier when the final commit guard loses the cancellation race', async () => {
    mockCommitSupportAutomationSubmissionUpdate.mockResolvedValue('cancelled')

    await expect(runSupportTicketAutomation('job_123')).rejects.toBeInstanceOf(
      SupportAutomationCancelledError
    )

    expect(mockRevokeNoteVerificationById).toHaveBeenCalledWith(
      'verification_123',
      expect.any(Date)
    )
    expect(mockCommitSupportAutomationSubmissionUpdate).toHaveBeenCalledTimes(1)
    expect(mockCommitSupportAutomationSubmissionUpdate).toHaveBeenCalledWith({
      ticketId: 'ticket_123',
      jobId: 'job_123',
      submissionId: 'sub_123',
      submissionUpdatedAt: new Date('2026-06-20T00:00:00Z'),
      committedAt: expect.any(Date),
      updateData: {
        denialReason: null,
        denialNote: null,
        reviewedAt: expect.any(Date),
        updatedAt: expect.any(Date),
        notePurpose: 'school',
        otherNotePurpose: null,
      },
    })
    expect(mockRecordApprovalEmailSent).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(mockSendSupportSms).not.toHaveBeenCalled()
  })
})
