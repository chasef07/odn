import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'

interface BounceAlertEmailProps {
  bouncedEmail: string
  bounceReason: string
  emailType: 'approval' | 'denial' | 'payment_confirmation' | 'follow_up' | 'unknown'
  patientFirstName?: string
  patientLastName?: string
  patientPhone?: string
  submissionId?: string
  submissionStatus?: string
}

export const BounceAlertEmail = ({
  bouncedEmail,
  emailType,
  patientFirstName,
  patientLastName,
  patientPhone,
  submissionId,
}: BounceAlertEmailProps) => {
  const currentYear = new Date().getFullYear()
  const hasSubmission = !!(patientFirstName && patientLastName)
  const patientName = hasSubmission ? `${patientFirstName} ${patientLastName}` : 'Unknown'

  const emailTypeNames = {
    approval: 'Approval Email',
    denial: 'Denial Email',
    payment_confirmation: 'Payment Confirmation Email',
    follow_up: 'Note Follow-up Email',
    unknown: 'Unknown Email Type',
  }

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
            <Section className="rounded-t-2xl border-b-2 border-red-600 bg-white px-8 py-4">
              <Text className="m-0 text-2xl font-bold" style={{ color: '#dc2626' }}>
                OnlineDoctorNote
              </Text>
            </Section>

            <Section className="bg-white px-8 py-8">
              <Text className="mb-6 text-base leading-relaxed text-gray-900">Hi Jason,</Text>

              <Text className="mb-6 text-base leading-relaxed text-gray-900">
                An email has just bounced for{' '}
                <strong>{hasSubmission ? patientName : 'a patient'}</strong>.
              </Text>

              {hasSubmission ? (
                <>
                  <Text className="mb-2 text-base leading-relaxed text-gray-900">
                    <strong>Bounced Email:</strong>{' '}
                    <span className="font-mono" style={{ color: '#dc2626' }}>
                      {bouncedEmail}
                    </span>
                  </Text>

                  <Text className="mb-2 text-base leading-relaxed text-gray-900">
                    <strong>Email Type:</strong> {emailTypeNames[emailType]}
                  </Text>

                  <Text className="mb-6 text-base leading-relaxed text-gray-900">
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

                  <Text className="mb-6 text-base leading-relaxed text-gray-900">
                    Please put this person on the maybe portal and update their information when it
                    comes in.
                  </Text>

                  <Hr className="my-6 border-gray-200" />

                  <Section className="rounded-xl bg-gray-50 p-6">
                    <Text className="m-0 mb-3 text-sm text-gray-700">
                      <strong>View in Admin Portal:</strong>
                    </Text>
                    <Link
                      href={adminLink}
                      className="inline-block rounded-lg px-6 py-3 text-sm font-semibold text-white no-underline"
                      style={{ backgroundColor: '#009ed9' }}
                    >
                      View Submission Details
                    </Link>
                  </Section>
                </>
              ) : (
                <>
                  <Text className="mb-2 text-base leading-relaxed text-gray-900">
                    <strong>Bounced Email:</strong>{' '}
                    <span className="font-mono" style={{ color: '#dc2626' }}>
                      {bouncedEmail}
                    </span>
                  </Text>

                  <Text className="mb-2 text-base leading-relaxed text-gray-900">
                    <strong>Email Type:</strong> {emailTypeNames[emailType]}
                  </Text>

                  <Text className="mb-6 text-base leading-relaxed text-gray-900">
                    No submission was found in the database for this email address. This may be a
                    test email or the submission was deleted.
                  </Text>
                </>
              )}
            </Section>

            <Section className="rounded-b-2xl bg-gray-100 px-8 py-6">
              <Text className="m-0 text-center text-xs leading-relaxed text-gray-600">
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
