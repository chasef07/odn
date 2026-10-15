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

interface PaymentConfirmationEmailProps {
  patientName: string
  submissionId: string
}

export const PaymentConfirmationEmail = ({
  patientName = 'Patient',
  submissionId = '550E8400',
}: PaymentConfirmationEmailProps) => {
  const currentYear = new Date().getFullYear()
  const shortId = submissionId.toUpperCase().substring(0, 8)

  return (
    <Html>
      <Head />
      <Preview>Payment confirmed - Your doctor&apos;s note request is being reviewed</Preview>
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

              <Text className="mb-8 text-base leading-relaxed text-gray-700">
                Thank you for your payment! Your doctor&apos;s note request has been successfully
                submitted and is now under review by our medical team.
              </Text>

              <Section
                className="mb-8 rounded-2xl bg-white p-6"
                style={{ border: '2px solid #009ed9' }}
              >
                <Text className="m-0 mb-2 text-sm font-semibold tracking-wide text-gray-700 uppercase">
                  Reference Number
                </Text>
                <Heading className="m-0 mb-3 text-2xl font-bold text-gray-900">#{shortId}</Heading>
                <Text className="m-0 text-sm leading-relaxed text-gray-700">
                  Save this reference number for your records. You can use it to contact our support
                  team if needed.
                </Text>
              </Section>

              <Section className="mb-8">
                <Heading className="mb-4 text-xl font-bold text-gray-900">
                  What happens next?
                </Heading>

                <div className="space-y-4">
                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="m-0 text-xl font-bold" style={{ color: '#009ed9' }}>
                        1
                      </Text>
                    </Column>
                    <Column>
                      <Text className="m-0 text-sm text-gray-700">
                        Our medical team will review your request
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="m-0 text-xl font-bold" style={{ color: '#009ed9' }}>
                        2
                      </Text>
                    </Column>
                    <Column>
                      <Text className="m-0 text-sm text-gray-700">
                        If your request is approved, you&apos;ll receive an email notification
                      </Text>
                    </Column>
                  </Row>

                  <Row className="items-start">
                    <Column className="w-8">
                      <Text className="m-0 text-xl font-bold" style={{ color: '#009ed9' }}>
                        3
                      </Text>
                    </Column>
                    <Column>
                      <Text className="m-0 text-sm text-gray-700">
                        Your official doctor&apos;s note PDF will be attached to the approval email
                      </Text>
                    </Column>
                  </Row>
                </div>
              </Section>

              <Hr className="my-8 border-gray-200" />

              <Section className="mt-8 rounded-xl bg-gray-50 p-6">
                <Heading className="m-0 mb-2 text-base font-bold text-gray-900">Need Help?</Heading>
                <Text className="m-0 text-sm leading-relaxed text-gray-700">
                  If you have any questions about your submission or need assistance, our support
                  team is here to help at{' '}
                  <Link
                    href="mailto:hello@onlinedoctornote.com"
                    className="font-medium no-underline"
                    style={{ color: '#009ed9' }}
                  >
                    hello@onlinedoctornote.com
                  </Link>
                  . Please include your reference number (#{shortId}) in any correspondence and
                  refer to the FAQs below for common questions.
                </Text>
              </Section>

              <Section className="mt-6 text-center">
                <Button
                  href="https://onlinedoctornote.com/"
                  className="inline-block rounded-lg px-8 py-3 text-base font-semibold text-white no-underline"
                  style={{ backgroundColor: '#009ed9' }}
                >
                  View FAQs
                </Button>
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

export default PaymentConfirmationEmail
