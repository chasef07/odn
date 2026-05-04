import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import { MaybeEmail } from '../MaybeEmail'
import { MAYBE_REASONS } from '@/lib/maybe-reasons'

describe('MaybeEmail', () => {
  it('renders each customer-facing maybe reason with dynamic copy', async () => {
    const emailReasons = MAYBE_REASONS.filter((reason) => reason.sendsEmail)

    for (const reason of emailReasons) {
      const html = await render(<MaybeEmail patientName="John Doe" reason={reason.value} />)

      expect(html).toContain('Hi <strong>John Doe</strong>')
      expect(html).toContain('Additional review needed')
      for (const paragraph of reason.emailMessage.split('\n\n')) {
        expect(html).toContain(paragraph.replaceAll("'", '&#x27;'))
      }
    }
  })
})
