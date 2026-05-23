import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { ShieldCheck } from 'lucide-react'
import { VerificationLookupForm } from './VerificationLookupForm'

export const metadata: Metadata = {
  title: "Doctor's Note Verification | Platinum Health",
  description: 'Verify a Platinum Health medical note by Medical Record #.',
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function VerifyPage() {
  noStore()

  return (
    <main className="bg-background min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-7 text-center">
            <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <p className="text-primary mb-3 font-mono text-xs font-semibold uppercase">
              Authentication
            </p>
            <h1 className="text-foreground text-3xl font-semibold">
              Doctor&apos;s Note Verification
            </h1>
            <p className="text-muted-foreground mt-3 text-base leading-7">
              Please enter the medical record number located in the upper right corner of the note.
            </p>
          </div>

          <VerificationLookupForm />
        </section>
      </div>
    </main>
  )
}
