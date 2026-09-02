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
  // denialReason kept for potential future use/logging
  void denialReason

  // Format refund amount as currency
  const formattedRefund = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(refundAmount)

  const currentYear = new Date().getFullYear()

  return (
    <Html>
      <Head />
      <Preview>Your doctor&apos;s note request update - Refund processed</Preview>
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

              <Text className="mb-4 text-base leading-relaxed text-gray-700">
                Thank you for submitting your doctor&apos;s note request. After careful review by
                our medical team, we are unfortunately unable to provide a doctor&apos;s note at
                this time.
              </Text>

              <Text className="mb-8 text-base leading-relaxed text-gray-700">
                This determination may be due to a variety of factors, including but not limited to:
                exceeding the number of excused days permitted under our clinical guidelines,
                submission of a duplicate request, requests related to legal matters, workplace
                accommodation requests, or other limitations within our clinical and compliance
                guidelines.
              </Text>

              {/* Refund Card */}
              <Section
                className="mb-8 rounded-2xl bg-white p-6"
                style={{ border: '2px solid #009ed9' }}
              >
                <Text className="m-0 mb-2 text-sm font-semibold tracking-wide text-gray-700 uppercase">
                  Refund Processed
                </Text>
                {refundAmount > 0 ? (
                  <Heading className="m-0 mb-3 text-3xl font-bold text-gray-900">
                    {formattedRefund}
                  </Heading>
                ) : null}
                <Text className="m-0 text-sm leading-relaxed text-gray-700">
                  A full refund has been processed to your original payment method. Please allow{' '}
                  <strong>5-10 business days</strong> for the refund to appear in your account.
                </Text>
              </Section>

              {/* Help Section */}
              <Section className="mt-8 rounded-xl bg-gray-50 p-6">
                <Heading className="m-0 mb-2 text-base font-bold text-gray-900">Need Help?</Heading>
                <Text className="m-0 text-sm leading-relaxed text-gray-700">
                  If you believe this denial was made in error or have questions, our support team
                  is ready to assist you at{' '}
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

export default DenialEmail
