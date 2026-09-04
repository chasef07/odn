import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'
import * as React from 'react'
import { getRecipientName } from '@/lib/email-helpers'
import { DOCTOR_10_OFFER_CODE, OFFER_QUERY_PARAM } from '@/lib/offer-codes'

interface FollowUpEmailProps {
  patientName: string
  notePurpose: string
}

const QR_RELEVANT_PURPOSES = new Set(['work', 'school', 'both'])
const THANK_YOU_OFFER_URL = `https://onlinedoctornote.com/start/?${OFFER_QUERY_PARAM}=${DOCTOR_10_OFFER_CODE}`

export const FollowUpEmail = ({
  patientName = 'Patient',
  notePurpose = 'work',
}: FollowUpEmailProps) => {
  const currentYear = new Date().getFullYear()
  const shouldMentionQrVerification = QR_RELEVANT_PURPOSES.has(notePurpose)

  return (
    <Html>
      <Head />
      <Preview>A thank-you discount from OnlineDoctorNote</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto my-8 max-w-2xl overflow-hidden rounded-2xl bg-white">
            <Section className="border-b border-gray-200 bg-white px-8 py-5">
              <Text className="m-0 text-2xl font-bold" style={{ color: '#009ed9' }}>
                OnlineDoctorNote.com
              </Text>
            </Section>

            <Section className="px-8 py-10" style={{ backgroundColor: '#08a7df' }}>
              <Heading className="m-0 mb-3 text-4xl leading-tight font-bold text-white">
                Need another doctor&apos;s note?
              </Heading>
              <Text className="m-0 mb-6 text-lg leading-relaxed text-white">
                Fast, convenient and affordable.
                <br />
                100% online. No video visit required.
              </Text>
              <Button
                href={THANK_YOU_OFFER_URL}
                className="inline-block rounded-full bg-white px-7 py-3 text-base font-semibold no-underline"
                style={{ color: '#009ed9' }}
              >
                Use Your Thank-You Discount →
              </Button>
            </Section>

            <Section className="px-8 py-8">
              <Text className="mb-6 text-base leading-relaxed text-gray-900">
                Hi <strong>{patientName}</strong>,
              </Text>

              <Text className="mb-5 text-base leading-relaxed text-gray-700">
                Thank you again for using OnlineDoctorNote.com. We&apos;re grateful that you trusted
                us to help make the process a little easier.
              </Text>

              <Section className="mb-6 rounded-xl bg-gray-50 p-6">
                <Heading className="m-0 mb-2 text-lg font-bold text-gray-900">
                  Need help or a correction?
                </Heading>
                <Text className="m-0 text-sm leading-relaxed text-gray-700">
                  If anything on your current note needs to be corrected, or if you have a question
                  about it, reply to this email or contact us at{' '}
                  <Link
                    href="mailto:hello@onlinedoctornote.com"
                    className="font-medium no-underline"
                    style={{ color: '#009ed9' }}
                  >
                    hello@onlinedoctornote.com
                  </Link>
                  .
                </Text>
              </Section>

              {shouldMentionQrVerification ? (
                <Text className="mb-6 text-sm leading-relaxed text-gray-700">
                  If your {getRecipientName(notePurpose)} needs to verify your current note, ask
                  them to scan the QR code printed on it.
                </Text>
              ) : null}

              <Section
                className="mb-6 rounded-2xl p-7 text-center"
                style={{ background: '#ecfaff' }}
              >
                <Text className="m-0 mb-2 text-3xl">🎁</Text>
                <Heading className="m-0 mb-2 text-xl font-bold text-gray-900">
                  Thank you for being a valued patient.
                </Heading>
                <Text className="m-0 mb-5 text-base leading-relaxed text-gray-700">
                  Use your special link below to receive{' '}
                  <strong style={{ color: '#009ed9' }}>10% off</strong> your next note.
                </Text>
                <Button
                  href={THANK_YOU_OFFER_URL}
                  className="inline-block rounded-full px-8 py-3 text-base font-semibold text-white no-underline"
                  style={{ backgroundColor: '#009ed9' }}
                >
                  Get Your 10% Off →
                </Button>
                <Text className="mt-5 mb-0 text-sm leading-relaxed text-gray-700">
                  Your discount can also be shared with and used by friends and family. The discount
                  will be applied automatically at checkout.
                </Text>
              </Section>

              <Section className="mb-8 rounded-xl bg-gray-50 px-5 py-4 text-center">
                <Text className="m-0 text-sm font-medium text-gray-700">
                  No appointments &nbsp;•&nbsp; No waiting rooms &nbsp;•&nbsp; No hassle
                </Text>
              </Section>

              <Text className="mb-0 text-base leading-relaxed text-gray-700">
                If you ever need us again, we&apos;ll be here.
                <br />
                <br />
                Thank you for your trust and support.
                <br />
                <br />
                Best regards,
                <br />
                <strong>The OnlineDoctorNote.com Team</strong>
              </Text>
            </Section>

            <Section className="px-8 py-7" style={{ backgroundColor: '#121e32' }}>
              <Text className="m-0 mb-4 text-xl font-bold" style={{ color: '#08a7df' }}>
                OnlineDoctorNote.com
              </Text>
              <Text className="m-0 mb-5 text-sm text-white">
                Convenient. Affordable. Available when you need us.
              </Text>
              <Text className="m-0 mb-5 text-sm text-white">
                Questions? Email us at{' '}
                <Link href="mailto:hello@onlinedoctornote.com" className="text-white underline">
                  hello@onlinedoctornote.com
                </Link>
              </Text>
              <Text className="m-0 text-xs leading-relaxed text-gray-300">
                © {currentYear} ODN LLC. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default FollowUpEmail
