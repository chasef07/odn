import { render, toPlainText } from '@react-email/render'
import { describe, expect, it } from 'vitest'
import { ApprovalEmail } from '../ApprovalEmail'
import { DenialEmail } from '../DenialEmail'
import { FollowUpEmail } from '../FollowUpEmail'
import { PaymentConfirmationEmail } from '../PaymentConfirmationEmail'

describe('customer lifecycle email copy', () => {
  it('renders the proposed purchase confirmation with a usable reference and FAQ link', async () => {
    const html = await render(
      <PaymentConfirmationEmail patientName="Lily" submissionId="aff9b9dc-1234" />
    )

    const text = toPlainText(html)

    expect(text).toContain('Hi Lily')
    expect(text).toContain("Your doctor's note request has been successfully submitted")
    expect(text).toContain('#AFF9B9DC')
    expect(text).toContain('Our medical team will review your request')
    expect(text).toContain('attached to the approval email')
    expect(text).toContain('refer to the FAQs below for common questions')
    expect(html).toContain('href="https://onlinedoctornote.com/"')
    expect(text).toContain('hello@onlinedoctornote.com')
  })

  it('renders the proposed note delivery copy, QR guidance, support, and footer', async () => {
    const html = await render(
      <ApprovalEmail patientName="Cinda Seibert" notePurpose="work" absenceReason="Feeling sick" />
    )

    const text = toPlainText(html)

    expect(text).toContain('Hi Cinda Seibert')
    expect(text).toContain("find the attached doctor's note for a medically excused absence")
    expect(text).toContain('Please review the note to make sure that the information is accurate')
    expect(text).toContain('ask them to scan the QR code on the note')
    expect(text).toContain(
      'never provide any personal health information without your written request'
    )
    expect(text).toContain('The OnlineDoctorNote.com Team')
    expect(text).toContain('Professional medical documentation services you can trust')
  })

  it('renders the proposed seven-or-more-day denial and truthful refund facts', async () => {
    const html = await render(
      <DenialEmail patientName="Javeon Sydnor" denialReason="7+ days" refundAmount={24.95} />
    )

    const text = toPlainText(html)

    expect(text).toContain('Hi Javeon Sydnor')
    expect(text).toContain("unable to provide a doctor's note at this time")
    expect(text).toContain('exceeding the number of excused days permitted')
    expect(text).toContain('$24.95')
    expect(text).toContain('A full refund has been processed to your original payment method')
    expect(text).toContain('5-10 business days')
    expect(text).toContain('hello@onlinedoctornote.com')
    expect(text).not.toContain('View FAQs')
  })

  it('renders the retention-style follow-up with the doctor10 offer and customer support', async () => {
    const html = await render(<FollowUpEmail patientName="Alex Doe" notePurpose="work" />)

    const text = toPlainText(html)

    expect(text).toContain("NEED ANOTHER DOCTOR'S NOTE?")
    expect(text).toContain('Use Your Thank-You Discount')
    expect(text).toContain('NEED HELP OR A CORRECTION?')
    expect(text).toContain('hello@onlinedoctornote.com')
    expect(text).toContain('If your employer needs to verify your current note')
    expect(text).toContain('scan the QR code printed on it')
    expect(text).toContain('10% off your next note')
    expect(text).toContain('shared with and used by friends and family')
    expect(html).toContain('https://onlinedoctornote.com/?offer=doctor10')
    expect(html).not.toContain('offer=friends20')
    expect(html).not.toMatch(/unsubscribe/i)
    expect(text).not.toContain('No longer want to receive these emails?')
    expect(text).not.toContain('diagnosis')
    expect(text).not.toContain('symptoms')
  })

  it('omits employer QR guidance when the note purpose is not work or school', async () => {
    const html = await render(<FollowUpEmail patientName="Alex Doe" notePurpose="travel" />)

    expect(toPlainText(html)).not.toContain('scan the QR code')
  })
})
