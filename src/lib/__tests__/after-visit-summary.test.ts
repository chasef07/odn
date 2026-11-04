import { describe, it, expect } from 'vitest'
import { SubmissionStatus, type Submission } from '@/db/types'
import type { PriorChart } from '@/db/submissions'
import { buildAfterVisitSummary, type AfterVisitSummaryInput } from '../after-visit-summary'

const submission: Submission = {
  id: 'sub_123',
  stripePaymentIntentId: 'pi_123',
  paymentAmount: 2495,
  offerCode: null,
  offerPriceId: null,
  attributionChannel: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  attribution: null,
  status: SubmissionStatus.APPROVED,
  state: 'New York',
  recipient: 'myself',
  patientFirstName: 'Isaiah',
  patientLastName: 'Bandoo',
  patientDateOfBirth: new Date('2000-09-14T00:00:00.000Z'),
  guardianFirstName: null,
  guardianLastName: null,
  guardianDateOfBirth: null,
  email: 'patient@example.test',
  phone: '5555550100',
  smsOptIn: false,
  smsOptInAt: null,
  smsConsentVersion: null,
  smsPhoneE164: null,
  notePurpose: 'work',
  otherNotePurpose: null,
  firstDayOff: new Date('2026-09-29T00:00:00.000Z'),
  lastDayOff: new Date('2026-09-30T00:00:00.000Z'),
  absenceReason: 'Feeling sick',
  otherAbsenceReason: null,
  symptoms: ['Sore throat', 'Cough'],
  otherSymptomText: null,
  additionalInformation: 'Saw urgent care yesterday',
  reviewedAt: new Date('2026-09-30T11:50:00.000Z'),
  reviewedByAdminId: 'doctor_1',
  denialReason: null,
  denialNote: null,
  maybeReason: null,
  maybeInternalNote: null,
  maybeApprovedDays: null,
  maybeEmailSentAt: null,
  stripeRefundId: null,
  refundedAt: null,
  approvalEmailSentAt: null,
  denialEmailSentAt: null,
  followUpEmailClaimedAt: null,
  followUpEmailSentAt: null,
  approvalDiagnosis: null,
  approvalWithRestrictions: null,
  createdAt: new Date('2026-09-30T10:00:00.000Z'),
  updatedAt: new Date('2026-09-30T11:50:00.000Z'),
}

const priorChart: PriorChart = {
  id: 'sub_prior',
  status: SubmissionStatus.APPROVED,
  notePurpose: 'work',
  firstDayOff: new Date('2026-09-15T00:00:00.000Z'),
  lastDayOff: new Date('2026-09-17T00:00:00.000Z'),
  createdAt: new Date('2026-09-15T12:00:00.000Z'),
  reviewedAt: new Date('2026-09-15T14:00:00.000Z'),
  otherNotePurpose: null,
  absenceReason: 'Feeling sick',
  otherAbsenceReason: null,
  symptoms: ['Sore throat', 'Headache or migraine'],
  otherSymptomText: null,
}

function input(overrides: Partial<AfterVisitSummaryInput> = {}): AfterVisitSummaryInput {
  return {
    submission,
    history: [],
    rollingLimit: { usedDays: 0, requestedDays: 2, totalDays: 2, exceeded: false },
    physician: { name: 'Jason Buchwald', credentials: 'M.D., FACEP' },
    includeAdditionalInformation: false,
    ...overrides,
  }
}

describe('buildAfterVisitSummary', () => {
  it('fills the header from the chart, signed when it was reviewed', () => {
    const summary = buildAfterVisitSummary(input())

    expect(summary.signedAt).toBe('09/30/2026 | 7:50 AM ET')
    expect(summary.signer).toBe('Jason Buchwald, M.D., FACEP')
    expect(summary.clinician).toBe('Jason Buchwald, M.D., FACEP | New York License #229551')
    expect(summary.patient).toBe('Isaiah Bandoo | DOB: 09/14/2000')
    expect(summary.patientLocation).toBe('New York')
    expect(summary.encounterModality).toBe('Asynchronous')
    expect(summary.identityVerifiedBy).toBe('Patient provided')
  })

  it('uses the license for the patient state', () => {
    const summary = buildAfterVisitSummary(input({ submission: { ...submission, state: 'Texas' } }))

    expect(summary.clinician).toBe('Jason Buchwald, M.D., FACEP | Texas License #V6158')
    expect(summary.patientLocation).toBe('Texas')
  })

  it('refuses a state with no license on file', () => {
    expect(() =>
      buildAfterVisitSummary(input({ submission: { ...submission, state: 'Alaska' } }))
    ).toThrow('No license on file for Alaska')
  })

  it('drops a Dr. prefix from the configured name', () => {
    const summary = buildAfterVisitSummary(
      input({ physician: { name: 'Dr. Jason Buchwald', credentials: 'M.D., FACEP' } })
    )

    expect(summary.signer).toBe('Jason Buchwald, M.D., FACEP')
  })

  it('says patient throughout when the patient filed', () => {
    const summary = buildAfterVisitSummary(input())

    expect(summary.consent).toMatch(/^The patient requested an evaluation/)
    expect(summary.consent).toContain(
      'The patient also consented that no physical examination, or independently measured vital signs would be performed'
    )
    expect(summary.consent).not.toContain('Physician attestation')
    expect(summary.assessment).toMatch(/^Based on the patient-submitted history/)
  })

  it('says parent/guardian throughout for a chart filed for someone else', () => {
    const summary = buildAfterVisitSummary(
      input({ submission: { ...submission, recipient: 'someone_else' } })
    )

    expect(summary.identityVerifiedBy).toBe('Parent/guardian provided')
    expect(summary.consent).toMatch(/^The parent\/guardian requested an evaluation/)
    expect(summary.consent).toContain('The parent/guardian also consented that')
    expect(summary.assessment).toMatch(/^Based on the parent\/guardian-submitted history/)
    expect(summary.patient).toBe('Isaiah Bandoo | DOB: 09/14/2000')
  })

  it.each([
    ['work', null, 'Absence from work', 'Excused from work'],
    ['school', null, 'Absence from school', 'Excused from school'],
    ['both', null, 'Absence from work and school', 'Excused from work and school'],
    ['travel', null, 'Absence from travel', 'Excused from travel'],
    ['other', 'volunteering', 'Other: volunteering', 'Excused from volunteering'],
  ])('names the %s purpose', (notePurpose, otherNotePurpose, reason, status) => {
    const summary = buildAfterVisitSummary(
      input({ submission: { ...submission, notePurpose, otherNotePurpose } })
    )

    expect(summary.reasonForRequest).toBe(reason)
    expect(summary.determination[0]).toBe(`Status: ${status}`)
  })

  it.each([
    [
      '2026-09-29',
      '2026-09-29',
      'Off date: 09/29/2026. Return date: 09/30/2026',
      'Effective date: 09/29/2026',
    ],
    [
      '2026-09-29',
      '2026-09-30',
      'Off dates: 09/29/2026 and 09/30/2026. Return date: 10/01/2026',
      'Effective dates: 09/29/2026 through 09/30/2026',
    ],
    [
      '2026-09-29',
      '2026-10-02',
      'Off dates: 09/29/2026 through 10/02/2026. Return date: 10/03/2026',
      'Effective dates: 09/29/2026 through 10/02/2026',
    ],
  ])('lists the requested dates %s to %s', (first, last, requested, effective) => {
    const summary = buildAfterVisitSummary(
      input({
        submission: {
          ...submission,
          firstDayOff: new Date(`${first}T00:00:00.000Z`),
          lastDayOff: new Date(`${last}T00:00:00.000Z`),
        },
      })
    )

    expect(summary.requestedDates).toBe(requested)
    expect(summary.determination[1]).toBe(effective)
  })

  it('lists the reason and symptoms, spelling out Other', () => {
    expect(buildAfterVisitSummary(input()).symptoms).toBe(
      'Feeling sick; symptoms: Sore throat, Cough'
    )

    const other = buildAfterVisitSummary(
      input({
        submission: {
          ...submission,
          absenceReason: 'Other',
          otherAbsenceReason: 'Dental procedure',
          symptoms: ['Other'],
          otherSymptomText: 'jaw swelling',
        },
      })
    )
    expect(other.symptoms).toBe('Dental procedure; symptoms: Other: jaw swelling')

    const none = buildAfterVisitSummary(input({ submission: { ...submission, symptoms: null } }))
    expect(none.symptoms).toBe('Feeling sick')
  })

  it('flags the 30-day limit the review page warns about', () => {
    expect(buildAfterVisitSummary(input()).redFlags).toBe('None')

    const flagged = buildAfterVisitSummary(
      input({ rollingLimit: { usedDays: 6, requestedDays: 2, totalDays: 8, exceeded: true } })
    )
    expect(flagged.redFlags).toBe(
      '30-day limit exceeded: 6 days approved in the prior 30 days + 2 requested = 8 days'
    )
  })

  it('lists every prior chart as medical history', () => {
    const summary = buildAfterVisitSummary(
      input({
        history: [
          priorChart,
          {
            ...priorChart,
            id: 'sub_denied',
            status: SubmissionStatus.DENIED,
            notePurpose: 'school',
            firstDayOff: new Date('2026-08-03T00:00:00.000Z'),
            lastDayOff: new Date('2026-08-03T00:00:00.000Z'),
            reviewedAt: new Date('2026-08-04T03:30:00.000Z'),
            absenceReason: 'Accident or injury',
            symptoms: null,
          },
          {
            ...priorChart,
            id: 'sub_pending',
            status: SubmissionStatus.PENDING_REVIEW,
            reviewedAt: null,
            createdAt: new Date('2026-07-01T15:00:00.000Z'),
            firstDayOff: new Date('2026-07-01T00:00:00.000Z'),
            lastDayOff: new Date('2026-07-02T00:00:00.000Z'),
            symptoms: [],
          },
        ],
      })
    )

    expect(summary.medicalHistory).toEqual([
      'September 15, 2026: [work] doctor note approved by Dr. Jason Buchwald for 3 days (Sep 15-17, 2026), due to Feeling sick (Sore throat, Headache or migraine).',
      'August 3, 2026: [school] doctor note denied by Dr. Jason Buchwald for 1 day (Aug 3, 2026), due to Accident or injury.',
      'July 1, 2026: [work] doctor note request pending review for 2 days (Jul 1-2, 2026), due to Feeling sick.',
    ])
  })

  it('names the purpose a prior Other chart gave', () => {
    const summary = buildAfterVisitSummary(
      input({
        history: [{ ...priorChart, notePurpose: 'other', otherNotePurpose: 'volunteering' }],
      })
    )

    expect(summary.medicalHistory[0]).toContain('[volunteering] doctor note approved')
  })

  it('says so when there are no prior charts', () => {
    expect(buildAfterVisitSummary(input()).medicalHistory).toEqual(['No prior charts on file'])
  })

  it('leaves additional information out unless asked', () => {
    expect(buildAfterVisitSummary(input()).additionalInformation).toBeNull()
    expect(
      buildAfterVisitSummary(input({ includeAdditionalInformation: true })).additionalInformation
    ).toBe('Saw urgent care yesterday')
    expect(
      buildAfterVisitSummary(
        input({
          includeAdditionalInformation: true,
          submission: { ...submission, additionalInformation: '  ' },
        })
      ).additionalInformation
    ).toBeNull()
  })

  it('issues the sick note on an approved chart', () => {
    const summary = buildAfterVisitSummary(input())

    expect(summary.assessment).toContain('the information is sufficient to support')
    expect(summary.plan).toBe('Sick note: issued')
    expect(summary.planNote).toBe(
      'The note includes only information necessary to communicate sick leave status from work or school.'
    )
  })

  it('says denied on a denied chart, without the reason', () => {
    const summary = buildAfterVisitSummary(
      input({
        submission: {
          ...submission,
          status: SubmissionStatus.DENIED,
          denialReason: 'Duplicate',
        },
      })
    )

    expect(summary.assessment).toContain('the information is not sufficient to support')
    expect(summary.determination).toEqual(['Status: Denied'])
    expect(summary.plan).toBe('Sick note: denied')
    expect(summary.planNote).toBeNull()
    expect(JSON.stringify(summary)).not.toContain('Duplicate')
  })

  it.each([SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE, SubmissionStatus.MANUAL])(
    'refuses a %s chart',
    (status) => {
      expect(() =>
        buildAfterVisitSummary(input({ submission: { ...submission, status } }))
      ).toThrow('Only approved or denied charts have an after-visit summary')
    }
  )

  it('refuses a chart with no review time', () => {
    expect(() =>
      buildAfterVisitSummary(input({ submission: { ...submission, reviewedAt: null } }))
    ).toThrow('Only approved or denied charts have an after-visit summary')
  })
})
