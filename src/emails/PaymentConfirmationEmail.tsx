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

interface PaymentConfirmationEmailProps {
  patientName: string
  submissionId: string
}

export const PaymentConfirmationEmail = ({
  patientName = 'Patient',
  submissionId = '550E8400',
}: PaymentConfirmationEmailProps) => {
  const currentYear = new Date().getFullYear()
  // Format submission ID as short version (first 8 chars uppercase)
  const shortId = submissionId.toUpperCase().substring(0, 8)

  return (
    <Html>
      <Head />
      <Preview>Payment confirmed - Your doctor&apos;s note request is being reviewed</Preview>
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

              <Text className="text-gray-700 text-base leading-relaxed mb-8">
                Thank you for your payment! Your doctor&apos;s note request has been successfully
                submitted and is now under review by our medical team.
              </Text>

              {/* Submission ID Card */}
              <Section
                className="rounded-2xl p-6 mb-8 bg-white"
                style={{ border: '2px solid #009ed9' }}
              >
                <Text className="text-sm font-semibold uppercase tracking-wide m-0 mb-2 text-gray-700">
                  Reference Number
                </Text>
                <Heading className="text-2xl font-bold m-0 mb-3 text-gray-900">
                  #{shortId}
                </Heading>
                <Text className="text-sm leading-relaxed m-0 text-gray-700">
                  Save this reference number for your records. You can use it to track your
                  submission or contact our support team if needed.
                </Text>
              </Section>

              {/* What's Next Section */}
              <Section className="mb-8">
                <Heading className="text-gray-900 text-xl font-bold mb-4">
                  What happens next?
                </Heading>

                <div className="space-y-4">
                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-xl font-bold m-0" style={{ color: '#009ed9' }}>
                        1
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Our medical team will review your request
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-xl font-bold m-0" style={{ color: '#009ed9' }}>
                        2
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        If your request is approved, you&apos;ll receive an email notification
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-xl font-bold m-0" style={{ color: '#009ed9' }}>
                        3
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Your official doctor&apos;s note PDF will be attached to the approval email
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
                  style={{ backgroundColor: '#009ed9' }}
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
                  If you have any questions about your submission or need assistance, our support
                  team is here to help at{' '}
                  <Link
                    href="mailto:hello@onlinedoctornote.com"
                    className="font-medium no-underline"
                    style={{ color: '#009ed9' }}
                  >
                    hello@onlinedoctornote.com
                  </Link>
                  . Please include your reference number (#{shortId}) in any correspondence.
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

export default PaymentConfirmationEmail
