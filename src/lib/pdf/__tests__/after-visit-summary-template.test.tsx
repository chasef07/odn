import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { renderToBuffer } from '@react-pdf/renderer'
import type { AfterVisitSummary } from '../../after-visit-summary'
import { AfterVisitSummaryTemplate } from '../after-visit-summary-template'

const summary: AfterVisitSummary = {
  signedAt: '09/30/2026 | 7:50 AM ET',
  clinician: 'Jason Buchwald, MD FACEP | New York License #229551',
  signer: 'Jason Buchwald, MD FACEP',
  patient: 'Isaiah Bandoo | DOB: 09/14/2000',
  patientLocation: 'New York',
  encounterModality: 'Asynchronous',
  identityVerifiedBy: 'Patient provided',
  consent: 'The patient requested an evaluation for sick leave documentation.',
  reasonForRequest: 'Absence from work',
  requestedDates: 'Off dates: 09/29/2026 and 09/30/2026. Return date: 10/01/2026',
  symptoms: 'Feeling sick; symptoms: Sore throat, Cough',
  redFlags: 'None',
  medicalHistory: ['No prior charts on file'],
  additionalInformation: 'Saw urgent care yesterday',
  assessment:
    'Based on the patient-submitted history and available records, the information is sufficient.',
  determination: ['Status: Excused from work', 'Effective dates: 09/29/2026 through 09/30/2026'],
  plan: 'Sick note: issued',
  planNote: 'The note includes only information necessary to communicate sick leave status.',
  attestation: 'I personally reviewed the completed branching questionnaire.',
}

const signatureUrl = join(process.cwd(), 'public', 'images', 'doctor-signature.png')

describe('AfterVisitSummaryTemplate', () => {
  it('renders an approved summary to a PDF with the stored signature image', async () => {
    const buffer = await renderToBuffer(
      <AfterVisitSummaryTemplate summary={summary} signatureUrl={signatureUrl} />
    )

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buffer.toString('latin1')).toMatch(/\/Subtype \/Image\s+\/Height 284\s+\/Width 600/)
  })

  it('renders a denied summary with no plan note or additional information', async () => {
    const buffer = await renderToBuffer(
      <AfterVisitSummaryTemplate
        summary={{
          ...summary,
          determination: ['Status: Denied'],
          plan: 'Sick note: denied',
          planNote: null,
          additionalInformation: null,
        }}
        signatureUrl={signatureUrl}
      />
    )

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
