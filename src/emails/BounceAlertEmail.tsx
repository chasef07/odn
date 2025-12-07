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
  Row,
  Column,
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'
import * as React from 'react'

interface BounceAlertEmailProps {
  bouncedEmail: string
  bounceReason: string
  emailType: 'approval' | 'denial' | 'payment_confirmation' | 'unknown'
  patientFirstName?: string
  patientLastName?: string
  patientPhone?: string
  submissionId?: string
  submissionStatus?: string
}

export const BounceAlertEmail = ({
  bouncedEmail,
  bounceReason,
  emailType,
  patientFirstName,
  patientLastName,
  patientPhone,
  submissionId,
  submissionStatus,
}: BounceAlertEmailProps) => {
  const currentYear = new Date().getFullYear()
  const hasSubmission = !!(patientFirstName && patientLastName)
  const patientName = hasSubmission ? `${patientFirstName} ${patientLastName}` : 'Unknown'

  // Map email type to human-readable names
  const emailTypeNames = {
    approval: 'Approval Email',
    denial: 'Denial Email',
    payment_confirmation: 'Payment Confirmation Email',
    unknown: 'Unknown Email Type',
  }

  // Admin portal link
  const adminLink = submissionId
    ? `https://onlinedoctornote.com/admin/review?id=${submissionId}`
    : 'https://onlinedoctornote.com/admin'

  return (
    <Html>
      <Head />
      <Preview>Email Bounce Alert: {patientName}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-2xl">
            {/* Header */}
            <Section className="bg-white px-8 py-4 rounded-t-2xl border-b-2 border-red-600">
              <Text className="text-2xl font-bold m-0" style={{ color: '#dc2626' }}>
                OnlineDoctorNote
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="bg-white px-8 py-8">
              <Text className="text-gray-900 text-base leading-relaxed mb-6">
                Hi Jason,
              </Text>

              <Text className="text-gray-900 text-base leading-relaxed mb-6">
                An email has just bounced for{' '}
                <strong>{hasSubmission ? patientName : 'a patient'}</strong>.
              </Text>

              {hasSubmission ? (
                <>
                  <Text className="text-gray-900 text-base leading-relaxed mb-2">
                    <strong>Bounced Email:</strong>{' '}
                    <span className="font-mono" style={{ color: '#dc2626' }}>
                      {bouncedEmail}
                    </span>
                  </Text>

                  <Text className="text-gray-900 text-base leading-relaxed mb-6">
                    This email is wrong. Please reach out to{' '}
                    <Link
                      href={`tel:${patientPhone}`}
                      className="font-medium no-underline"
                      style={{ color: '#009ed9' }}
                    >
                      {patientPhone}
                    </Link>{' '}
                    to get the correct email address.
                  </Text>

                  <Text className="text-gray-900 text-base leading-relaxed mb-6">
                    Please put this person on the maybe portal and update their information when
                    it comes in.
                  </Text>

                  <Hr className="border-gray-200 my-6" />

                  {/* Admin Portal Link */}
                  <Section className="bg-gray-50 rounded-xl p-6">
                    <Text className="text-gray-700 text-sm m-0 mb-3">
                      <strong>View in Admin Portal:</strong>
                    </Text>
                    <Link
                      href={adminLink}
                      className="inline-block px-6 py-3 text-white text-sm font-semibold rounded-lg no-underline"
                      style={{ backgroundColor: '#009ed9' }}
                    >
                      View Submission Details
                    </Link>
                  </Section>
                </>
              ) : (
                <>
                  <Text className="text-gray-900 text-base leading-relaxed mb-2">
                    <strong>Bounced Email:</strong>{' '}
                    <span className="font-mono" style={{ color: '#dc2626' }}>
                      {bouncedEmail}
                    </span>
                  </Text>

                  <Text className="text-gray-900 text-base leading-relaxed mb-6">
                    No submission was found in the database for this email address. This may be a
                    test email or the submission was deleted.
                  </Text>
                </>
              )}
            </Section>

            {/* Footer */}
            <Section className="bg-gray-100 px-8 py-6 rounded-b-2xl">
              <Text className="text-gray-600 text-xs text-center leading-relaxed m-0">
                © {currentYear} Online Doctor&apos;s Note
                <br />
                Automated alert from the email bounce system
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default BounceAlertEmail
