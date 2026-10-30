import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { AlertCircle, Check, ShieldCheck } from 'lucide-react'
import { findNoteVerificationBySlug } from '@/db/note-verifications'
import { dateOnlyFromUtcDate, formatDateOnly } from '@/lib/dates'
import { localizePath, translate, translateReactTree, type Locale } from '@/lib/i18n'

type PageProps = {
  params: Promise<{ slug: string }>
  locale?: Locale
}

export const metadata: Metadata = {
  title: 'Document Verification | Platinum Health Clinic',
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getVerification(slug: string) {
  return findNoteVerificationBySlug(slug)
}

function DetailRow({ label, value, locale }: { label: string; value: string; locale: Locale }) {
  return (
    <div className="border-b border-gray-200 px-5 py-4 last:border-b-0">
      <dt className="text-muted-foreground mb-2 font-mono text-xs font-semibold uppercase">
        {translate(locale, label)}
      </dt>
      <dd className="text-foreground text-base font-semibold break-words">{value}</dd>
    </div>
  )
}

function InvalidVerification({ locale }: { locale: Locale }) {
  return translateReactTree(
    <section className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h1 className="text-foreground text-2xl font-semibold">We could not verify this document.</h1>
      <p className="text-muted-foreground mt-3 text-base leading-7">
        Please check the Medical Record # and try again. If you still need help, contact Platinum
        Health Clinic.
      </p>
      <Link
        href={localizePath('/verify', locale)}
        className="bg-primary text-primary-foreground mt-6 inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold"
      >
        Try another record
      </Link>
    </section>,
    locale
  )
}

export default async function VerifySlugPage({ params, locale = 'en' }: PageProps) {
  noStore()

  const { slug } = await params
  const verification = await getVerification(slug)
  const isValid =
    verification &&
    verification.status === 'ACTIVE' &&
    !verification.revokedAt &&
    verification.submission.status === 'APPROVED' &&
    !verification.submission.refundedAt

  const formatDate = (value: Date) => formatDateOnly(dateOnlyFromUtcDate(value), 'long', locale)

  return translateReactTree(
    <main className="bg-background min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {!isValid || !verification ? (
          <InvalidVerification locale={locale} />
        ) : (
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="bg-primary px-6 py-5 text-center text-white">
              <div className="text-primary mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="font-mono text-xl font-semibold tracking-wide uppercase">
                DOCUMENT VERIFICATION
              </h1>
            </div>

            <div className="p-5 sm:p-6">
              <div className="bg-primary/10 mb-6 flex items-center gap-4 rounded-md p-4">
                <span className="bg-primary flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white">
                  <Check className="h-6 w-6" />
                </span>
                <p className="text-foreground text-sm leading-6">
                  Please compare the information below with the document provided to confirm
                  validity.
                </p>
              </div>

              <dl className="overflow-hidden rounded-md border border-gray-200">
                <DetailRow
                  locale={locale}
                  label="Medical Record #"
                  value={verification.medicalRecordNumber}
                />
                <DetailRow
                  locale={locale}
                  label="Patient Initials"
                  value={verification.patientInitials}
                />
                <DetailRow
                  locale={locale}
                  label="Issue Date"
                  value={formatDate(verification.issueDate)}
                />
                <DetailRow
                  locale={locale}
                  label="First Day Off"
                  value={formatDate(verification.firstDayOff)}
                />
                <DetailRow
                  locale={locale}
                  label="Last Day Off"
                  value={formatDate(verification.lastDayOff)}
                />
                <DetailRow
                  locale={locale}
                  label="Return Guidance"
                  value={
                    locale === 'es'
                      ? `Puede regresar después del ${formatDate(verification.lastDayOff)}`
                      : verification.returnGuidance
                  }
                />
                <DetailRow
                  locale={locale}
                  label="Certifying Physician"
                  value={`${verification.physicianName}, ${verification.physicianCredentials}`}
                />
                {verification.licenseState && verification.licenseNumber && (
                  <DetailRow
                    locale={locale}
                    label="State License"
                    value={
                      locale === 'es'
                        ? `Licencia médica de ${verification.licenseState} n.º ${verification.licenseNumber}`
                        : `${verification.licenseState} Medical License #${verification.licenseNumber}`
                    }
                  />
                )}
                {verification.physicianNpi && (
                  <DetailRow locale={locale} label="NPI" value={verification.physicianNpi} />
                )}
              </dl>

              <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm break-words text-gray-600">
                <p>
                  For questions or concerns, please contact us via email at{' '}
                  <a
                    className="text-primary font-medium"
                    href="mailto:hello@platinumhealthclinic.com"
                  >
                    hello@platinumhealthclinic.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>,
    locale
  )
}
