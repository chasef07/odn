import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { db } from '../pool'
import { sql } from '../sql'
import { insert, selectAll } from '../table'
import {
  noteVerifications,
  smsMessages,
  smsSupportJobs,
  smsSupportTickets,
  submissions,
  users,
} from '../tables'
import {
  acknowledgeFollowUpEmailSent,
  approveManualSubmission,
  approveReviewableSubmission,
  commitSupportAutomationSubmissionUpdate,
  deleteAllSubmissions,
  deleteSubmissionById,
  denyManualSubmission,
  insertSubmission,
  markMaybeSubmissionManual,
  markPendingSubmissionMaybe,
  markSubmissionDenied,
  markSubmissionDeniedAndRefunded,
  markSubmissionManual,
  markSubmissionMaybe,
  markSubmissionRefundReserved,
  reapproveSubmission,
  recordApprovalEmailSent,
  recordDenialEmailSent,
  recordMaybeEmailSent,
  recordSubmissionRefund,
  releaseFollowUpEmailClaimAt,
  releaseSubmissionRefundReservation,
  removeSubmissionGuardian,
  returnSubmissionToReview,
  updatePendingSubmissionClassification,
  updateSubmissionDetails,
  countSmsOptedInSubmissionsForPhone,
  countSubmissions,
  countSubmissionsByStatus,
  findApprovedSubmissionBirthDateForSupport,
  findApprovedSubmissionIdForSupportTicket,
  findApprovedSubmissionsForEmail,
  findApprovedSubmissionsMissingApprovalEmail,
  findApprovedSubmissionsOverlapping,
  findApprovedSupportSubmissionIdsByReference,
  findBusinessAnalyticsPage,
  findDueFollowUpEmails,
  findFriendsFamilyAnalyticsPage,
  findFriendsFamilyCustomerSubmissions,
  findLatestApprovedSubmissionIdsForSupportPhone,
  findLatestSubmission,
  findLatestSubmissionIdForInboundSmsPhone,
  findLatestSubmissionsForBouncedEmail,
  findManualSubmissions,
  findMaybeSubmissions,
  findPatientHistory,
  findRecentSubmissions,
  findSmsSupportSubmissionCandidatesForPhone,
  findSubmissionById,
  findSubmissionForAdminDetail,
  findSubmissionForDenial,
  findSubmissionForSupportTicket,
  findSubmissionGuardianDetails,
  findSubmissionIdForPaymentIntent,
  findSubmissionIdsByStatus,
  findSubmissionSmsContact,
  findSubmissionStatus,
  findSubmissionsApprovedSince,
  findSubmissionsDeniedSince,
  findSubmissionsPendingReview,
  claimDueFollowUpEmail,
  searchSubmissionsPage,
} from '../submissions'
import { SubmissionStatus, type Submission } from '../types'

const DOB = new Date('1990-05-15T00:00:00.000Z')
const FIRST_DAY = new Date('2026-03-02T00:00:00.000Z')
const LAST_DAY = new Date('2026-03-04T00:00:00.000Z')
const T0 = new Date('2026-03-05T12:00:00.000Z')

function at(hoursAfterT0: number): Date {
  return new Date(T0.getTime() + hoursAfterT0 * 60 * 60 * 1000)
}

const baseSubmission = {
  status: SubmissionStatus.PENDING_REVIEW,
  state: 'CA',
  recipient: 'myself',
  patientFirstName: 'John',
  patientLastName: 'Doe',
  patientDateOfBirth: DOB,
  email: 'john@example.com',
  phone: '(555) 123-4567',
  smsOptIn: false,
  notePurpose: 'work',
  firstDayOff: FIRST_DAY,
  lastDayOff: LAST_DAY,
  absenceReason: 'illness',
}

async function seed(overrides: Partial<Submission> = {}): Promise<Submission> {
  const id = overrides.id ?? randomUUID()
  const row = await db.one(
    sql`${insert(submissions, { ...baseSubmission, id, stripePaymentIntentId: `pi_${id}`, createdAt: T0, ...overrides })} RETURNING ${selectAll(submissions)}`
  )
  if (!row) throw new Error('seed failed')
  return row
}

async function seedAdmin(id = 'admin_1'): Promise<string> {
  await db.affected(
    sql`${insert(users, { id, email: `${id}@example.com`, emailVerified: true, name: 'Doc' })}`
  )
  return id
}

async function seedVerification(
  submissionId: string,
  overrides: Partial<{
    medicalRecordNumber: string
    status: 'ACTIVE' | 'REVOKED'
    revokedAt: Date | null
    createdAt: Date
  }> = {}
): Promise<string> {
  const id = randomUUID()
  await db.affected(
    sql`${insert(noteVerifications, {
      id,
      submissionId,
      medicalRecordNumber: overrides.medicalRecordNumber ?? `MRN${id.slice(0, 6)}`,
      verificationSlug: `slug-${id}`,
      status: overrides.status ?? 'ACTIVE',
      issueDate: FIRST_DAY,
      patientInitials: 'JD',
      firstDayOff: FIRST_DAY,
      lastDayOff: LAST_DAY,
      returnGuidance: 'rest',
      physicianName: 'Dr',
      physicianCredentials: 'MD',
      physicianNpi: null,
      licenseState: null,
      licenseNumber: null,
      revokedAt: overrides.revokedAt ?? null,
      createdAt: overrides.createdAt ?? T0,
    })}`
  )
  return id
}

async function seedSms(
  submissionId: string,
  overrides: Partial<{
    direction: string
    to: string | null
    sentAt: Date | null
    createdAt: Date
  }> = {}
): Promise<string> {
  const id = randomUUID()
  await db.affected(
    sql`${insert(smsMessages, {
      id,
      submissionId,
      supportTicketId: null,
      type: 'PURCHASE_CONFIRMATION',
      direction: overrides.direction ?? 'outbound',
      to: overrides.to ?? '+15551234567',
      from: '+15550000000',
      body: 'hi',
      providerMessageId: null,
      providerStatus: 'delivered',
      errorCode: null,
      errorMessage: null,
      supportHandledAt: null,
      sentAt: overrides.sentAt === undefined ? T0 : overrides.sentAt,
      receivedAt: null,
      finalizedAt: null,
      createdAt: overrides.createdAt ?? T0,
    })}`
  )
  return id
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id)
const page = { skip: 0, take: 10 }

describe('submission lookups', () => {
  it('returns the full row with dates as UTC midnight and JSON columns intact, or null', async () => {
    const seeded = await seed({
      attribution: { last: { channel: 'reddit' } },
      symptoms: ['Fever', 'Cough'],
      guardianDateOfBirth: new Date('1960-01-31T00:00:00.000Z'),
    })

    const found = await findSubmissionById(seeded.id)

    expect(found).toEqual(seeded)
    expect(found?.patientDateOfBirth).toEqual(DOB)
    expect(found?.guardianDateOfBirth).toEqual(new Date('1960-01-31T00:00:00.000Z'))
    expect(found?.attribution).toEqual({ last: { channel: 'reddit' } })
    expect(found?.symptoms).toEqual(['Fever', 'Cough'])
    expect(await findSubmissionById('missing')).toBeNull()
  })

  it('partial lookups return exactly their declared fields for the requested row', async () => {
    await seed({ patientFirstName: 'Decoy', smsPhoneE164: '+15550000000', recipient: 'child' })
    const seeded = await seed({
      stripeRefundId: 're_1',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
      guardianFirstName: 'Jane',
      guardianLastName: 'Doe',
    })

    expect(await findSubmissionStatus(seeded.id)).toEqual({ status: 'PENDING_REVIEW' })
    expect(await findSubmissionForDenial(seeded.id)).toEqual({
      id: seeded.id,
      stripePaymentIntentId: seeded.stripePaymentIntentId,
      stripeRefundId: 're_1',
      email: 'john@example.com',
      phone: '(555) 123-4567',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      status: 'PENDING_REVIEW',
    })
    expect(await findSubmissionGuardianDetails(seeded.id)).toEqual({
      id: seeded.id,
      patientDateOfBirth: DOB,
      recipient: 'myself',
      guardianFirstName: 'Jane',
      guardianLastName: 'Doe',
      guardianDateOfBirth: null,
    })
    expect(await findSubmissionSmsContact(seeded.id)).toEqual({
      phone: '(555) 123-4567',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
    })
    expect(await findSubmissionForSupportTicket(seeded.id)).toEqual({
      id: seeded.id,
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
      patientFirstName: 'John',
      patientLastName: 'Doe',
    })
    expect(await findSubmissionIdForPaymentIntent(seeded.stripePaymentIntentId)).toEqual({
      id: seeded.id,
    })
    expect(await findSubmissionIdForPaymentIntent('pi_missing')).toBeNull()
    expect(await findSubmissionStatus('missing')).toBeNull()
  })

  it('admin detail carries the newest active verification and every SMS newest first', async () => {
    const other = await seed()
    await seedVerification(other.id, { createdAt: at(6) })
    await seedSms(other.id, { createdAt: at(6) })
    const seeded = await seed()
    await seedVerification(seeded.id, { status: 'REVOKED', createdAt: at(5) })
    await seedVerification(seeded.id, { status: 'REVOKED', revokedAt: at(1), createdAt: at(3) })
    await seedVerification(seeded.id, { revokedAt: at(1), createdAt: at(4) })
    await seedVerification(seeded.id, { createdAt: at(1) })
    const newestActive = await seedVerification(seeded.id, { createdAt: at(2) })
    const older = await seedSms(seeded.id, { createdAt: at(1) })
    const newer = await seedSms(seeded.id, { createdAt: at(2) })

    const detail = await findSubmissionForAdminDetail(seeded.id)

    expect(detail).toMatchObject(seeded)
    expect(ids(detail!.noteVerifications)).toEqual([newestActive])
    expect(ids(detail!.smsMessages)).toEqual([newer, older])
    expect(Object.keys(detail!.smsMessages[0]).sort()).toEqual(
      [
        'id',
        'type',
        'direction',
        'providerStatus',
        'errorCode',
        'errorMessage',
        'sentAt',
        'receivedAt',
        'finalizedAt',
        'createdAt',
      ].sort()
    )
    expect(await findSubmissionForAdminDetail('missing')).toBeNull()
  })
})

describe('status queues', () => {
  it('lists pending submissions oldest first whatever else is set on them', async () => {
    const latest = await seed({ createdAt: at(3) })
    const oldest = await seed({ createdAt: at(1) })
    const middle = await seed({ createdAt: at(2), followUpEmailSentAt: at(4) })
    await seed({ status: SubmissionStatus.APPROVED })

    expect(ids(await findSubmissionsPendingReview())).toEqual([oldest.id, middle.id, latest.id])
  })

  it('lists ids by status within the reviewed window, capped by take', async () => {
    const admin = await seedAdmin()
    const recent = await seed({
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
    })
    await seed({ status: SubmissionStatus.APPROVED, reviewedAt: at(-1), reviewedByAdminId: admin })
    await seed({ status: SubmissionStatus.DENIED, reviewedAt: at(1), reviewedByAdminId: admin })

    expect(
      await findSubmissionIdsByStatus({ status: SubmissionStatus.APPROVED, reviewedSince: T0 }, 10)
    ).toEqual([{ id: recent.id }])
    expect(await findSubmissionIdsByStatus({ status: SubmissionStatus.APPROVED }, 10)).toHaveLength(
      2
    )
    expect(await findSubmissionIdsByStatus({ status: SubmissionStatus.APPROVED }, 1)).toHaveLength(
      1
    )
  })

  it('lists approved and denied submissions reviewed since a time, newest email first', async () => {
    const admin = await seedAdmin()
    const approvedEarly = await seed({
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      approvalEmailSentAt: at(1),
    })
    const approvedLate = await seed({
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      approvalEmailSentAt: at(2),
    })
    await seed({ status: SubmissionStatus.APPROVED, reviewedAt: at(-1), reviewedByAdminId: admin })
    const deniedEarly = await seed({
      status: SubmissionStatus.DENIED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      denialEmailSentAt: at(1),
    })
    const deniedLate = await seed({
      status: SubmissionStatus.DENIED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      denialEmailSentAt: at(2),
    })
    await seed({ status: SubmissionStatus.DENIED, reviewedAt: at(-1), reviewedByAdminId: admin })

    const approved = await findSubmissionsApprovedSince(T0, 10)
    expect(ids(approved)).toEqual([approvedLate.id, approvedEarly.id])
    expect(approved[0]).toEqual({
      id: approvedLate.id,
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      approvalEmailSentAt: at(2),
    })
    expect(ids(await findSubmissionsApprovedSince(T0, 1))).toEqual([approvedLate.id])
    const denied = await findSubmissionsDeniedSince(T0, 10)
    expect(ids(denied)).toEqual([deniedLate.id, deniedEarly.id])
    expect(denied[1]).toEqual({
      id: deniedEarly.id,
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      denialEmailSentAt: at(1),
    })
    expect(ids(await findSubmissionsDeniedSince(T0, 1))).toEqual([deniedLate.id])
  })

  it('lists maybe and manual submissions most recently reviewed first', async () => {
    const admin = await seedAdmin()
    const maybeOld = await seed({
      status: SubmissionStatus.MAYBE,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      maybeReason: 'OTHER_REVIEW',
      maybeApprovedDays: 2,
    })
    const maybeNew = await seed({
      status: SubmissionStatus.MAYBE,
      reviewedAt: at(2),
      reviewedByAdminId: admin,
    })
    const manualOld = await seed({
      status: SubmissionStatus.MANUAL,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
    })
    const manualNew = await seed({
      status: SubmissionStatus.MANUAL,
      reviewedAt: at(2),
      reviewedByAdminId: admin,
    })

    const maybes = await findMaybeSubmissions()
    expect(ids(maybes)).toEqual([maybeNew.id, maybeOld.id])
    expect(maybes[1]).toEqual({
      id: maybeOld.id,
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      patientDateOfBirth: DOB,
      recipient: 'myself',
      guardianFirstName: null,
      guardianLastName: null,
      guardianDateOfBirth: null,
      firstDayOff: FIRST_DAY,
      lastDayOff: LAST_DAY,
      maybeReason: 'OTHER_REVIEW',
      maybeApprovedDays: 2,
      maybeEmailSentAt: null,
      reviewedAt: at(1),
    })
    const manuals = await findManualSubmissions()
    expect(ids(manuals)).toEqual([manualNew.id, manualOld.id])
    expect(manuals[1]).toEqual({
      id: manualOld.id,
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      firstDayOff: FIRST_DAY,
      lastDayOff: LAST_DAY,
      reviewedAt: at(1),
    })
  })
})

describe('patient history', () => {
  it('matches the patient identity or email without case, excluding the current submission', async () => {
    const current = await seed()
    const sameIdentity = await seed({
      patientFirstName: 'JOHN',
      patientLastName: 'doe',
      email: 'other@example.com',
      createdAt: at(1),
    })
    const sameEmail = await seed({
      patientFirstName: 'Jane',
      email: 'JOHN@example.com',
      createdAt: at(2),
    })
    await seed({ patientFirstName: 'Jane', email: 'jane@example.com' })
    await seed({ patientDateOfBirth: new Date('1991-05-15T00:00:00.000Z'), email: 'x@y.co' })

    const history = await findPatientHistory({
      patientFirstName: 'john',
      patientLastName: 'DOE',
      patientDateOfBirth: DOB,
      email: 'john@EXAMPLE.com',
      excludeSubmissionId: current.id,
    })

    expect(ids(history)).toEqual([sameEmail.id, sameIdentity.id])
    expect(Object.keys(history[0]).sort()).toEqual(
      [
        'id',
        'patientFirstName',
        'patientLastName',
        'email',
        'status',
        'notePurpose',
        'firstDayOff',
        'lastDayOff',
        'createdAt',
        'reviewedAt',
        'denialReason',
      ].sort()
    )
  })

  it('returns only the 20 newest matches', async () => {
    const current = await seed()
    const matches: Submission[] = []
    for (let hour = 1; hour <= 21; hour++) {
      matches.push(await seed({ patientFirstName: 'Jane', createdAt: at(hour) }))
    }

    const history = await findPatientHistory({
      patientFirstName: 'Nobody',
      patientLastName: 'Doe',
      patientDateOfBirth: DOB,
      email: 'john@example.com',
      excludeSubmissionId: current.id,
    })

    expect(ids(history)).toEqual(ids(matches.slice(1).reverse()))
  })
})

describe('searchSubmissionsPage', () => {
  it('pages newest first and reports the unfiltered total when there is no search', async () => {
    const first = await seed({ createdAt: at(1) })
    const second = await seed({ createdAt: at(2) })
    const third = await seed({ createdAt: at(3) })

    const page1 = await searchSubmissionsPage(null, { skip: 0, take: 2 })
    const page2 = await searchSubmissionsPage(null, { skip: 2, take: 2 })

    expect(ids(page1.submissions)).toEqual([third.id, second.id])
    expect(page1.total).toBe(3)
    expect(ids(page2.submissions)).toEqual([first.id])
    expect(page2.total).toBe(3)
    expect(page1.submissions[0]).toEqual({
      id: third.id,
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      status: 'PENDING_REVIEW',
      notePurpose: 'work',
      firstDayOff: FIRST_DAY,
      lastDayOff: LAST_DAY,
      createdAt: at(3),
    })
  })

  it('matches any name or full name without case, with the total under the same filter', async () => {
    const john = await seed({
      patientFirstName: 'Johnathan',
      patientLastName: 'Smith',
      createdAt: at(1),
    })
    const johnson = await seed({
      patientFirstName: 'Mary',
      patientLastName: 'Johnson',
      createdAt: at(2),
    })
    const doe = await seed({ patientFirstName: 'Mary', patientLastName: 'Doe' })
    await seed({ patientFirstName: 'Mary', patientLastName: 'Smith' })
    await seed({ patientFirstName: 'Peter', patientLastName: 'Doe' })

    const anyName = await searchSubmissionsPage({ by: 'anyName', term: 'JOHN' }, page)
    expect(ids(anyName.submissions)).toEqual([johnson.id, john.id])
    expect(anyName.total).toBe(2)

    const fullName = await searchSubmissionsPage(
      { by: 'fullName', firstName: 'mar', lastName: 'DOE' },
      page
    )
    expect(ids(fullName.submissions)).toEqual([doe.id])
    expect(fullName.total).toBe(1)
  })

  it('matches email, id prefix, phone and medical record number', async () => {
    const byEmail = await seed({ email: 'target@Example.com' })
    const byId = await seed({ id: 'abc12345-0000-4000-8000-000000000000' })
    const byPhone = await seed({ phone: '(555) 999-0000' })
    const byRecord = await seed()
    await seedVerification(byRecord.id, { medicalRecordNumber: 'FAT5YHAB' })
    await seedVerification((await seed()).id, { medicalRecordNumber: 'OTHER123' })

    expect(
      ids((await searchSubmissionsPage({ by: 'email', term: 'TARGET@' }, page)).submissions)
    ).toEqual([byEmail.id])
    expect(
      ids((await searchSubmissionsPage({ by: 'idPrefix', prefix: 'abc12345' }, page)).submissions)
    ).toEqual([byId.id])
    expect(
      ids((await searchSubmissionsPage({ by: 'phone', term: '999-0000' }, page)).submissions)
    ).toEqual([byPhone.id])
    const byMrn = await searchSubmissionsPage(
      { by: 'medicalRecordNumber', medicalRecordNumber: 'FAT5YHAB' },
      page
    )
    expect(ids(byMrn.submissions)).toEqual([byRecord.id])
    expect(byMrn.total).toBe(1)
  })

  it('treats % and _ in the search term as literal characters', async () => {
    const literal = await seed({ email: '100%_sure@example.com' })
    await seed({ email: '100xysure@example.com' })
    await seed({ patientFirstName: 'Ann_Marie' })
    await seed({ patientFirstName: 'AnnaMarie' })

    const percent = await searchSubmissionsPage({ by: 'email', term: '100%_' }, page)
    expect(ids(percent.submissions)).toEqual([literal.id])
    expect(percent.total).toBe(1)

    const underscore = await searchSubmissionsPage({ by: 'anyName', term: 'n_m' }, page)
    expect(underscore.submissions.map((row) => row.patientFirstName)).toEqual(['Ann_Marie'])
  })
})

describe('analytics pages', () => {
  it('pages created-since rows by id ascending from a cursor, whatever the insert or creation order', async () => {
    const c = await seed({ id: '00000000-0000-4000-8000-00000000000c', createdAt: at(2) })
    const a = await seed({ id: '00000000-0000-4000-8000-00000000000a', createdAt: at(3) })
    const b = await seed({ id: '00000000-0000-4000-8000-00000000000b', createdAt: at(1) })
    await seed({ id: '00000000-0000-4000-8000-000000000009', createdAt: at(-5) })

    const page1 = await findFriendsFamilyAnalyticsPage(T0, 2, undefined)
    const page2 = await findFriendsFamilyAnalyticsPage(T0, 2, b.id)
    expect(ids(page1)).toEqual([a.id, b.id])
    expect(ids(page2)).toEqual([c.id])
    expect(Object.keys(page1[0])).toHaveLength(22)

    const business = await findBusinessAnalyticsPage(T0, 10, a.id)
    expect(ids(business)).toEqual([b.id, c.id])
    expect(ids(await findBusinessAnalyticsPage(T0, 1, a.id))).toEqual([b.id])
    expect(business[0]).toEqual({
      id: b.id,
      status: 'PENDING_REVIEW',
      state: 'CA',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientDateOfBirth: DOB,
      email: 'john@example.com',
      phone: '(555) 123-4567',
      offerCode: null,
      attributionChannel: null,
      paymentAmount: null,
      stripeRefundId: null,
      refundedAt: null,
      createdAt: at(1),
    })
  })

  it('matches customers by email, phone digits or patient identity, newest first', async () => {
    const byEmailOld = await seed({ email: 'buyer@example.com', createdAt: at(1) })
    const byEmailNew = await seed({ email: 'Buyer@example.com', createdAt: at(2) })
    const formatted = await seed({ phone: '(555) 123-4567', patientLastName: 'A' })
    const dotted = await seed({ phone: '555.123.4567', patientLastName: 'B' })
    const spaced = await seed({ phone: '+1 555 123 4567', patientLastName: 'C' })
    const other = await seed({ phone: '(555) 123-9999', patientLastName: 'D' })
    await seed({ phone: '(999) 123-4567', patientLastName: 'E' })
    await seed({ phone: '(555) 999-4567', patientLastName: 'F' })
    const patient = await seed({ patientFirstName: 'JOHN', patientLastName: 'DOE', phone: '000' })

    expect(
      ids(await findFriendsFamilyCustomerSubmissions({ by: 'email', email: 'BUYER@example.com' }))
    ).toEqual([byEmailNew.id, byEmailOld.id])
    expect(
      ids(await findFriendsFamilyCustomerSubmissions({ by: 'phone', digits: '5551234567' })).sort()
    ).toEqual([byEmailNew.id, byEmailOld.id, formatted.id, dotted.id, spaced.id].sort())
    expect(
      ids(await findFriendsFamilyCustomerSubmissions({ by: 'phone', digits: '9999' }))
    ).toEqual([other.id])
    expect(
      ids(
        await findFriendsFamilyCustomerSubmissions({
          by: 'patient',
          firstName: 'john',
          lastName: 'doe',
          dateOfBirth: DOB,
        })
      ).sort()
    ).toEqual([byEmailNew.id, byEmailOld.id, patient.id].sort())
  })
})

describe('approved overlap window', () => {
  it('returns approved notes for the same patient whose days touch the window, inclusive', async () => {
    const inside = await seed({ status: SubmissionStatus.APPROVED })
    const touchesStart = await seed({
      status: SubmissionStatus.APPROVED,
      firstDayOff: new Date('2026-02-25T00:00:00.000Z'),
      lastDayOff: new Date('2026-03-01T00:00:00.000Z'),
    })
    await seed({
      status: SubmissionStatus.APPROVED,
      firstDayOff: new Date('2026-02-20T00:00:00.000Z'),
      lastDayOff: new Date('2026-02-28T00:00:00.000Z'),
    })
    const touchesEnd = await seed({
      status: SubmissionStatus.APPROVED,
      firstDayOff: new Date('2026-03-31T00:00:00.000Z'),
      lastDayOff: new Date('2026-04-02T00:00:00.000Z'),
    })
    await seed({
      status: SubmissionStatus.APPROVED,
      firstDayOff: new Date('2026-04-01T00:00:00.000Z'),
      lastDayOff: new Date('2026-04-03T00:00:00.000Z'),
    })
    await seed({ status: SubmissionStatus.PENDING_REVIEW })
    await seed({ status: SubmissionStatus.APPROVED, patientLastName: 'Roe' })

    const overlapping = await findApprovedSubmissionsOverlapping(
      { patientFirstName: 'JOHN', patientLastName: 'doe', patientDateOfBirth: DOB },
      {
        windowStart: new Date('2026-03-01T00:00:00.000Z'),
        windowEnd: new Date('2026-03-31T00:00:00.000Z'),
      }
    )

    expect(ids(overlapping)).toEqual([touchesStart.id, inside.id, touchesEnd.id])
    expect(overlapping[1]).toEqual({
      id: inside.id,
      firstDayOff: FIRST_DAY,
      lastDayOff: LAST_DAY,
      reviewedAt: null,
    })
  })
})

describe('follow-up emails due', () => {
  const now = new Date('2026-08-23T12:00:00.000Z')
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000)
  const delivered = { status: SubmissionStatus.APPROVED, approvalEmailSentAt: now }

  it('selects delivered approved notes bought 5 to 7 days ago that are unsent and unclaimed or stale, oldest first', async () => {
    const due = await seed({ ...delivered, createdAt: daysAgo(6) })
    const staleClaim = await seed({
      ...delivered,
      createdAt: daysAgo(5),
      followUpEmailClaimedAt: minutesAgo(31),
    })
    const edgeClaim = await seed({
      ...delivered,
      createdAt: daysAgo(5.5),
      followUpEmailClaimedAt: minutesAgo(30),
    })
    await seed({ ...delivered, createdAt: daysAgo(6), followUpEmailClaimedAt: minutesAgo(29) })
    await seed({ ...delivered, createdAt: daysAgo(6), followUpEmailSentAt: now })
    await seed({ ...delivered, createdAt: daysAgo(4) })
    await seed({ ...delivered, createdAt: daysAgo(8) })
    await seed({ status: SubmissionStatus.APPROVED, createdAt: daysAgo(6) })
    await seed({ status: SubmissionStatus.DENIED, approvalEmailSentAt: now, createdAt: daysAgo(6) })

    const rows = await findDueFollowUpEmails(now)

    expect(ids(rows)).toEqual([due.id, edgeClaim.id, staleClaim.id])
    expect(rows[0]).toEqual({
      id: due.id,
      email: 'john@example.com',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      notePurpose: 'work',
    })
  })

  it('selects at most 100 due rows, the oldest first, whatever the insert order or plan', async () => {
    const dueRows: Submission[] = []
    for (let minute = 100; minute >= 0; minute--) {
      dueRows.unshift(
        await seed({ ...delivered, createdAt: new Date(daysAgo(6).getTime() + minute * 60 * 1000) })
      )
    }
    await db.affected(sql`ANALYZE submissions`)

    expect(ids(await findDueFollowUpEmails(now))).toEqual(ids(dueRows.slice(0, 100)))
  })

  it('claims only the requested due follow-up once, stamping the claim time, and refuses a fresh claim', async () => {
    const due = await seed({ ...delivered, createdAt: daysAgo(6) })
    const alsoDue = await seed({ ...delivered, createdAt: daysAgo(6) })
    const tooNew = await seed({ ...delivered, createdAt: daysAgo(4) })

    expect(await claimDueFollowUpEmail(due.id, now)).toBe(1)
    expect(await claimDueFollowUpEmail(due.id, now)).toBe(0)
    expect(await claimDueFollowUpEmail(tooNew.id, now)).toBe(0)
    expect(ids(await findDueFollowUpEmails(now))).toEqual([alsoDue.id])
    const claimed = await findSubmissionById(due.id)
    expect(claimed?.followUpEmailClaimedAt).toEqual(now)
    expect(claimed?.updatedAt.getTime()).toBeGreaterThan(due.updatedAt.getTime())
    expect(await findSubmissionById(alsoDue.id)).toEqual(alsoDue)
  })
})

describe('reporting queries', () => {
  it('finds the newest submission whatever the insert order, or null', async () => {
    expect(await findLatestSubmission()).toBeNull()
    await seed({ createdAt: at(1) })
    const newest = await seed({ createdAt: at(3) })
    await seed({ createdAt: at(2) })

    expect(await findLatestSubmission()).toEqual(newest)
  })

  it('lists approved rows for an exact email, most recently reviewed first', async () => {
    const admin = await seedAdmin()
    const approved = { status: SubmissionStatus.APPROVED, reviewedByAdminId: admin }
    const middle = await seed({ ...approved, createdAt: at(3), reviewedAt: at(2) })
    const oldest = await seed({ ...approved, createdAt: at(1), reviewedAt: at(1) })
    const newest = await seed({ ...approved, createdAt: at(2), reviewedAt: at(3) })
    await seed({ ...approved, email: 'JOHN@example.com', reviewedAt: at(4) })
    await seed({ ...approved, email: 'other@example.com', reviewedAt: at(4) })
    await seed({ status: SubmissionStatus.DENIED, reviewedByAdminId: admin, reviewedAt: at(4) })

    expect(ids(await findApprovedSubmissionsForEmail('john@example.com'))).toEqual([
      newest.id,
      middle.id,
      oldest.id,
    ])
  })

  it('lists approved rows missing the approval email, most recently reviewed first', async () => {
    const admin = await seedAdmin()
    const approved = { status: SubmissionStatus.APPROVED, reviewedByAdminId: admin }
    const older = await seed({ ...approved, reviewedAt: at(1) })
    const newer = await seed({ ...approved, reviewedAt: at(2) })
    await seed({ ...approved, reviewedAt: at(3), approvalEmailSentAt: at(3) })
    await seed({ status: SubmissionStatus.DENIED, reviewedByAdminId: admin, reviewedAt: at(4) })

    expect(ids(await findApprovedSubmissionsMissingApprovalEmail())).toEqual([newer.id, older.id])
  })

  it('counts, lists the five newest and groups counts by status under _count', async () => {
    for (let hour = 0; hour < 6; hour++) {
      await seed({
        createdAt: at(hour),
        status: hour < 4 ? SubmissionStatus.PENDING_REVIEW : SubmissionStatus.DENIED,
      })
    }

    expect(await countSubmissions()).toBe(6)
    const recent = await findRecentSubmissions()
    expect(recent.map((row) => row.createdAt)).toEqual([at(5), at(4), at(3), at(2), at(1)])
    expect(Object.keys(recent[0]).sort()).toEqual(
      ['id', 'email', 'status', 'createdAt', 'patientFirstName', 'patientLastName'].sort()
    )
    const byStatus = await countSubmissionsByStatus()
    expect(byStatus.sort((a, b) => a.status.localeCompare(b.status))).toEqual([
      { status: 'DENIED', _count: 2 },
      { status: 'PENDING_REVIEW', _count: 4 },
    ])
  })
})

describe('sms support lookups', () => {
  const phone = '+15551234567'

  it('finds the newest submission id and counts opted-in rows for a phone', async () => {
    await seed({ smsPhoneE164: phone, smsOptIn: true, createdAt: at(1) })
    const newest = await seed({ smsPhoneE164: phone, smsOptIn: false, createdAt: at(2) })
    await seed({ smsPhoneE164: '+15550000000', smsOptIn: true })

    expect(await findLatestSubmissionIdForInboundSmsPhone(phone)).toEqual({ id: newest.id })
    expect(await findLatestSubmissionIdForInboundSmsPhone('+10000000000')).toBeNull()
    expect(await countSmsOptedInSubmissionsForPhone(phone)).toBe(1)
    expect(await countSmsOptedInSubmissionsForPhone('+10000000000')).toBe(0)
  })

  it('returns the two newest submissions for a bounced email with contact fields only', async () => {
    await seed({ createdAt: at(1) })
    const middle = await seed({ createdAt: at(2) })
    const newest = await seed({ createdAt: at(3) })
    await seed({ email: 'other@example.com', createdAt: at(4) })

    const rows = await findLatestSubmissionsForBouncedEmail('john@example.com')

    expect(ids(rows)).toEqual([newest.id, middle.id])
    expect(rows[0]).toEqual({
      id: newest.id,
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      phone: '(555) 123-4567',
      smsOptIn: false,
      smsPhoneE164: null,
      status: 'PENDING_REVIEW',
    })
  })

  it('lists opted-in candidates newest first with at most one sent outbound SMS each', async () => {
    const unsentOnly = await seed({ smsPhoneE164: phone, smsOptIn: true, createdAt: at(1) })
    const withSent = await seed({ smsPhoneE164: phone, smsOptIn: true, createdAt: at(2) })
    await seed({ smsPhoneE164: phone, smsOptIn: false })
    await seedSms(withSent.id)
    await seedSms(withSent.id)
    await seedSms(unsentOnly.id, { sentAt: null })
    await seedSms(unsentOnly.id, { direction: 'inbound' })
    await seedSms(unsentOnly.id, { to: '+19999999999' })

    const candidates = await findSmsSupportSubmissionCandidatesForPhone(phone)

    expect(
      candidates.map((candidate) => [candidate.id, candidate.status, candidate.smsMessages.length])
    ).toEqual([
      [withSent.id, 'PENDING_REVIEW', 1],
      [unsentOnly.id, 'PENDING_REVIEW', 0],
    ])
    expect(candidates[0].smsMessages[0]).toEqual({ id: expect.any(String) })
    expect(await findSmsSupportSubmissionCandidatesForPhone('+10000000000')).toEqual([])
  })

  it('resolves approved submissions for support by id, phone, reference and birth date', async () => {
    const approvedOld = await seed({
      status: SubmissionStatus.APPROVED,
      smsPhoneE164: phone,
      createdAt: at(2),
    })
    await seed({ status: SubmissionStatus.APPROVED, smsPhoneE164: phone, createdAt: at(1) })
    const approvedNew = await seed({
      status: SubmissionStatus.APPROVED,
      smsPhoneE164: phone,
      id: 'abc12345-0000-4000-8000-000000000001',
      createdAt: at(3),
    })
    const pending = await seed({
      smsPhoneE164: phone,
      id: 'abc12345-0000-4000-8000-000000000002',
      createdAt: at(4),
    })
    await seed({
      status: SubmissionStatus.APPROVED,
      smsPhoneE164: '+15550000000',
      id: 'abc12345-0000-4000-8000-000000000003',
      createdAt: at(5),
    })
    await seedVerification(approvedOld.id, { medicalRecordNumber: 'ABC12345' })
    await seedVerification(approvedNew.id, { medicalRecordNumber: 'OTHER999' })

    expect(await findApprovedSubmissionIdForSupportTicket(approvedNew.id)).toEqual({
      id: approvedNew.id,
    })
    expect(await findApprovedSubmissionIdForSupportTicket(pending.id)).toBeNull()
    expect(ids(await findLatestApprovedSubmissionIdsForSupportPhone(phone))).toEqual([
      approvedNew.id,
      approvedOld.id,
    ])
    expect(
      ids(await findApprovedSupportSubmissionIdsByReference(phone, { idPrefix: 'abc12345' }))
    ).toEqual([approvedNew.id])
    expect(
      ids(
        await findApprovedSupportSubmissionIdsByReference(phone, {
          medicalRecordNumber: 'ABC12345',
        })
      )
    ).toEqual([approvedOld.id])
    expect(
      ids(
        await findApprovedSupportSubmissionIdsByReference(phone, {
          idPrefix: 'abc12345',
          medicalRecordNumber: 'ABC12345',
        })
      ).sort()
    ).toEqual([approvedNew.id, approvedOld.id].sort())
    expect(await findApprovedSupportSubmissionIdsByReference(phone, {})).toEqual([])
    expect(await findApprovedSubmissionBirthDateForSupport(approvedNew.id)).toEqual({
      id: approvedNew.id,
      patientDateOfBirth: DOB,
    })
    expect(await findApprovedSubmissionBirthDateForSupport(pending.id)).toBeNull()
  })

  it('returns at most two reference matches', async () => {
    const matches: string[] = []
    for (const suffix of ['1', '2', '3']) {
      const id = `abc12345-0000-4000-8000-00000000000${suffix}`
      await seed({ status: SubmissionStatus.APPROVED, smsPhoneE164: phone, id })
      matches.push(id)
    }

    const rows = await findApprovedSupportSubmissionIdsByReference(phone, { idPrefix: 'abc12345' })

    expect(rows).toHaveLength(2)
    expect(matches).toEqual(expect.arrayContaining(ids(rows)))
  })
})

const REVIEWED_AT = new Date('2026-06-01T12:00:00.000Z')

async function reload(id: string): Promise<Submission> {
  const row = await findSubmissionById(id)
  if (!row) throw new Error(`submission ${id} missing`)
  return row
}

describe('maybe writes', () => {
  const review = {
    maybeReason: 'DATES_EXCEED_ALLOWED_RANGE',
    maybeInternalNote: 'Review date range',
    maybeApprovedDays: 3,
    reviewedByAdminId: 'admin_1',
    reviewedAt: REVIEWED_AT,
  }

  it('moves a pending submission to maybe with the review stamps, and refuses other states', async () => {
    await seedAdmin()
    const pending = await seed({ maybeEmailSentAt: at(0) })
    const otherPending = await seed()
    const approved = await seed({ status: SubmissionStatus.APPROVED })

    expect(await markPendingSubmissionMaybe(pending.id, review)).toBe(1)
    expect(await markPendingSubmissionMaybe(approved.id, review)).toBe(0)
    expect(await reload(otherPending.id)).toEqual(otherPending)

    expect(await reload(pending.id)).toEqual({
      ...pending,
      status: 'MAYBE',
      maybeReason: 'DATES_EXCEED_ALLOWED_RANGE',
      maybeInternalNote: 'Review date range',
      maybeApprovedDays: 3,
      maybeEmailSentAt: null,
      reviewedByAdminId: 'admin_1',
      reviewedAt: REVIEWED_AT,
      updatedAt: REVIEWED_AT,
    })
    expect(await reload(approved.id)).toEqual(approved)
  })

  it('moves any submission to maybe without a guard and stamps the maybe email', async () => {
    await seedAdmin()
    const approved = await seed({ status: SubmissionStatus.APPROVED })

    await markSubmissionMaybe(approved.id, {
      ...review,
      maybeReason: 'OTHER_REVIEW',
      maybeApprovedDays: null,
    })
    await recordMaybeEmailSent(approved.id, at(1))

    const row = await reload(approved.id)
    expect(row).toMatchObject({
      status: 'MAYBE',
      maybeReason: 'OTHER_REVIEW',
      maybeApprovedDays: null,
      maybeEmailSentAt: at(1),
      reviewedAt: REVIEWED_AT,
    })
    expect(row.updatedAt.getTime()).toBeGreaterThan(REVIEWED_AT.getTime())
    await expect(markSubmissionMaybe('missing', review)).rejects.toThrow('not found')
  })
})

describe('approval writes', () => {
  const approval = {
    reviewedByAdminId: 'admin_1',
    reviewedAt: REVIEWED_AT,
    approvalDiagnosis: 'flu',
    approvalWithRestrictions: true,
  }

  it('approves pending or maybe submissions, clearing a stale denial reason, and refuses the rest', async () => {
    await seedAdmin()
    const pending = await seed({ denialReason: 'stale' })
    const maybe = await seed({ status: SubmissionStatus.MAYBE })
    const denied = await seed({ status: SubmissionStatus.DENIED })
    const approved = await seed({ status: SubmissionStatus.APPROVED })

    expect(await approveReviewableSubmission(pending.id, approval)).toBe(1)
    expect(await approveReviewableSubmission(maybe.id, approval)).toBe(1)
    expect(await approveReviewableSubmission(denied.id, approval)).toBe(0)
    expect(await approveReviewableSubmission(approved.id, approval)).toBe(0)

    const row = await reload(pending.id)
    expect(row).toMatchObject({
      status: 'APPROVED',
      reviewedByAdminId: 'admin_1',
      reviewedAt: REVIEWED_AT,
      denialReason: null,
      approvalDiagnosis: 'flu',
      approvalWithRestrictions: true,
    })
    expect(row.updatedAt.getTime()).toBeGreaterThan(pending.updatedAt.getTime())
    expect(await reload(denied.id)).toEqual(denied)
  })

  it('re-approves only the version that was read and stamps updated_at with the review time', async () => {
    await seedAdmin()
    const approved = await seed({ status: SubmissionStatus.APPROVED, updatedAt: at(0) })
    const pending = await seed({ updatedAt: at(0) })

    expect(await reapproveSubmission(approved.id, at(1), approval)).toBe(0)
    expect(await reapproveSubmission(pending.id, at(0), approval)).toBe(0)
    expect(await reapproveSubmission(approved.id, at(0), approval)).toBe(1)

    expect(await reload(approved.id)).toMatchObject({
      status: 'APPROVED',
      approvalDiagnosis: 'flu',
      approvalWithRestrictions: true,
      reviewedAt: REVIEWED_AT,
      updatedAt: REVIEWED_AT,
    })
    expect(await reload(pending.id)).toEqual(pending)
  })

  it('approves a manual submission clearing approval fields, and records the approval email', async () => {
    await seedAdmin()
    const manual = await seed({
      status: SubmissionStatus.MANUAL,
      denialReason: 'x',
      approvalEmailSentAt: at(0),
      approvalDiagnosis: 'd',
      approvalWithRestrictions: true,
    })

    await approveManualSubmission(manual.id, {
      reviewedByAdminId: 'admin_1',
      reviewedAt: REVIEWED_AT,
    })
    await recordApprovalEmailSent(manual.id, at(2))

    expect(await reload(manual.id)).toMatchObject({
      status: 'APPROVED',
      reviewedByAdminId: 'admin_1',
      reviewedAt: REVIEWED_AT,
      denialReason: null,
      approvalEmailSentAt: at(2),
      approvalDiagnosis: null,
      approvalWithRestrictions: null,
    })
  })
})

describe('denial and refund writes', () => {
  const denial = { denialReason: 'Legal', reviewedByAdminId: 'admin_1', reviewedAt: REVIEWED_AT }

  it('reserves the refund only while reviewable and unrefunded, then releases it', async () => {
    await seedAdmin()
    const pending = await seed()
    const maybe = await seed({ status: SubmissionStatus.MAYBE })
    const refunded = await seed({ stripeRefundId: 're_done' })
    const denied = await seed({ status: SubmissionStatus.DENIED })

    expect(await markSubmissionRefundReserved(pending.id, denial)).toBe(1)
    expect(await markSubmissionRefundReserved(maybe.id, denial)).toBe(1)
    expect(await markSubmissionRefundReserved(refunded.id, denial)).toBe(0)
    expect(await markSubmissionRefundReserved(denied.id, denial)).toBe(0)
    expect(await markSubmissionRefundReserved(pending.id, denial)).toBe(0)

    expect(await reload(pending.id)).toMatchObject({
      status: 'DENIED',
      denialReason: 'Legal',
      reviewedByAdminId: 'admin_1',
      reviewedAt: REVIEWED_AT,
      stripeRefundId: `pending_${pending.id}`,
      refundedAt: REVIEWED_AT,
    })

    await releaseSubmissionRefundReservation(pending.id)
    expect(await reload(pending.id)).toMatchObject({
      status: 'PENDING_REVIEW',
      stripeRefundId: null,
      reviewedByAdminId: null,
      reviewedAt: null,
      refundedAt: null,
      denialReason: null,
    })

    await recordSubmissionRefund(maybe.id, 're_real')
    expect((await reload(maybe.id)).stripeRefundId).toBe('re_real')
  })

  it('denies with and without a refund, records the denial email, and denies a manual submission', async () => {
    await seedAdmin()
    const plain = await seed()
    const withRefund = await seed()
    const manual = await seed({ status: SubmissionStatus.MANUAL, denialEmailSentAt: at(0) })

    await markSubmissionDenied(plain.id, { ...denial, updatedAt: at(1) })
    await recordDenialEmailSent(plain.id, at(2))
    await markSubmissionDeniedAndRefunded(withRefund.id, {
      ...denial,
      updatedAt: at(1),
      stripeRefundId: 're_1',
      refundedAt: at(1),
    })
    await denyManualSubmission(manual.id, denial)

    expect(await reload(plain.id)).toMatchObject({
      status: 'DENIED',
      denialReason: 'Legal',
      reviewedByAdminId: 'admin_1',
      reviewedAt: REVIEWED_AT,
      denialEmailSentAt: at(2),
    })
    expect(await reload(withRefund.id)).toMatchObject({
      status: 'DENIED',
      stripeRefundId: 're_1',
      refundedAt: at(1),
      updatedAt: at(1),
    })
    expect(await reload(manual.id)).toMatchObject({
      status: 'DENIED',
      denialReason: 'Legal',
      denialEmailSentAt: null,
    })
  })
})

describe('status writers', () => {
  it('write only their own columns when the argument carries extra fields', async () => {
    await seedAdmin()
    const review = {
      reviewedByAdminId: 'admin_1',
      reviewedAt: REVIEWED_AT,
      maybeInternalNote: 'leak',
    }
    const denial = { ...review, denialReason: 'Legal' }
    const details = { patientFirstName: 'Ann', maybeInternalNote: 'leak' }
    const classification = {
      notePurpose: 'school',
      otherNotePurpose: null,
      absenceReason: 'flu',
      otherAbsenceReason: null,
      maybeInternalNote: 'leak',
    }
    const writers = [
      (id: string) => markMaybeSubmissionManual(id, review),
      (id: string) => markSubmissionManual(id, { ...review, updatedAt: at(1) }),
      (id: string) => approveManualSubmission(id, review),
      (id: string) => markSubmissionDenied(id, { ...denial, updatedAt: at(1) }),
      (id: string) =>
        markSubmissionDeniedAndRefunded(id, {
          ...denial,
          updatedAt: at(1),
          stripeRefundId: 're_1',
          refundedAt: at(1),
        }),
      (id: string) => denyManualSubmission(id, denial),
      (id: string) => markSubmissionRefundReserved(id, denial),
      (id: string) => updateSubmissionDetails(id, details, at(1)),
      (id: string) => updatePendingSubmissionClassification(id, classification, at(1)),
    ]

    for (const write of writers) {
      const row = await seed({ maybeInternalNote: 'keep' })
      await write(row.id)
      expect((await reload(row.id)).maybeInternalNote).toBe('keep')
    }
  })
})

describe('status and detail edits', () => {
  it('moves to manual, back to review, and drops the guardian with the given timestamp', async () => {
    await seedAdmin()
    const review = { reviewedByAdminId: 'admin_1', reviewedAt: REVIEWED_AT }
    const maybe = await seed({ status: SubmissionStatus.MAYBE })
    const pending = await seed()
    const guarded = await seed({
      recipient: 'someone_else',
      guardianFirstName: 'Jane',
      guardianLastName: 'Doe',
      guardianDateOfBirth: new Date('1960-01-01T00:00:00.000Z'),
    })

    await markMaybeSubmissionManual(maybe.id, review)
    await markSubmissionManual(pending.id, { ...review, updatedAt: at(1) })
    await removeSubmissionGuardian(guarded.id, at(2))

    const fromMaybe = await reload(maybe.id)
    expect(fromMaybe).toMatchObject({ status: 'MANUAL', ...review })
    expect(fromMaybe.updatedAt.getTime()).toBeGreaterThan(maybe.updatedAt.getTime())
    expect(await reload(pending.id)).toMatchObject({
      status: 'MANUAL',
      ...review,
      updatedAt: at(1),
    })
    expect(await reload(guarded.id)).toMatchObject({
      recipient: 'myself',
      guardianFirstName: null,
      guardianLastName: null,
      guardianDateOfBirth: null,
      updatedAt: at(2),
    })

    await returnSubmissionToReview(pending.id, at(3))
    expect(await reload(pending.id)).toMatchObject({
      status: 'PENDING_REVIEW',
      reviewedByAdminId: null,
      reviewedAt: null,
      updatedAt: at(3),
    })
  })

  it('writes edited details including dates and JSON symptoms, and classifies only pending rows', async () => {
    const pending = await seed()
    const approved = await seed({ status: SubmissionStatus.APPROVED })

    await updateSubmissionDetails(
      pending.id,
      {
        phone: '(555) 987-6543',
        smsOptIn: false,
        smsOptInAt: null,
        smsConsentVersion: null,
        smsPhoneE164: null,
        firstDayOff: new Date('2026-04-01T00:00:00.000Z'),
        symptoms: ['Cough'],
      },
      at(1)
    )
    const classification = {
      notePurpose: 'school',
      otherNotePurpose: null,
      absenceReason: 'Illness',
      otherAbsenceReason: null,
    }
    expect(await updatePendingSubmissionClassification(pending.id, classification, at(2))).toBe(1)
    expect(await updatePendingSubmissionClassification(approved.id, classification, at(2))).toBe(0)

    expect(await reload(pending.id)).toEqual({
      ...pending,
      phone: '(555) 987-6543',
      firstDayOff: new Date('2026-04-01T00:00:00.000Z'),
      symptoms: ['Cough'],
      ...classification,
      updatedAt: at(2),
    })
    expect(await reload(approved.id)).toEqual(approved)
  })
})

describe('insertSubmission', () => {
  const row = {
    stripePaymentIntentId: 'pi_123',
    paymentAmount: 2495,
    status: SubmissionStatus.MAYBE,
    denialReason: null,
    attribution: { last: { channel: 'reddit' } },
    symptoms: ['Fever', 'Cough'],
    state: 'CA',
    recipient: 'myself',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: DOB,
    email: 'john@example.com',
    phone: '5551234567',
    smsOptIn: true,
    smsOptInAt: at(0),
    notePurpose: 'work',
    firstDayOff: FIRST_DAY,
    lastDayOff: LAST_DAY,
    absenceReason: 'illness',
  }

  it('round-trips dates as UTC midnight and JSON columns, filling id and timestamps', async () => {
    const before = Date.now()
    const result = await insertSubmission(row)

    expect(result.inserted).toBe(true)
    const inserted = result.submission
    expect(inserted).toMatchObject({ ...row, maybeReason: null, stripeRefundId: null })
    expect(inserted.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Math.abs(inserted.createdAt.getTime() - before)).toBeLessThan(5000)
    expect(inserted.updatedAt).toEqual(inserted.createdAt)
    expect(await findSubmissionById(inserted.id)).toEqual(inserted)
  })

  it('reports a second insert for the same payment intent as a duplicate and returns that row', async () => {
    await insertSubmission({ ...row, stripePaymentIntentId: 'pi_other', patientFirstName: 'Other' })
    await insertSubmission(row)

    await expect(insertSubmission({ ...row, patientFirstName: 'Retry' })).resolves.toMatchObject({
      inserted: false,
      submission: { patientFirstName: 'John', stripePaymentIntentId: 'pi_123' },
    })
    expect(await countSubmissions()).toBe(2)
  })

  it('applies the column defaults when optional fields are omitted', async () => {
    const {
      status: _status,
      symptoms: _symptoms,
      attribution: _attribution,
      smsOptIn: _smsOptIn,
      ...required
    } = row

    const { submission: inserted } = await insertSubmission(required)

    expect(inserted).toMatchObject({
      status: 'PENDING_REVIEW',
      smsOptIn: false,
      symptoms: null,
      attribution: null,
      guardianFirstName: null,
    })
  })
})

describe('follow-up claim release and acknowledgement', () => {
  it('releases or acknowledges only the claim this run holds', async () => {
    const claimedAt = at(0)
    const held = await seed({ followUpEmailClaimedAt: claimedAt })
    const otherClaim = await seed({ followUpEmailClaimedAt: at(1) })
    const sent = await seed({ followUpEmailClaimedAt: claimedAt, followUpEmailSentAt: at(1) })

    await releaseFollowUpEmailClaimAt(otherClaim.id, claimedAt)
    await releaseFollowUpEmailClaimAt(sent.id, claimedAt)
    expect((await reload(otherClaim.id)).followUpEmailClaimedAt).toEqual(at(1))
    expect((await reload(sent.id)).followUpEmailClaimedAt).toEqual(claimedAt)

    expect(await acknowledgeFollowUpEmailSent(otherClaim.id, claimedAt)).toBe(0)
    expect(await acknowledgeFollowUpEmailSent(sent.id, claimedAt)).toBe(0)
    expect((await reload(sent.id)).followUpEmailSentAt).toEqual(at(1))
    expect(await acknowledgeFollowUpEmailSent(held.id, claimedAt)).toBe(1)
    expect(await acknowledgeFollowUpEmailSent(held.id, claimedAt)).toBe(0)
    expect(await reload(held.id)).toMatchObject({
      followUpEmailClaimedAt: null,
      followUpEmailSentAt: claimedAt,
    })

    const released = await seed({ followUpEmailClaimedAt: claimedAt })
    await releaseFollowUpEmailClaimAt(released.id, claimedAt)
    expect((await reload(released.id)).followUpEmailClaimedAt).toBeNull()
  })
})

describe('deletes', () => {
  it('deletes one row, throws for a missing one, and reports how many a full delete removed', async () => {
    const first = await seed()
    await seed()
    await seed()

    await deleteSubmissionById(first.id)
    expect(await findSubmissionById(first.id)).toBeNull()
    await expect(deleteSubmissionById(first.id)).rejects.toThrow('not found')
    expect(await deleteAllSubmissions()).toBe(2)
    expect(await countSubmissions()).toBe(0)
  })
})

describe('commitSupportAutomationSubmissionUpdate', () => {
  const committedAt = new Date('2026-06-29T12:00:00.000Z')
  const submissionUpdatedAt = new Date('2026-06-20T00:00:00.000Z')
  const updateData = {
    denialReason: null,
    reviewedAt: committedAt,
    updatedAt: committedAt,
    notePurpose: 'school',
    otherNotePurpose: null,
  }

  async function seedTicket(status: string, automationStatus: string): Promise<string> {
    const id = randomUUID()
    await db.affected(
      sql`${insert(smsSupportTickets, {
        id,
        phoneE164: '+15551234567',
        status,
        state: 'CSR_REVIEW',
        source: 'INBOUND_SMS',
        automationStatus,
        failureReason: 'earlier failure',
        retryCount: 0,
      })}`
    )
    return id
  }

  async function seedJob(ticketId: string, status: string): Promise<string> {
    const id = randomUUID()
    await db.affected(
      sql`${insert(smsSupportJobs, { id, ticketId, kind: 'RUN_SUPPORT_AUTOMATION', status, attempts: 1, runAfter: committedAt })}`
    )
    return id
  }

  async function ticketAndJob(ticketId: string, jobId: string) {
    const [ticket] = await db.rows(
      sql`SELECT ${selectAll(smsSupportTickets)} FROM sms_support_tickets WHERE id = ${ticketId}`
    )
    const [job] = await db.rows(
      sql`SELECT ${selectAll(smsSupportJobs)} FROM sms_support_jobs WHERE id = ${jobId}`
    )
    return { ticket, job }
  }

  function commit(
    ticketId: string,
    jobId: string,
    submissionId: string,
    readAt = submissionUpdatedAt
  ) {
    return commitSupportAutomationSubmissionUpdate({
      ticketId,
      jobId,
      submissionId,
      submissionUpdatedAt: readAt,
      committedAt,
      updateData,
    })
  }

  it('guards the ticket, then the job, then updates the unchanged approved submission', async () => {
    const ticketId = await seedTicket(
      SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      SMS_SUPPORT_AUTOMATION_STATUS.RUNNING
    )
    const jobId = await seedJob(ticketId, SMS_SUPPORT_JOB_STATUS.RUNNING)
    const otherTicketId = await seedTicket(
      SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      SMS_SUPPORT_AUTOMATION_STATUS.RUNNING
    )
    const otherJobId = await seedJob(otherTicketId, SMS_SUPPORT_JOB_STATUS.RUNNING)
    const submission = await seed({
      status: SubmissionStatus.APPROVED,
      updatedAt: submissionUpdatedAt,
      denialReason: 'x',
    })
    const otherSubmission = await seed({
      status: SubmissionStatus.APPROVED,
      updatedAt: submissionUpdatedAt,
      denialReason: 'x',
    })

    expect(await commit(ticketId, jobId, submission.id)).toBe('updated')

    const { ticket, job } = await ticketAndJob(ticketId, jobId)
    expect(ticket.failureReason).toBeNull()
    expect(job).toMatchObject({ status: SMS_SUPPORT_JOB_STATUS.COMMITTING, lockedAt: committedAt })
    expect((await ticketAndJob(ticketId, otherJobId)).job.status).toBe(
      SMS_SUPPORT_JOB_STATUS.RUNNING
    )
    expect(await reload(otherSubmission.id)).toEqual(otherSubmission)
    expect(await reload(submission.id)).toEqual({
      ...submission,
      denialReason: null,
      reviewedAt: committedAt,
      updatedAt: committedAt,
      notePurpose: 'school',
      otherNotePurpose: null,
    })
  })

  it('returns cancelled without touching the job or submission when the ticket left automation', async () => {
    const ticketId = await seedTicket(
      SMS_SUPPORT_STATUS.NEEDS_CSR,
      SMS_SUPPORT_AUTOMATION_STATUS.RUNNING
    )
    const jobId = await seedJob(ticketId, SMS_SUPPORT_JOB_STATUS.RUNNING)
    const submission = await seed({
      status: SubmissionStatus.APPROVED,
      updatedAt: submissionUpdatedAt,
    })

    expect(await commit(ticketId, jobId, submission.id)).toBe('cancelled')

    const { ticket, job } = await ticketAndJob(ticketId, jobId)
    expect(ticket.failureReason).toBe('earlier failure')
    expect(job.status).toBe(SMS_SUPPORT_JOB_STATUS.RUNNING)
    expect(await reload(submission.id)).toEqual(submission)
  })

  it('returns cancelled when the ticket is in automation but its automation is not running', async () => {
    const ticketId = await seedTicket(
      SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      SMS_SUPPORT_AUTOMATION_STATUS.FAILED
    )
    const jobId = await seedJob(ticketId, SMS_SUPPORT_JOB_STATUS.RUNNING)
    const submission = await seed({
      status: SubmissionStatus.APPROVED,
      updatedAt: submissionUpdatedAt,
    })

    expect(await commit(ticketId, jobId, submission.id)).toBe('cancelled')

    const { ticket, job } = await ticketAndJob(ticketId, jobId)
    expect(ticket.failureReason).toBe('earlier failure')
    expect(job.status).toBe(SMS_SUPPORT_JOB_STATUS.RUNNING)
    expect(await reload(submission.id)).toEqual(submission)
  })

  it('returns cancelled without updating the submission when the job is no longer running', async () => {
    const ticketId = await seedTicket(
      SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      SMS_SUPPORT_AUTOMATION_STATUS.RUNNING
    )
    const jobId = await seedJob(ticketId, SMS_SUPPORT_JOB_STATUS.FAILED)
    const submission = await seed({
      status: SubmissionStatus.APPROVED,
      updatedAt: submissionUpdatedAt,
    })

    expect(await commit(ticketId, jobId, submission.id)).toBe('cancelled')

    const { job } = await ticketAndJob(ticketId, jobId)
    expect(job.status).toBe(SMS_SUPPORT_JOB_STATUS.FAILED)
    expect(await reload(submission.id)).toEqual(submission)
  })

  it('returns submission_changed when the submission is not approved or changed since it was read', async () => {
    const ticketId = await seedTicket(
      SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      SMS_SUPPORT_AUTOMATION_STATUS.RUNNING
    )
    const jobId = await seedJob(ticketId, SMS_SUPPORT_JOB_STATUS.RUNNING)
    const changed = await seed({ status: SubmissionStatus.APPROVED, updatedAt: at(0) })
    const pending = await seed({ updatedAt: submissionUpdatedAt })

    expect(await commit(ticketId, jobId, changed.id)).toBe('submission_changed')
    expect(await reload(changed.id)).toEqual(changed)

    const secondTicket = await seedTicket(
      SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      SMS_SUPPORT_AUTOMATION_STATUS.RUNNING
    )
    const secondJob = await seedJob(secondTicket, SMS_SUPPORT_JOB_STATUS.RUNNING)
    expect(await commit(secondTicket, secondJob, pending.id)).toBe('submission_changed')
    expect(await reload(pending.id)).toEqual(pending)
  })
})
