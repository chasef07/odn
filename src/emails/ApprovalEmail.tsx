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

interface ApprovalEmailProps {
  patientName: string
  notePurpose: string
}

export const ApprovalEmail = ({
  patientName = 'Patient',
  notePurpose = 'work or school',
}: ApprovalEmailProps) => {
  // Map note purpose to user-friendly messages
  const purposeMessages: Record<string, string> = {
    work: 'for work',
    school: 'for school',
    both: 'for work and school',
    other: '',
  }

  const purposeMessage = purposeMessages[notePurpose] || ''
  const currentYear = new Date().getFullYear()

  return (
    <Html>
      <Head />
      <Preview>
        Your doctor&apos;s note has been approved - Document attached
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-2xl">
            {/* Header with Logo */}
            <Section className="bg-white px-8 py-4 rounded-t-2xl border-b border-gray-200">
              <Text className="text-2xl font-bold m-0" style={{ color: 'oklch(0.65 0.18 230)' }}>
                OnlineDoctorNote
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="bg-white px-8 py-8">
              <Text className="text-gray-900 text-base leading-relaxed mb-6">
                Hi <strong>{patientName}</strong>,
              </Text>

              <Text className="text-gray-700 text-base leading-relaxed mb-8">
                Great news! Your doctor&apos;s note request {purposeMessage} has been{' '}
                <strong>approved</strong> by our medical team. Your official documentation
                is attached to this email as a PDF file.
              </Text>

              {/* Success Card */}
              <Section className="rounded-2xl p-6 mb-8 bg-white" style={{ border: '2px solid oklch(0.65 0.18 230)' }}>
                <Text className="text-sm font-semibold uppercase tracking-wide m-0 mb-2 text-gray-700">
                  Document Attached
                </Text>
                <Heading className="text-2xl font-bold m-0 mb-3 text-gray-900">
                  Doctor&apos;s Note PDF
                </Heading>
                <Text className="text-sm leading-relaxed m-0 text-gray-700">
                  Your official doctor&apos;s note is attached to this email.
                  Download and save it for your records, and submit it to your
                  employer or school as needed.
                </Text>
              </Section>

              {/* What's Next Section */}
              <Section className="mb-8">
                <Heading className="text-gray-900 text-xl font-bold mb-4">
                  What&apos;s next?
                </Heading>

                <div className="space-y-4">
                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-xl font-bold m-0" style={{ color: 'oklch(0.65 0.18 230)' }}>
                        1
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Download the attached PDF file to your device
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-xl font-bold m-0" style={{ color: 'oklch(0.65 0.18 230)' }}>
                        2
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Submit the doctor&apos;s note to your employer or school
                        as required by their policy
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-xl font-bold m-0" style={{ color: 'oklch(0.65 0.18 230)' }}>
                        3
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Keep a copy for your personal records - you can print
                        or save the digital file
                      </Text>
                    </Column>
                  </Row>
                </div>
              </Section>

              <Hr className="border-gray-200 my-8" />

              {/* FAQ Button */}
              <Section className="text-center mb-6">
                <Button
                  href="https://onlinedoctornote.com"
                  className="text-white font-semibold py-3 px-8 rounded-lg text-base no-underline inline-block"
                  style={{ backgroundColor: 'oklch(0.65 0.18 230)' }}
                >
                  View FAQs
                </Button>
              </Section>

              {/* Help Section */}
              <Section className="bg-gray-50 rounded-xl p-6 mt-8">
                <Heading className="text-gray-900 text-base font-bold m-0 mb-2">
                  Need Help?
                </Heading>
                <Text className="text-gray-700 text-sm leading-relaxed m-0">
                  If you have any questions about your doctor&apos;s note or need
                  assistance submitting it, our support team is here to help at{' '}
                  <Link
                    href="mailto:hello@onlinedoctornote.com"
                    className="font-medium no-underline"
                    style={{ color: 'oklch(0.65 0.18 230)' }}
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
