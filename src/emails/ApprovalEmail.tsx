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
    other: '',
  }

  // Map note purpose to body text ("from X")
  const bodyPurposeMap: Record<string, string> = {
    work: 'from work',
    school: 'from school',
    both: 'from work and school',
    other: '', // Generic: "medically excused absence" only
  }

  const subjectPurpose = subjectPurposeMap[notePurpose] || ''
  const bodyPurpose = bodyPurposeMap[notePurpose] || ''
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
            <Section className="bg-white px-8 py-4 rounded-t-2xl border-b border-gray-200">
              <Text className="text-2xl font-bold m-0" style={{ color: '#009ed9' }}>
                OnlineDoctorNote
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="bg-white px-8 py-8">
              <Text className="text-gray-900 text-base leading-relaxed mb-6">
                Hi <strong>{patientName}</strong>,
              </Text>

              <Text className="text-gray-700 text-base leading-relaxed mb-6">
                We want to start by thanking you for entrusting us with your health needs.
                Please find the attached doctor&apos;s note for a medically excused absence{' '}
                {getAbsenceFromText(notePurpose)}.
              </Text>

              <Heading className="text-gray-900 text-xl font-bold mb-4">
                A few important points…
              </Heading>

              <Row className="items-start mb-8">
                <Column className="w-8">
                  <Text className="text-xl font-bold m-0" style={{ color: '#009ed9' }}>
                    1
                  </Text>
                </Column>
                <Column>
                  <Text className="text-gray-700 text-base m-0 leading-relaxed">
                    Please review the note to make sure that the information is accurate.
                    If you need us to make any changes, please reply to this email with
                    instructions and we will promptly handle it.
                  </Text>
                </Column>
              </Row>

              <Row className="items-start mb-8">
                <Column className="w-8">
                  <Text className="text-xl font-bold m-0" style={{ color: '#009ed9' }}>
                    2
                  </Text>
                </Column>
                <Column>
                  <Text className="text-gray-700 text-base m-0 leading-relaxed">
                    If your {getRecipientName(notePurpose)} needs
                    further verification, please ask them to email our medical office at{' '}
                    <Link
                      href="mailto:hello@platinumhealthclinic.com"
                      className="font-medium no-underline"
                      style={{ color: '#009ed9' }}
                    >
                      hello@platinumhealthclinic.com
                    </Link>{' '}
                    or call us at{' '}
                    <Link
                      href="tel:786-292-3730"
                      className="font-medium no-underline"
                      style={{ color: '#009ed9' }}
                    >
                      786-292-3730
                    </Link>{' '}
                    and our team will gladly assist. Please note that we will never
                    provide any personal health information without your written request.
                  </Text>
                </Column>
              </Row>

              <Text className="text-gray-700 text-base leading-relaxed mb-6">
                {isCaregiver ? (
                  <>
                    We hope that the needed time off is helpful as we know just how difficult
                    taking care of a family member with health issues can be.
                  </>
                ) : isAppointment ? (
                  <>
                    We hope that the needed time off is helpful to attend your appointment.
                  </>
                ) : (
                  <>
                    We hope that the needed time off is helpful and that you are already
                    starting to feel much better. Please make sure you seek in-person medical
                    attention if your medical condition has not improved, or has worsened.
                  </>
                )}
              </Text>

              <Text className="text-gray-700 text-base leading-relaxed mb-8">
                To better health!
                <br />
                <strong>The OnlineDoctorNote.com Team</strong>
              </Text>

              <Hr className="border-gray-200 my-8" />

              {/* Help Section */}
              <Section className="bg-gray-50 rounded-xl p-6 mt-8">
                <Text className="text-gray-700 text-sm leading-relaxed m-0">
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
            <Section className="bg-gray-100 px-8 py-6 rounded-b-2xl">
              <Text className="text-gray-600 text-xs text-center leading-relaxed m-0">
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
