import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import { MaybeEmail } from '../MaybeEmail'
import {
  DATES_EXCEED_ALLOWED_RANGE_REASON,
  MAYBE_REASONS,
  MORE_INFO_NEEDED_REASON,
} from '@/lib/maybe-reasons'

describe('MaybeEmail', () => {
  it('renders each customer-facing maybe reason with dynamic copy', async () => {
    const emailReasons = MAYBE_REASONS.filter(
      (reason) => reason.sendsEmail && !reason.requiresApprovedDays
    )

    for (const reason of emailReasons) {
      const html = await render(<MaybeEmail patientName="John Doe" reason={reason.value} />)

      expect(html).toContain('Hi <strong>John Doe</strong>')
      expect(html).toContain(
        reason.value === MORE_INFO_NEEDED_REASON
          ? 'More information needed'
          : 'Additional review needed'
      )
      expect(html).toContain('OnlineDoctorNote')
      expect(html).not.toContain('Platinum Health Clinic')
      for (const paragraph of reason.emailMessage.split('\n\n')) {
        expect(html).toContain(paragraph.replaceAll("'", '&#x27;'))
      }
    }
  })

  it('keeps additional details in the chart unless the customer explicitly requests note inclusion', async () => {
    const html = await render(
      <MaybeEmail patientName="John Doe" reason={MORE_INFO_NEEDED_REASON} />
    )

    expect(html).toContain('More information needed')
    expect(html).toContain(
      'Can you please provide additional details regarding your appointment, injury, or medical condition?'
    )
    expect(html).toContain('We will add this information to your chart for the doctor’s review.')
    expect(html).toContain(
      'However, we will not include it on your note unless you request that we do so.'
    )
    expect(html).toContain('Please reply directly to this email with the additional details.')
    expect(html).toContain('mailto:hello@onlinedoctornote.com')
  })

  it('renders the 1-day dates-exceed email copy', async () => {
    const html = await render(
      <MaybeEmail
        patientName="John Doe"
        reason={DATES_EXCEED_ALLOWED_RANGE_REASON}
        approvedDays={1}
      />
    )

    expect(html).toContain('Hello,')
    expect(html).toContain('we can only issue a note for 1 day')
    expect(html).toContain('Please let us know if you want to modify the dates or prefer a refund')
    expect(html).toContain('please reply with the date you would like excused')
  })

  it('renders the 2-5 day dates-exceed email copy', async () => {
    const html = await render(
      <MaybeEmail
        patientName="John Doe"
        reason={DATES_EXCEED_ALLOWED_RANGE_REASON}
        approvedDays={4}
      />
    )

    expect(html).toContain('Hello,')
    expect(html).toContain('we can only issue a note for up to 4 consecutive days')
    expect(html).toContain('Please let us know if you want to modify the dates or prefer a refund')
    expect(html).toContain('please reply with the first day you would like excused')
  })
})
