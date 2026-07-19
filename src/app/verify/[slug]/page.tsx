import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { AlertCircle, Check, ShieldCheck } from 'lucide-react'
import prisma from '@/lib/prisma'
import { formatDisplayDate } from '@/lib/note-verification'

type PageProps = {
  params: Promise<{ slug: string }>
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
  return prisma.noteVerification.findUnique({
    where: { verificationSlug: slug },
    select: {
      medicalRecordNumber: true,
      status: true,
      revokedAt: true,
      issueDate: true,
      patientInitials: true,
      firstDayOff: true,
      lastDayOff: true,
      returnGuidance: true,
      physicianName: true,
      physicianCredentials: true,
      physicianNpi: true,
      licenseState: true,
      licenseNumber: true,
      submission: {
        select: {
          status: true,
          refundedAt: true,
        },
      },
    },
  })
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-gray-200 px-5 py-4 last:border-b-0">
      <dt className="text-muted-foreground mb-2 font-mono text-xs font-semibold uppercase">
        {label}
      </dt>
      <dd className="text-foreground text-base font-semibold break-words">{value}</dd>
    </div>
  )
}

function InvalidVerification() {
  return (
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
        href="/verify"
        className="bg-primary text-primary-foreground mt-6 inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold"
      >
        Try another record
      </Link>
    </section>
  )
}

export default async function VerifySlugPage({ params }: PageProps) {
  noStore()

  const { slug } = await params
  const verification = await getVerification(slug)
  const isValid =
    verification &&
    verification.status === 'ACTIVE' &&
    !verification.revokedAt &&
    verification.submission.status === 'APPROVED' &&
    !verification.submission.refundedAt

  return (
    <main className="bg-background min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {!isValid || !verification ? (
          <InvalidVerification />
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
                <DetailRow label="Medical Record #" value={verification.medicalRecordNumber} />
                <DetailRow label="Patient Initials" value={verification.patientInitials} />
                <DetailRow label="Issue Date" value={formatDisplayDate(verification.issueDate)} />
                <DetailRow
                  label="First Day Off"
                  value={formatDisplayDate(verification.firstDayOff)}
                />
                <DetailRow
                  label="Last Day Off"
                  value={formatDisplayDate(verification.lastDayOff)}
                />
                <DetailRow label="Return Guidance" value={verification.returnGuidance} />
                <DetailRow
                  label="Certifying Physician"
                  value={`${verification.physicianName}, ${verification.physicianCredentials}`}
                />
                {verification.licenseState && verification.licenseNumber && (
                  <DetailRow
                    label="State License"
                    value={`${verification.licenseState} Medical License #${verification.licenseNumber}`}
                  />
                )}
                {verification.physicianNpi && (
                  <DetailRow label="NPI" value={verification.physicianNpi} />
                )}
              </dl>

              <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
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
    </main>
  )
}
