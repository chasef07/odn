import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { db } from '../pool'
import { sql } from '../sql'
import { insert, selectAll } from '../table'
import { noteVerifications, smsMessages, submissions, users } from '../tables'
import {
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
  it('lists pending submissions oldest first', async () => {
    const later = await seed({ createdAt: at(2) })
    const earlier = await seed({ createdAt: at(1) })
    await seed({ status: SubmissionStatus.APPROVED })

    expect(ids(await findSubmissionsPendingReview())).toEqual([earlier.id, later.id])
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
    const approvedLate = await seed({
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      approvalEmailSentAt: at(2),
    })
    const approvedEarly = await seed({
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      approvalEmailSentAt: at(1),
    })
    await seed({ status: SubmissionStatus.APPROVED, reviewedAt: at(-1), reviewedByAdminId: admin })
    const denied = await seed({
      status: SubmissionStatus.DENIED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
      denialEmailSentAt: at(1),
    })

    const approved = await findSubmissionsApprovedSince(T0, 10)
    expect(ids(approved)).toEqual([approvedLate.id, approvedEarly.id])
    expect(approved[0]).toEqual({
      id: approvedLate.id,
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      approvalEmailSentAt: at(2),
    })
    expect(await findSubmissionsApprovedSince(T0, 1)).toHaveLength(1)
    expect(await findSubmissionsDeniedSince(T0, 10)).toEqual([
      {
        id: denied.id,
        patientFirstName: 'John',
        patientLastName: 'Doe',
        email: 'john@example.com',
        denialEmailSentAt: at(1),
      },
    ])
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
    const manual = await seed({
      status: SubmissionStatus.MANUAL,
      reviewedAt: at(1),
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
    expect(await findManualSubmissions()).toEqual([
      {
        id: manual.id,
        patientFirstName: 'John',
        patientLastName: 'Doe',
        email: 'john@example.com',
        firstDayOff: FIRST_DAY,
        lastDayOff: LAST_DAY,
        reviewedAt: at(1),
      },
    ])
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
    const john = await seed({ patientFirstName: 'Johnathan', patientLastName: 'Smith' })
    const doe = await seed({ patientFirstName: 'Mary', patientLastName: 'Doe' })
    await seed({ patientFirstName: 'Mary', patientLastName: 'Smith' })

    const anyName = await searchSubmissionsPage({ by: 'anyName', term: 'JOHN' }, page)
    expect(ids(anyName.submissions)).toEqual([john.id])
    expect(anyName.total).toBe(1)

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
  it('pages created-since rows by id ascending from a cursor', async () => {
    const a = await seed({ id: '00000000-0000-4000-8000-00000000000a', createdAt: at(1) })
    const b = await seed({ id: '00000000-0000-4000-8000-00000000000b', createdAt: at(2) })
    const c = await seed({ id: '00000000-0000-4000-8000-00000000000c', createdAt: at(3) })
    await seed({ id: '00000000-0000-4000-8000-000000000009', createdAt: at(-5) })

    const page1 = await findFriendsFamilyAnalyticsPage(T0, 2, undefined)
    const page2 = await findFriendsFamilyAnalyticsPage(T0, 2, b.id)
    expect(ids(page1)).toEqual([a.id, b.id])
    expect(ids(page2)).toEqual([c.id])
    expect(Object.keys(page1[0])).toHaveLength(22)

    const business = await findBusinessAnalyticsPage(T0, 10, a.id)
    expect(ids(business)).toEqual([b.id, c.id])
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
      createdAt: at(2),
    })
  })

  it('matches customers by email, phone digits or patient identity, newest first', async () => {
    const byEmailNew = await seed({ email: 'Buyer@example.com', createdAt: at(2) })
    const byEmailOld = await seed({ email: 'buyer@example.com', createdAt: at(1) })
    const formatted = await seed({ phone: '(555) 123-4567', patientLastName: 'A' })
    const dotted = await seed({ phone: '555.123.4567', patientLastName: 'B' })
    const spaced = await seed({ phone: '+1 555 123 4567', patientLastName: 'C' })
    const other = await seed({ phone: '(555) 123-9999', patientLastName: 'D' })
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
    await seed({ status: SubmissionStatus.PENDING_REVIEW })
    await seed({ status: SubmissionStatus.APPROVED, patientLastName: 'Roe' })

    const overlapping = await findApprovedSubmissionsOverlapping(
      { patientFirstName: 'JOHN', patientLastName: 'doe', patientDateOfBirth: DOB },
      {
        windowStart: new Date('2026-03-01T00:00:00.000Z'),
        windowEnd: new Date('2026-03-31T00:00:00.000Z'),
      }
    )

    expect(ids(overlapping)).toEqual([touchesStart.id, inside.id])
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

  it('selects delivered approved notes bought 5 to 7 days ago that are unsent and unclaimed or stale', async () => {
    const due = await seed({ ...delivered, createdAt: daysAgo(6) })
    const staleClaim = await seed({
      ...delivered,
      createdAt: daysAgo(5),
      followUpEmailClaimedAt: minutesAgo(31),
    })
    const edgeClaim = await seed({
      ...delivered,
      createdAt: daysAgo(5),
      followUpEmailClaimedAt: minutesAgo(30),
    })
    await seed({ ...delivered, createdAt: daysAgo(6), followUpEmailClaimedAt: minutesAgo(29) })
    await seed({ ...delivered, createdAt: daysAgo(6), followUpEmailSentAt: now })
    await seed({ ...delivered, createdAt: daysAgo(4) })
    await seed({ ...delivered, createdAt: daysAgo(8) })
    await seed({ status: SubmissionStatus.APPROVED, createdAt: daysAgo(6) })
    await seed({ status: SubmissionStatus.DENIED, approvalEmailSentAt: now, createdAt: daysAgo(6) })

    const rows = await findDueFollowUpEmails(now)

    expect(ids(rows).sort()).toEqual([due.id, staleClaim.id, edgeClaim.id].sort())
    expect(rows[0]).toEqual({
      id: due.id,
      email: 'john@example.com',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      notePurpose: 'work',
    })
  })

  it('claims a due follow-up once, stamping the claim time, and refuses a fresh claim', async () => {
    const due = await seed({ ...delivered, createdAt: daysAgo(6) })
    const tooNew = await seed({ ...delivered, createdAt: daysAgo(4) })

    expect(await claimDueFollowUpEmail(due.id, now)).toBe(1)
    expect(await claimDueFollowUpEmail(due.id, now)).toBe(0)
    expect(await claimDueFollowUpEmail(tooNew.id, now)).toBe(0)
    expect(await findDueFollowUpEmails(now)).toEqual([])
    const claimed = await findSubmissionById(due.id)
    expect(claimed?.followUpEmailClaimedAt).toEqual(now)
    expect(claimed?.updatedAt.getTime()).toBeGreaterThan(due.updatedAt.getTime())
  })
})

describe('reporting queries', () => {
  it('finds the newest submission, approved rows for an exact email and rows missing the approval email', async () => {
    const admin = await seedAdmin()
    const newest = await seed({
      createdAt: at(2),
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(2),
      reviewedByAdminId: admin,
    })
    const older = await seed({
      createdAt: at(1),
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(3),
      reviewedByAdminId: admin,
      approvalEmailSentAt: at(3),
    })
    const upperCased = await seed({
      createdAt: at(0),
      email: 'JOHN@example.com',
      status: SubmissionStatus.APPROVED,
      reviewedAt: at(1),
      reviewedByAdminId: admin,
    })

    expect(await findLatestSubmission()).toEqual(newest)
    expect(ids(await findApprovedSubmissionsForEmail('john@example.com'))).toEqual([
      older.id,
      newest.id,
    ])
    expect(ids(await findApprovedSubmissionsMissingApprovalEmail())).toEqual([
      newest.id,
      upperCased.id,
    ])
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
    const newest = await seed({ createdAt: at(3) })
    const middle = await seed({ createdAt: at(2) })
    await seed({ createdAt: at(1) })
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
    const withSent = await seed({ smsPhoneE164: phone, smsOptIn: true, createdAt: at(2) })
    const unsentOnly = await seed({ smsPhoneE164: phone, smsOptIn: true, createdAt: at(1) })
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
    const approvedNew = await seed({
      status: SubmissionStatus.APPROVED,
      smsPhoneE164: phone,
      id: 'abc12345-0000-4000-8000-000000000001',
      createdAt: at(3),
    })
    const approvedOld = await seed({
      status: SubmissionStatus.APPROVED,
      smsPhoneE164: phone,
      createdAt: at(2),
    })
    await seed({ status: SubmissionStatus.APPROVED, smsPhoneE164: phone, createdAt: at(1) })
    const pending = await seed({ smsPhoneE164: phone, id: 'abc12345-0000-4000-8000-000000000002' })
    await seedVerification(approvedOld.id, { medicalRecordNumber: 'ABC12345' })

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
})
