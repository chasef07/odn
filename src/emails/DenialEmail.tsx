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

interface DenialEmailProps {
  patientName: string
  denialReason: string
  refundAmount: number
}

export const DenialEmail = ({
  patientName = 'Patient',
  denialReason = 'Other',
  refundAmount = 24.95,
}: DenialEmailProps) => {
  // Map internal denial reasons to user-friendly messages
  const reasonMessages = {
    Legal: 'due to legal or compliance requirements',
    '7+ days': 'because the absence period exceeds our 7-day limit',
    Other: 'after careful review of your submission',
  }

  const denialReasonMessage =
    reasonMessages[denialReason as keyof typeof reasonMessages] ||
    reasonMessages.Other

  // Format refund amount as currency
  const formattedRefund = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(refundAmount)

  const currentYear = new Date().getFullYear()

  return (
    <Html>
      <Head />
      <Preview>
        Your doctor&apos;s note request update - Refund processed
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-2xl">
            {/* Hero Section with Gradient */}
            <Section className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl px-8 py-10 text-center">
              <Heading className="text-white text-3xl font-bold m-0 mb-2">
                Doctor&apos;s Note Request Update
              </Heading>
              <Text className="text-indigo-100 text-base m-0">
                We&apos;ve processed your refund
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="bg-white px-8 py-8">
              <Text className="text-gray-900 text-base leading-relaxed mb-6">
                Hi <strong>{patientName}</strong>,
              </Text>

              <Text className="text-gray-700 text-base leading-relaxed mb-8">
                Thank you for submitting your doctor&apos;s note request. After
                careful review, we regret to inform you that your request was{' '}
                <strong>not approved</strong> {denialReasonMessage}.
              </Text>

              {/* Refund Card - The Star */}
              <Section className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 mb-8 shadow-sm">
                <Row>
                  <Column className="w-16">
                    <div className="bg-emerald-500 w-12 h-12 rounded-full flex items-center justify-center text-2xl">
                      ✓
                    </div>
                  </Column>
                  <Column>
                    <Text className="text-emerald-900 text-sm font-semibold uppercase tracking-wide m-0 mb-2">
                      Refund Processed
                    </Text>
                    <Heading className="text-emerald-950 text-3xl font-bold m-0 mb-3">
                      {formattedRefund}
                    </Heading>
                    <Text className="text-emerald-800 text-sm leading-relaxed m-0">
                      A full refund has been processed to your original payment
                      method. Please allow <strong>5-10 business days</strong>{' '}
                      for the refund to appear in your account.
                    </Text>
                  </Column>
                </Row>
              </Section>

              {/* What's Next Section */}
              <Section className="mb-8">
                <Heading className="text-gray-900 text-xl font-bold mb-4">
                  What happens next?
                </Heading>

                <div className="space-y-4">
                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-indigo-600 text-xl font-bold m-0">
                        1
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Your refund has been initiated and will appear within
                        5-10 business days
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-indigo-600 text-xl font-bold m-0">
                        2
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Check your bank statement for the credit from{' '}
                        <strong>Online Doctor&apos;s Note</strong>
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="text-indigo-600 text-xl font-bold m-0">
                        3
                      </Text>
                    </Column>
                    <Column>
                      <Text className="text-gray-700 text-sm m-0">
                        Have questions? Our support team is here to help
                      </Text>
                    </Column>
                  </Row>
                </div>
              </Section>

              <Hr className="border-gray-200 my-8" />

              {/* Action Buttons */}
              <Section className="text-center mb-6">
                <Row>
                  <Column className="px-2">
                    <Button
                      href="mailto:support@onlinedoctornote.com"
                      className="bg-indigo-600 text-white font-semibold py-3 px-8 rounded-lg text-base no-underline inline-block"
                    >
                      Contact Support
                    </Button>
                  </Column>
                  <Column className="px-2">
                    <Button
                      href="https://onlinedoctornote.com/faq"
                      className="bg-white text-indigo-600 font-semibold py-3 px-8 rounded-lg text-base no-underline inline-block border-2 border-indigo-600"
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
                  If you believe this denial was made in error or have
                  questions, our support team is ready to assist you at{' '}
                  <Link
                    href="mailto:support@onlinedoctornote.com"
                    className="text-indigo-600 font-medium no-underline"
                  >
                    support@onlinedoctornote.com
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

export default DenialEmail
