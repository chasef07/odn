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
            {/* Hero Section with Green Gradient */}
            <Section className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-t-2xl px-8 py-10 text-center">
              <Heading className="text-white text-3xl font-bold m-0 mb-2">
                Your Request is Approved!
              </Heading>
              <Text className="text-emerald-100 text-base m-0">
                Your doctor&apos;s note is ready
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
              <Section className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 mb-8 shadow-sm">
                <Row>
                  <Column className="w-16">
                    <div className="bg-emerald-500 w-12 h-12 rounded-full flex items-center justify-center text-2xl">
                      ✓
                    </div>
                  </Column>
                  <Column>
                    <Text className="text-emerald-900 text-sm font-semibold uppercase tracking-wide m-0 mb-2">
                      Document Attached
                    </Text>
                    <Heading className="text-emerald-950 text-2xl font-bold m-0 mb-3">
                      Doctor&apos;s Note PDF
                    </Heading>
                    <Text className="text-emerald-800 text-sm leading-relaxed m-0">
                      Your official doctor&apos;s note is attached to this email.
                      Download and save it for your records, and submit it to your
                      employer or school as needed.
                    </Text>
                  </Column>
                </Row>
              </Section>

              {/* What's Next Section */}
              <Section className="mb-8">
                <Heading className="text-gray-900 text-xl font-bold mb-4">
                  What&apos;s next?
                </Heading>

                <div className="space-y-4">
                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-emerald-600 text-xl font-bold m-0">
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
                      <Text className="text-emerald-600 text-xl font-bold m-0">
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
                      <Text className="text-emerald-600 text-xl font-bold m-0">
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

              {/* Important Information */}
              <Section className="bg-blue-50 rounded-xl p-6 mb-8">
                <Heading className="text-blue-900 text-base font-bold m-0 mb-2">
                  📋 Important Information
                </Heading>
                <Text className="text-blue-800 text-sm leading-relaxed m-0 mb-3">
                  Your doctor&apos;s note is a legitimate medical document provided by
                  a licensed medical professional. It includes:
                </Text>
                <ul className="text-blue-800 text-sm leading-relaxed m-0 pl-5">
                  <li>Your name and date of birth</li>
                  <li>Dates of absence</li>
                  <li>Medical certification</li>
                  <li>Doctor&apos;s signature and credentials</li>
                  <li>Unique reference number for verification</li>
                </ul>
              </Section>

              {/* Action Buttons */}
              <Section className="text-center mb-6">
                <Row>
                  <Column className="px-2">
                    <Button
                      href="mailto:support@onlinedoctornote.com"
                      className="bg-emerald-600 text-white font-semibold py-3 px-8 rounded-lg text-base no-underline inline-block"
                    >
                      Contact Support
                    </Button>
                  </Column>
                  <Column className="px-2">
                    <Button
                      href="https://onlinedoctornote.com/faq"
                      className="bg-white text-emerald-600 font-semibold py-3 px-8 rounded-lg text-base no-underline inline-block border-2 border-emerald-600"
                    >
                      View FAQs
                    </Button>
                  </Column>
                </Row>
              </Section>

              {/* Help Section */}
              <Section className="bg-gray-50 rounded-xl p-6 mt-8">
                <Heading className="text-gray-900 text-base font-bold m-0 mb-2">
                  💬 Need Help?
                </Heading>
                <Text className="text-gray-700 text-sm leading-relaxed m-0">
                  If you have any questions about your doctor&apos;s note or need
                  assistance submitting it, our support team is here to help at{' '}
                  <Link
                    href="mailto:support@onlinedoctornote.com"
                    className="text-emerald-600 font-medium no-underline"
                  >
                    support@onlinedoctornote.com
                  </Link>
                </Text>
              </Section>

              {/* Thank You */}
              <Text className="text-gray-600 text-sm text-center mt-8 mb-4">
                Thank you for choosing Online Doctor&apos;s Note. We hope you feel
                better soon!
              </Text>
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
