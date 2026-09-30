/**
 * Tests for Approval Email Template
 * Tests dynamic subject lines, caregiver/appointment content, and work/school text
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import { ApprovalEmail } from '../ApprovalEmail'

describe('ApprovalEmail - Subject Lines', () => {
  it('should have caregiver-specific subject line', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="work"
        absenceReason="Taking care of someone"
      />
    )

    expect(html).toContain('Your Caregiver&#x27;s Note Has Arrived!')
  })

  it('should have work-specific subject line for regular notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('Your Doctor&#x27;s Note For Work Has Arrived!')
  })

  it('should have school-specific subject line', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="school" absenceReason="Feeling sick" />
    )

    expect(html).toContain('Your Doctor&#x27;s Note For School Has Arrived!')
  })

  it('should have work and school subject line for both', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="both" absenceReason="Feeling sick" />
    )

    expect(html).toContain('Your Doctor&#x27;s Note For Work and School Has Arrived!')
  })

  it('should have generic subject line for other purpose', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="other" absenceReason="Feeling sick" />
    )

    expect(html).toContain('Your Doctor&#x27;s Note Has Arrived!')
  })

  it('should have dynamic subject line for doctor appointment (work)', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="work"
        absenceReason="Doctor's appointment"
      />
    )

    expect(html).toContain('Your Doctor&#x27;s Note For Work Has Arrived!')
  })

  it('should have dynamic subject line for doctor appointment (school)', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="school"
        absenceReason="Doctor's appointment"
      />
    )

    expect(html).toContain('Your Doctor&#x27;s Note For School Has Arrived!')
  })
})

describe('ApprovalEmail - Greeting', () => {
  it('should display "Hi [Name]" with bold formatting', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('Hi <strong>John Doe</strong>')
  })

  it('should use default name if not provided', async () => {
    const html = await render(
      <ApprovalEmail patientName="Patient" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('Hi <strong>Patient</strong>')
  })
})

describe('ApprovalEmail - Body Text (from work/school)', () => {
  it('should say "from work" for work notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('medically excused absence')
    expect(html).toContain('from work')
  })

  it('should say "from school" for school notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="school" absenceReason="Feeling sick" />
    )

    expect(html).toContain('medically excused absence')
    expect(html).toContain('from school')
  })

  it('should say "from work and school" for both', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="both" absenceReason="Feeling sick" />
    )

    expect(html).toContain('medically excused absence')
    expect(html).toContain('from work and school')
  })

  it('should say "from school" for caregiver notes with school purpose', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="school"
        absenceReason="Taking care of someone"
      />
    )

    // Caregiver + school = student taking care of family member
    expect(html).toContain('medically excused absence')
    expect(html).toContain('from school')
  })
})

describe('ApprovalEmail - Verification Text (employer/school)', () => {
  it('should say "employer" for work notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('employer')
    expect(html).toContain('needs further verification')
    expect(html).toContain('scan the QR code on the note')
    expect(html).toContain(
      'Please know that if we are contacted to verify a note, we will never provide any personal health information without your written request.'
    )
    expect(html).not.toContain('onlinedoctornote.com/verify')
  })

  it('should say "school" for school notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="school" absenceReason="Feeling sick" />
    )

    expect(html).toContain('school')
    expect(html).toContain('needs further verification')
  })

  it('should say "employer or school" for both', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="both" absenceReason="Feeling sick" />
    )

    expect(html).toContain('employer or school')
    expect(html).toContain('needs further verification')
  })

  it('should say "school" for caregiver notes with school purpose', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="school"
        absenceReason="Taking care of someone"
      />
    )

    // Caregiver + school = student taking care of family member
    expect(html).toContain('school')
    expect(html).toContain('needs further verification')
  })

  it('should not include verification URLs or Medical Record # in the email body', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="work"
        absenceReason="Feeling sick"
        medicalRecordNumber="A7B3C9D2"
        verificationUrl="https://onlinedoctornote.com/verify/v_test"
      />
    )

    expect(html).toContain('scan the QR code on the note')
    expect(html).not.toContain('https://onlinedoctornote.com/verify/v_test')
    expect(html).not.toContain('https://onlinedoctornote.com/verify')
    expect(html).not.toContain('A7B3C9D2')
    expect(html).not.toContain('Medical Record #')
  })
})

describe('ApprovalEmail - Caregiver-Specific Content', () => {
  it('should display caregiver-specific supportive message', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="work"
        absenceReason="Taking care of someone"
      />
    )

    expect(html).toContain(
      'just how difficult taking care of a family member with health issues can be'
    )
  })

  it('should not display health recovery message for caregivers', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="work"
        absenceReason="Taking care of someone"
      />
    )

    expect(html).not.toContain('starting to feel much better')
    expect(html).not.toContain('seek in-person medical attention')
  })
})

describe('ApprovalEmail - Doctor Appointment Content', () => {
  it('should display appointment-specific supportive message', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="work"
        absenceReason="Doctor's appointment"
      />
    )

    expect(html).toContain('helpful to attend your appointment')
  })

  it('should not display health recovery message for appointments', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="work"
        absenceReason="Doctor's appointment"
      />
    )

    expect(html).not.toContain('starting to feel much better')
    expect(html).not.toContain('seek in-person medical attention')
  })

  it('should use dynamic work/school text for appointments', async () => {
    const html = await render(
      <ApprovalEmail
        patientName="John Doe"
        notePurpose="school"
        absenceReason="Doctor's appointment"
      />
    )

    expect(html).toContain('medically excused absence')
    expect(html).toContain('from school')
    expect(html).toContain('school')
    expect(html).toContain('needs further verification')
  })
})

describe('ApprovalEmail - Regular Note Content', () => {
  it('should display health recovery message for regular notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('you are already starting to feel much better')
    expect(html).toContain(
      'seek in-person medical attention if your medical condition has not improved'
    )
  })

  it('should display health recovery message for injury notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Accident or injury" />
    )

    expect(html).toContain('you are already starting to feel much better')
  })

  it('should display health recovery message for mental health notes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Mental health" />
    )

    expect(html).toContain('you are already starting to feel much better')
  })
})

describe('ApprovalEmail - Contact Information', () => {
  it('should not promote the verification page URL in the email body', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).not.toContain('https://onlinedoctornote.com/verify')
  })

  it('should not offer phone verification', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).not.toContain('786-292-3730')
    expect(html).not.toContain('tel:')
  })

  it('should display support email in help section', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('hello@onlinedoctornote.com')
  })

  it('should contain "reply to hello@onlinedoctornote.com" in point 1 for changes', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    // Point 1 should mention replying to hello@onlinedoctornote.com for changes
    expect(html).toContain('reply to')
    expect(html).toContain('hello@onlinedoctornote.com')
  })

  it('should direct patients to text "help" to the support line in point 1', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('help')
    expect(html).toContain('href="sms:+18886611941"')
    expect(html).toContain('(888) 661-1941')
    expect(html).toContain('to reach our support team')
  })
})

describe('ApprovalEmail - Static Content', () => {
  it('should display thank you message', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('thanking you for entrusting us with your health needs')
  })

  it('should display "A few important points" header', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('A few important points')
  })

  it('should display point 1 about reviewing accuracy', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('review the note to make sure that the information is accurate')
  })

  it('should display "To better health!" closing', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('To better health!')
    expect(html).toContain('The OnlineDoctorNote.com Team')
  })

  it('should display help section', async () => {
    const html = await render(
      <ApprovalEmail patientName="John Doe" notePurpose="work" absenceReason="Feeling sick" />
    )

    expect(html).toContain('We are always here to help')
  })
})
