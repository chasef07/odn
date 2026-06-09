import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
  Button,
  Row,
  Column,
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'
import * as React from 'react'
import { getRecipientName, getAbsenceFromText } from '@/lib/email-helpers'

interface ApprovalEmailProps {
  patientName: string
  notePurpose: string
  absenceReason: string
  medicalRecordNumber?: string
  verificationUrl?: string
}

export const ApprovalEmail = ({
  patientName = 'Patient',
  notePurpose = 'work or school',
  absenceReason = 'Feeling sick',
}: ApprovalEmailProps) => {
  // Check if this is a caregiver note or doctor's appointment
  const isCaregiver = absenceReason === 'Taking care of someone'
  const isAppointment = absenceReason === "Doctor's appointment"

  // Map note purpose to dynamic subject line text
  const subjectPurposeMap: Record<string, string> = {
    work: 'For Work',
    school: 'For School',
    both: 'For Work and School',
    travel: 'For Travel',
    other: '',
  }

  const subjectPurpose = subjectPurposeMap[notePurpose] || ''
  const currentYear = new Date().getFullYear()

  // Dynamic subject line based on absence reason or note purpose
  const subjectLine = isCaregiver
    ? "Your Caregiver's Note Has Arrived!"
    : subjectPurpose
      ? `Your Doctor's Note ${subjectPurpose} Has Arrived!`
      : "Your Doctor's Note Has Arrived!"

  return (
    <Html>
      <Head />
      <Preview>{subjectLine}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-2xl">
            {/* Header with Logo */}
            <Section className="rounded-t-2xl border-b border-gray-200 bg-white px-8 py-4">
              <Text className="m-0 text-2xl font-bold" style={{ color: '#009ed9' }}>
                OnlineDoctorNote
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="bg-white px-8 py-8">
              <Text className="mb-6 text-base leading-relaxed text-gray-900">
                Hi <strong>{patientName}</strong>,
              </Text>

              <Text className="mb-6 text-base leading-relaxed text-gray-700">
                We want to start by thanking you for entrusting us with your health needs. Please
                find the attached doctor&apos;s note for a medically excused absence{' '}
                {getAbsenceFromText(notePurpose)}.
              </Text>

              <Heading className="mb-4 text-xl font-bold text-gray-900">
                A few important points…
              </Heading>

              <Row className="mb-8 items-start">
                <Column className="w-8">
                  <Text className="m-0 text-xl font-bold" style={{ color: '#009ed9' }}>
                    1
                  </Text>
                </Column>
                <Column>
                  <Text className="m-0 text-base leading-relaxed text-gray-700">
                    Please review the note to make sure that the information is accurate. If you
                    need us to make any changes, please reply to{' '}
                    <Link
                      href="mailto:hello@onlinedoctornote.com"
                      className="font-medium no-underline"
                      style={{ color: '#009ed9' }}
                    >
                      hello@onlinedoctornote.com
                    </Link>{' '}
                    with instructions and we will promptly handle it.
                  </Text>
                </Column>
              </Row>

              <Row className="mb-8 items-start">
                <Column className="w-8">
                  <Text className="m-0 text-xl font-bold" style={{ color: '#009ed9' }}>
                    2
                  </Text>
                </Column>
                <Column>
                  <Text className="m-0 text-base leading-relaxed text-gray-700">
                    If your {getRecipientName(notePurpose)} needs further verification, please ask
                    them to scan the QR code on the note.
                  </Text>
                  <Text className="mt-3 mb-0 text-base leading-relaxed text-gray-700">
                    Please know that we will never provide any personal health information without
                    your written request.
                  </Text>
                </Column>
              </Row>

              <Text className="mb-6 text-base leading-relaxed text-gray-700">
                {isCaregiver ? (
                  <>
                    We hope that the needed time off is helpful as we know just how difficult taking
                    care of a family member with health issues can be.
                  </>
                ) : isAppointment ? (
                  <>We hope that the needed time off is helpful to attend your appointment.</>
                ) : (
                  <>
                    We hope that the needed time off is helpful and that you are already starting to
                    feel much better. Please make sure you seek in-person medical attention if your
                    medical condition has not improved, or has worsened.
                  </>
                )}
              </Text>

              <Text className="mb-8 text-base leading-relaxed text-gray-700">
                To better health!
                <br />
                <strong>The OnlineDoctorNote.com Team</strong>
              </Text>

              <Hr className="my-8 border-gray-200" />

              {/* Help Section */}
              <Section className="mt-8 rounded-xl bg-gray-50 p-6">
                <Text className="m-0 text-sm leading-relaxed text-gray-700">
                  We are always here to help. Email us at{' '}
                  <Link
                    href="mailto:hello@onlinedoctornote.com"
                    className="font-medium no-underline"
                    style={{ color: '#009ed9' }}
                  >
                    hello@onlinedoctornote.com
                  </Link>
                </Text>
              </Section>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-2xl bg-gray-100 px-8 py-6">
              <Text className="m-0 text-center text-xs leading-relaxed text-gray-600">
                © {currentYear} Online Doctor&apos;s Note. All rights reserved.
                <br />
                Professional medical documentation services you can trust.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default ApprovalEmail
