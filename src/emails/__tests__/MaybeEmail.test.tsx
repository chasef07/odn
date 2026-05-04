import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import { MaybeEmail } from '../MaybeEmail'
import { DATES_EXCEED_ALLOWED_RANGE_REASON, MAYBE_REASONS } from '@/lib/maybe-reasons'

describe('MaybeEmail', () => {
  it('renders each customer-facing maybe reason with dynamic copy', async () => {
    const emailReasons = MAYBE_REASONS.filter(
      (reason) => reason.sendsEmail && !reason.requiresApprovedDays
    )

    for (const reason of emailReasons) {
      const html = await render(<MaybeEmail patientName="John Doe" reason={reason.value} />)

      expect(html).toContain('Hi <strong>John Doe</strong>')
      expect(html).toContain('Additional review needed')
      for (const paragraph of reason.emailMessage.split('\n\n')) {
        expect(html).toContain(paragraph.replaceAll("'", '&#x27;'))
      }
    }
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
