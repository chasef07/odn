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
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'
import * as React from 'react'
import { DEFAULT_MAYBE_REASON, getMaybeReasonConfig, type MaybeReason } from '@/lib/maybe-reasons'

interface MaybeEmailProps {
  patientName: string
  reason: MaybeReason
}

export const MaybeEmail = ({
  patientName = 'Patient',
  reason = DEFAULT_MAYBE_REASON,
}: MaybeEmailProps) => {
  const reasonConfig = getMaybeReasonConfig(reason) ?? getMaybeReasonConfig(DEFAULT_MAYBE_REASON)
  const currentYear = new Date().getFullYear()
  const messageParagraphs = reasonConfig?.emailMessage.split('\n\n') ?? []

  return (
    <Html>
      <Head />
      <Preview>Your doctor&apos;s note request is under review</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-2xl">
            <Section className="rounded-t-2xl border-b border-gray-200 bg-white px-8 py-4">
              <Text className="m-0 text-2xl font-bold" style={{ color: '#009ed9' }}>
                OnlineDoctorNote
              </Text>
            </Section>

            <Section className="bg-white px-8 py-8">
              <Text className="mb-6 text-base leading-relaxed text-gray-900">
                Hi <strong>{patientName}</strong>,
              </Text>

              <Section
                className="my-8 rounded-2xl bg-white p-6"
                style={{ border: '2px solid #009ed9' }}
              >
                <Text className="m-0 mb-2 text-sm font-semibold tracking-wide text-gray-700 uppercase">
                  Review Update
                </Text>
                <Heading className="m-0 mb-3 text-xl font-bold text-gray-900">
                  Additional review needed
                </Heading>
                {messageParagraphs.map((paragraph, index) => (
                  <Text
                    key={paragraph}
                    className={`text-base leading-relaxed text-gray-700 ${
                      index === messageParagraphs.length - 1 ? 'm-0' : 'm-0 mb-4'
                    }`}
                  >
                    {paragraph}
                  </Text>
                ))}
              </Section>

              <Text className="mb-6 text-base leading-relaxed text-gray-700">
                Thank you,
                <br />
                Platinum Health
              </Text>

              <Hr className="my-8 border-gray-200" />

              <Section className="mt-8 rounded-xl bg-gray-50 p-6">
                <Heading className="m-0 mb-2 text-base font-bold text-gray-900">Need Help?</Heading>
                <Text className="m-0 text-sm leading-relaxed text-gray-700">
                  If you have questions, our support team is ready to assist you at{' '}
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

export default MaybeEmail
