import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { inflateSync } from 'zlib'
import { renderToBuffer } from '@react-pdf/renderer'
import type { AfterVisitSummary } from '../../after-visit-summary'
import { AfterVisitSummaryTemplate } from '../after-visit-summary-template'
import { generateAfterVisitSummaryPDF, pdfPageCount } from '../generate-pdf'

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
  medicalHistory: [],
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

  it('says so when there are no prior charts', async () => {
    const pdf = await renderToBuffer(
      <AfterVisitSummaryTemplate summary={summary} signatureUrl={signatureUrl} />
    )

    expect(pdfText(pdf)).toContain('No prior charts on file')
  })

  it('shrinks a summary that runs past one page so it fits on one, listing every chart', async () => {
    const long = { ...summary, medicalHistory: priorCharts(8) }
    const fullSize = await renderToBuffer(
      <AfterVisitSummaryTemplate summary={long} signatureUrl={signatureUrl} />
    )
    expect(pdfPageCount(fullSize)).toBeGreaterThan(1)

    const pdf = await generateAfterVisitSummaryPDF(long)

    expect(pdfPageCount(pdf)).toBe(1)
    expect(pdfText(pdf)).toContain('Prior chart 8:')
    expect(pdfText(pdf)).not.toContain('earlier chart')
  })

  it('lists the most recent prior charts that fit and counts the rest', async () => {
    const pdf = await generateAfterVisitSummaryPDF({ ...summary, medicalHistory: priorCharts(38) })
    const text = pdfText(pdf)
    const listed = [...text.matchAll(/Prior chart (\d+):/g)].map((match) => Number(match[1]))

    expect(pdfPageCount(pdf)).toBe(1)
    expect(listed).toEqual(Array.from({ length: listed.length }, (_, i) => i + 1))
    expect(listed.length).toBeGreaterThan(5)
    expect(text).toContain(`Plus ${38 - listed.length} earlier charts on file, not listed here.`)
    expect(text).toContain('Physician Attestation')
  })

  it('refuses a summary that cannot fit on one page even with no prior charts listed', async () => {
    await expect(
      generateAfterVisitSummaryPDF({
        ...summary,
        additionalInformation: 'Long note. '.repeat(1200),
      })
    ).rejects.toThrow('The after-visit summary does not fit on one page.')
  })
})

function priorCharts(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) =>
      `Prior chart ${i + 1}: [work] doctor note approved by Dr. Jason Buchwald for 2 days (Sep 1-2, 2026), due to Feeling sick (Sore throat, Cough, Headache or migraine).`
  )
}

function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1')
  let text = ''
  for (const match of raw.matchAll(/(?<!end)stream\r?\n/g)) {
    const dictionary = raw.slice(raw.lastIndexOf(' obj', match.index), match.index)
    if (!dictionary.includes('/FlateDecode') || dictionary.includes('/Image')) continue
    const start = match.index + match[0].length
    const content = inflateSync(pdf.subarray(start, raw.indexOf('endstream', start))).toString(
      'latin1'
    )
    for (const hex of content.matchAll(/<([0-9a-fA-F]+)>/g)) {
      text += Buffer.from(hex[1], 'hex').toString('latin1')
    }
  }
  return text.replace(/\s+/g, ' ')
}
