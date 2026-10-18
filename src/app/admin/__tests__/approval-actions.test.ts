import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SubmissionStatus } from '@/db/types'
import type { Refusal, Transition } from '@/db/submission-lifecycle'

const {
  mockPermit,
  mockTransition,
  mockFindSubmissionGuardianDetails,
  mockRecordApprovalEmailSent,
  mockRemoveSubmissionGuardian,
  mockSendApprovalEmail,
  mockSendTransactionalSmsForSubmission,
  mockGenerateDoctorNotePDF,
  mockGeneratePDFFilename,
  mockGenerateQrCodeDataUrl,
  mockCreateNoteVerification,
  mockGetVerificationUrl,
  mockNormalizeMedicalRecordNumber,
  mockParseIssueDateInput,
  mockRevokeNoteVerificationById,
  mockRevokeOtherNoteVerificationsForSubmission,
  mockRevokeNoteVerificationForSubmission,
  mockGetSession,
} = vi.hoisted(() => ({
  mockPermit: vi.fn(),
  mockTransition: vi.fn(),
  mockFindSubmissionGuardianDetails: vi.fn(),
  mockRecordApprovalEmailSent: vi.fn(),
  mockRemoveSubmissionGuardian: vi.fn(),
  mockSendApprovalEmail: vi.fn(),
  mockSendTransactionalSmsForSubmission: vi.fn(),
  mockGenerateDoctorNotePDF: vi.fn(),
  mockGeneratePDFFilename: vi.fn(),
  mockGenerateQrCodeDataUrl: vi.fn(),
  mockCreateNoteVerification: vi.fn(),
  mockGetVerificationUrl: vi.fn(),
  mockNormalizeMedicalRecordNumber: vi.fn((input: string) =>
    input
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  ),
  mockParseIssueDateInput: vi.fn(),
  mockRevokeNoteVerificationById: vi.fn(),
  mockRevokeOtherNoteVerificationsForSubmission: vi.fn(),
  mockRevokeNoteVerificationForSubmission: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('@/db/submission-lifecycle', () => ({
  permit: mockPermit,
  transition: mockTransition,
}))

vi.mock('@/db/submissions', () => ({
  findSubmissionGuardianDetails: mockFindSubmissionGuardianDetails,
  recordApprovalEmailSent: mockRecordApprovalEmailSent,
  removeSubmissionGuardian: mockRemoveSubmissionGuardian,
}))

vi.mock('@/lib/email', () => ({
  sendDenialEmail: vi.fn(),
  sendApprovalEmail: mockSendApprovalEmail,
  sendMaybeEmail: vi.fn(),
}))

vi.mock('@/lib/telnyx', () => ({
  sendTransactionalSmsForSubmission: mockSendTransactionalSmsForSubmission,
}))

vi.mock('@/lib/pdf/generate-pdf', () => ({
  generateDoctorNotePDF: mockGenerateDoctorNotePDF,
  generatePDFFilename: mockGeneratePDFFilename,
}))

vi.mock('@/lib/qr-code', () => ({
  generateQrCodeDataUrl: mockGenerateQrCodeDataUrl,
}))

vi.mock('@/lib/note-verification', () => ({
  createNoteVerification: mockCreateNoteVerification,
  getVerificationUrl: mockGetVerificationUrl,
  normalizeMedicalRecordNumber: mockNormalizeMedicalRecordNumber,
  parseIssueDateInput: mockParseIssueDateInput,
}))

vi.mock('@/db/note-verifications', () => ({
  revokeNoteVerificationById: mockRevokeNoteVerificationById,
  revokeOtherNoteVerificationsForSubmission: mockRevokeOtherNoteVerificationsForSubmission,
  revokeNoteVerificationForSubmission: mockRevokeNoteVerificationForSubmission,
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    constructor() {}
  },
}))

import { approveSubmission, reApproveSubmission } from '@/app/admin/_actions/approve'
import { removeGuardianFromAdultSubmission } from '@/app/admin/_actions/edits'

function permits(transition: Transition, row: object) {
  mockPermit.mockResolvedValue({ ok: true, value: { transition, row } })
}

function refuses(refusal: Refusal) {
  mockPermit.mockResolvedValue({ ok: false, refusal })
}

function expectTransition(transition: Transition, input: object) {
  expect(mockTransition).toHaveBeenCalledWith(expect.objectContaining({ transition }), input)
}

function expectNoSubmissionUpdates() {
  expect(mockTransition).not.toHaveBeenCalled()
  expect(mockRecordApprovalEmailSent).not.toHaveBeenCalled()
  expect(mockRemoveSubmissionGuardian).not.toHaveBeenCalled()
}

const mockDefaultIssueDate = new Date(Date.UTC(2026, 3, 6))
const mockVerificationRecord = {
  id: 'verification_123',
  medicalRecordNumber: 'A7B3C9D2',
  verificationSlug: 'v_testslug',
}
const mockVerificationPdfInfo = {
  medicalRecordNumber: 'A7B3C9D2',
  verificationUrl: `https://verify.test/${mockVerificationRecord.verificationSlug}`,
  qrCodeDataUrl: 'data:image/png;base64,qr',
}

describe('approveSubmission - Approval Automation', () => {
  const mockSubmissionId = 'sub_123'
  const mockDoctorId = 'doctor_123'
  const mockPDFBuffer = Buffer.from('mock-pdf-content')
  const mockPDFFilename = 'doctors-note-sub_123.pdf'

  const mockSubmission = {
    id: mockSubmissionId,
    status: SubmissionStatus.PENDING_REVIEW,
    email: 'patient@example.com',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: new Date('1990-01-01'),
    guardianFirstName: null,
    guardianLastName: null,
    guardianDateOfBirth: null,
    recipient: 'myself',
    firstDayOff: new Date('2024-01-15'),
    lastDayOff: new Date('2024-01-17'),
    notePurpose: 'work',
    otherNotePurpose: null,
    absenceReason: 'illness',
    otherAbsenceReason: null,
    symptoms: ['Fever', 'Cough'],
    otherSymptomText: null,
    additionalInformation: 'Flu symptoms',
    state: 'CA',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    stripePaymentIntentId: 'pi_test_123',
    stripeRefundId: null,
    refundedAt: null,
    denialReason: null,
    reviewedAt: null,
    reviewedByAdminId: null,
    approvalEmailSentAt: null,
    denialEmailSentAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })
    mockParseIssueDateInput.mockImplementation((evaluationDate?: string) => {
      if (!evaluationDate) return mockDefaultIssueDate
      const [year, month, day] = evaluationDate.split('-').map(Number)
      return new Date(Date.UTC(year, month - 1, day))
    })
    mockTransition.mockImplementation(async (step: { row: object }) => ({
      ok: true,
      value: step.row,
    }))
    mockCreateNoteVerification.mockResolvedValue(mockVerificationRecord)
    mockGetVerificationUrl.mockImplementation((slug: string) => `https://verify.test/${slug}`)
    mockGenerateQrCodeDataUrl.mockResolvedValue(mockVerificationPdfInfo.qrCodeDataUrl)
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful approval flow', () => {
    it('should successfully approve submission with PDF and email', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({ success: true })

      expect(mockPermit).toHaveBeenCalledWith(mockSubmissionId, 'approveManual', 'approve')

      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
        mockSubmission,
        mockDefaultIssueDate,
        undefined,
        true,
        mockVerificationPdfInfo
      )

      expect(mockGeneratePDFFilename).toHaveBeenCalledWith(mockSubmission.id)

      expect(mockSendApprovalEmail).toHaveBeenCalledWith({
        to: 'patient@example.com',
        patientName: 'John Doe',
        notePurpose: 'work',
        absenceReason: 'illness',
        medicalRecordNumber: mockVerificationPdfInfo.medicalRecordNumber,
        verificationUrl: mockVerificationPdfInfo.verificationUrl,
        pdfBuffer: mockPDFBuffer,
        pdfFilename: mockPDFFilename,
      })

      expect(mockTransition).toHaveBeenCalledTimes(1)
      expectTransition('approve', {
        adminId: mockDoctorId,
        at: expect.any(Date),
        diagnosis: null,
        withRestrictions: true,
      })
      expect(mockRecordApprovalEmailSent).toHaveBeenCalledTimes(1)
      expect(mockRecordApprovalEmailSent).toHaveBeenCalledWith(mockSubmissionId, expect.any(Date))
    })

    it('sends approval SMS after the approval email succeeds', async () => {
      permits('approve', {
        ...mockSubmission,
        phone: '(555) 123-4567',
        smsOptIn: true,
      })
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })
      mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({ success: true })
      expect(mockSendApprovalEmail).toHaveBeenCalled()
      expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
        submission: expect.objectContaining({
          id: mockSubmissionId,
          phone: '(555) 123-4567',
          smsOptIn: true,
        }),
        type: 'APPROVAL_SENT',
        body: expect.stringMatching(
          /doctor's note was sent[\s\S]*Reply HELP[\s\S]*STOP to opt out/
        ),
      })
    })

    it('should handle different note purposes correctly', async () => {
      const schoolSubmission = {
        ...mockSubmission,
        notePurpose: 'school',
      }
      permits('approve', schoolSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({ success: true })
      expect(mockSendApprovalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          notePurpose: 'school',
        })
      )
    })

    it('should handle "both" note purpose correctly', async () => {
      const bothSubmission = {
        ...mockSubmission,
        notePurpose: 'both',
      }
      permits('approve', bothSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({ success: true })
      expect(mockSendApprovalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          notePurpose: 'both',
        })
      )
    })

    it('should pass custom evaluation date to PDF generation', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId, '2024-01-20')

      expect(result).toEqual({ success: true })

      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
        mockSubmission,
        new Date(Date.UTC(2024, 0, 20)),
        undefined,
        true,
        mockVerificationPdfInfo
      )
    })

    it('approves a MANUAL submission without generating a PDF or sending email', async () => {
      permits('approveManual', { ...mockSubmission, status: SubmissionStatus.MANUAL })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({ success: true })
      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
      expect(mockTransition).toHaveBeenCalledTimes(1)
      expectTransition('approveManual', { adminId: mockDoctorId, at: expect.any(Date) })
    })
  })

  describe('withRestrictions parameter', () => {
    it('should pass withRestrictions=true (default) to PDF generation', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({ success: true })
      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
        mockSubmission,
        mockDefaultIssueDate,
        undefined,
        true,
        mockVerificationPdfInfo
      )
    })

    it('should pass withRestrictions=true explicitly to PDF generation', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId, undefined, undefined, true)

      expect(result).toEqual({ success: true })
      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
        mockSubmission,
        mockDefaultIssueDate,
        undefined,
        true,
        mockVerificationPdfInfo
      )
    })

    it('should pass withRestrictions=false to PDF generation when specified', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId, undefined, undefined, false)

      expect(result).toEqual({ success: true })
      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
        mockSubmission,
        mockDefaultIssueDate,
        undefined,
        false,
        mockVerificationPdfInfo
      )
    })
  })

  describe('PDF generation failure scenarios (BLOCKING)', () => {
    it('should block approval if PDF generation fails', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockRejectedValue(new Error('Missing signature image'))

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({
        success: false,
        error: 'Failed to generate PDF: Missing signature image',
      })

      expectNoSubmissionUpdates()

      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('should block approval if doctor env vars missing', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockRejectedValue(
        new Error('Missing required doctor environment variables')
      )

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({
        success: false,
        error: 'Failed to generate PDF: Missing required doctor environment variables',
      })

      expectNoSubmissionUpdates()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })
  })

  describe('Email failure scenarios (NON-BLOCKING)', () => {
    it('should still approve if email fails but PDF generation succeeds', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockRejectedValue(new Error('Email service unavailable'))

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({
        success: true,
        warning: 'Submission approved, but email notification failed to send',
      })

      expect(mockGenerateDoctorNotePDF).toHaveBeenCalled()

      expect(mockSendApprovalEmail).toHaveBeenCalled()

      expect(mockTransition).toHaveBeenCalledTimes(1)
      expectTransition('approve', expect.objectContaining({ adminId: mockDoctorId }))
      expect(mockRecordApprovalEmailSent).not.toHaveBeenCalled()
      expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
    })
  })

  describe('Concurrent approval guard', () => {
    it('should revoke the new verifier and not email if the submission changed before approval is committed', async () => {
      permits('approve', mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockTransition.mockResolvedValue({ ok: false, refusal: { reason: 'stale' } })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({
        success: false,
        error: 'Submission was already updated. Please refresh and try again.',
      })
      expect(mockRevokeNoteVerificationById).toHaveBeenCalledWith(
        mockVerificationRecord.id,
        expect.any(Date)
      )
      expect(mockRevokeOtherNoteVerificationsForSubmission).not.toHaveBeenCalled()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
      expect(mockRecordApprovalEmailSent).not.toHaveBeenCalled()
    })
  })

  describe('Validation scenarios', () => {
    it('should fail if submission not found', async () => {
      refuses({ reason: 'missing' })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({
        success: false,
        error: 'Submission not found',
      })

      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expectNoSubmissionUpdates()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('should fail if submission already approved', async () => {
      refuses({ reason: 'status', status: SubmissionStatus.APPROVED })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({
        success: false,
        error: 'Cannot approve submission with status: APPROVED',
      })

      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expectNoSubmissionUpdates()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('should fail if submission already denied', async () => {
      refuses({ reason: 'status', status: SubmissionStatus.DENIED })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({
        success: false,
        error: 'Cannot approve submission with status: DENIED',
      })

      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expectNoSubmissionUpdates()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('redirects to the admin login without a session', async () => {
      mockGetSession.mockResolvedValue(null)

      await expect(approveSubmission(mockSubmissionId)).rejects.toMatchObject({
        digest: expect.stringContaining(';/admin/login;'),
      })

      expect(mockPermit).not.toHaveBeenCalled()
      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expectNoSubmissionUpdates()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })
  })

  describe('Guardian information handling', () => {
    it('should handle submissions with guardian information (minors)', async () => {
      const minorSubmission = {
        ...mockSubmission,
        recipient: 'someone_else',
        guardianFirstName: 'Jane',
        guardianLastName: 'Doe',
        guardianDateOfBirth: new Date('1980-05-15'),
      }
      permits('approve', minorSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })

      const result = await approveSubmission(mockSubmissionId)

      expect(result).toEqual({ success: true })

      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          guardianFirstName: 'Jane',
          guardianLastName: 'Doe',
          recipient: 'someone_else',
        }),
        mockDefaultIssueDate,
        undefined,
        true,
        mockVerificationPdfInfo
      )
    })
  })
})

describe('removeGuardianFromAdultSubmission', () => {
  const mockSubmissionId = 'sub_guardian'
  const mockDoctorId = 'doctor_123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('clears guardian mode for adult patients', async () => {
    mockFindSubmissionGuardianDetails.mockResolvedValue({
      id: mockSubmissionId,
      patientDateOfBirth: new Date('1990-01-01'),
      recipient: 'someone_else',
      guardianFirstName: 'Jane',
      guardianLastName: 'Doe',
      guardianDateOfBirth: new Date('1970-01-01'),
    })

    const result = await removeGuardianFromAdultSubmission(mockSubmissionId)

    expect(result).toEqual({ success: true })
    expect(mockFindSubmissionGuardianDetails).toHaveBeenCalledWith(mockSubmissionId)
    expect(mockRemoveSubmissionGuardian).toHaveBeenCalledWith(mockSubmissionId, expect.any(Date))
  })

  it('blocks guardian removal for minor patients', async () => {
    mockFindSubmissionGuardianDetails.mockResolvedValue({
      id: mockSubmissionId,
      patientDateOfBirth: new Date('2020-01-01'),
      recipient: 'someone_else',
      guardianFirstName: 'Jane',
      guardianLastName: 'Doe',
      guardianDateOfBirth: new Date('1970-01-01'),
    })

    const result = await removeGuardianFromAdultSubmission(mockSubmissionId)

    expect(result).toEqual({
      success: false,
      error: 'Guardian information is required for patients under 18.',
    })
    expectNoSubmissionUpdates()
  })
})

describe('reApproveSubmission - Re-approve already approved submission', () => {
  const mockSubmissionId = 'sub_123'
  const mockDoctorId = 'doctor_123'
  const mockPDFBuffer = Buffer.from('mock-pdf-content')
  const mockPDFFilename = 'doctors-note-sub_123.pdf'

  const mockApprovedSubmission = {
    id: mockSubmissionId,
    status: SubmissionStatus.APPROVED,
    email: 'patient@example.com',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: new Date('1990-01-01'),
    guardianFirstName: null,
    guardianLastName: null,
    guardianDateOfBirth: null,
    recipient: 'myself',
    firstDayOff: new Date('2024-01-15'),
    lastDayOff: new Date('2024-01-17'),
    notePurpose: 'work',
    otherNotePurpose: null,
    absenceReason: 'illness',
    otherAbsenceReason: null,
    symptoms: ['Fever', 'Cough'],
    otherSymptomText: null,
    additionalInformation: 'Flu symptoms',
    state: 'CA',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    stripePaymentIntentId: 'pi_test_123',
    stripeRefundId: null,
    refundedAt: null,
    denialReason: null,
    reviewedAt: new Date('2024-01-11'),
    reviewedByAdminId: mockDoctorId,
    approvalEmailSentAt: new Date('2024-01-11'),
    denialEmailSentAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })
    mockParseIssueDateInput.mockImplementation((evaluationDate?: string) => {
      if (!evaluationDate) return mockDefaultIssueDate
      const [year, month, day] = evaluationDate.split('-').map(Number)
      return new Date(Date.UTC(year, month - 1, day))
    })
    mockCreateNoteVerification.mockResolvedValue(mockVerificationRecord)
    mockGetVerificationUrl.mockImplementation((slug: string) => `https://verify.test/${slug}`)
    mockGenerateQrCodeDataUrl.mockResolvedValue(mockVerificationPdfInfo.qrCodeDataUrl)
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)
    mockTransition.mockImplementation(async (step: { row: object }) => ({
      ok: true,
      value: step.row,
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should regenerate PDF and resend email for APPROVED submission (wire-up regression)', async () => {
    permits('reapprove', mockApprovedSubmission)
    mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
    mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
    mockSendApprovalEmail.mockResolvedValue({ success: true })

    const result = await reApproveSubmission(mockSubmissionId, '2024-01-20', 'flu', true)

    expect(result).toEqual({ success: true })

    expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
      mockApprovedSubmission,
      new Date(Date.UTC(2024, 0, 20)),
      'flu',
      true,
      mockVerificationPdfInfo
    )

    expect(mockSendApprovalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'patient@example.com',
        patientName: 'John Doe',
        pdfBuffer: mockPDFBuffer,
        pdfFilename: mockPDFFilename,
      })
    )

    expect(mockPermit).toHaveBeenCalledWith(mockSubmissionId, 'reapprove')
    expect(mockTransition).toHaveBeenCalledTimes(1)
    expectTransition('reapprove', {
      adminId: mockDoctorId,
      at: expect.any(Date),
      diagnosis: 'flu',
      withRestrictions: true,
    })
    expect(mockRecordApprovalEmailSent).toHaveBeenCalledTimes(1)
    expect(mockRecordApprovalEmailSent).toHaveBeenCalledWith(mockSubmissionId, expect.any(Date))
  })

  it('sends approval SMS after the re-approval email succeeds', async () => {
    permits('reapprove', {
      ...mockApprovedSubmission,
      phone: '(555) 123-4567',
      smsOptIn: true,
    })
    mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
    mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
    mockSendApprovalEmail.mockResolvedValue({ success: true })
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)

    const result = await reApproveSubmission(mockSubmissionId)

    expect(result).toEqual({ success: true })
    expect(mockSendApprovalEmail).toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: mockSubmissionId,
        phone: '(555) 123-4567',
        smsOptIn: true,
      }),
      type: 'APPROVAL_SENT',
      body: expect.stringMatching(/doctor's note was sent[\s\S]*Reply HELP[\s\S]*STOP to opt out/),
    })
  })

  it('should NOT short-circuit on APPROVED status (unlike approveSubmission)', async () => {
    refuses({ reason: 'status', status: SubmissionStatus.APPROVED })
    const approveResult = await approveSubmission(mockSubmissionId)
    expect(approveResult).toEqual({
      success: false,
      error: 'Cannot approve submission with status: APPROVED',
    })
    expect(mockPermit).toHaveBeenCalledWith(mockSubmissionId, 'approveManual', 'approve')
    expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()

    permits('reapprove', mockApprovedSubmission)
    mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
    mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
    mockSendApprovalEmail.mockResolvedValue({ success: true })

    const reApproveResult = await reApproveSubmission(mockSubmissionId)
    expect(reApproveResult).toEqual({ success: true })
    expect(mockPermit).toHaveBeenLastCalledWith(mockSubmissionId, 'reapprove')
    expect(mockGenerateDoctorNotePDF).toHaveBeenCalledTimes(1)
    expect(mockSendApprovalEmail).toHaveBeenCalledTimes(1)
  })

  it('should return a warning if email fails but still update DB', async () => {
    permits('reapprove', mockApprovedSubmission)
    mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
    mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
    mockSendApprovalEmail.mockRejectedValue(new Error('Resend down'))

    const result = await reApproveSubmission(mockSubmissionId)

    expect(result.success).toBe(true)
    expect(result.warning).toBeDefined()
    expect(mockTransition).toHaveBeenCalledTimes(1)
    expectTransition('reapprove', expect.objectContaining({ adminId: mockDoctorId }))
    expect(mockRecordApprovalEmailSent).not.toHaveBeenCalled()
  })

  it('should revoke the new verifier and not email if re-approval loses the optimistic update', async () => {
    permits('reapprove', mockApprovedSubmission)
    mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
    mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
    mockTransition.mockResolvedValue({ ok: false, refusal: { reason: 'stale' } })

    const result = await reApproveSubmission(mockSubmissionId)

    expect(result).toEqual({
      success: false,
      error: 'Submission was already updated. Please refresh and try again.',
    })
    expect(mockRevokeNoteVerificationById).toHaveBeenCalledWith(
      mockVerificationRecord.id,
      expect.any(Date)
    )
    expect(mockRevokeOtherNoteVerificationsForSubmission).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(mockRecordApprovalEmailSent).not.toHaveBeenCalled()
  })

  it('should fail if PDF generation fails (BLOCKING)', async () => {
    permits('reapprove', mockApprovedSubmission)
    mockGenerateDoctorNotePDF.mockRejectedValue(new Error('Font missing'))

    const result = await reApproveSubmission(mockSubmissionId)

    expect(result).toEqual({
      success: false,
      error: 'Failed to generate PDF: Font missing',
    })
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expectNoSubmissionUpdates()
  })

  it('should fail if submission not found', async () => {
    refuses({ reason: 'missing' })

    const result = await reApproveSubmission(mockSubmissionId)

    expect(result).toEqual({ success: false, error: 'Submission not found' })
    expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expectNoSubmissionUpdates()
  })
})
