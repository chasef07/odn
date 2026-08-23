import VerifyPage from '@/app/verify/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/verify',
  title: "Doctor's Note Verification | Platinum Health Clinic",
  description: 'Verify a Platinum Health Clinic medical note by Medical Record #.',
  index: false,
})

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SpanishVerifyPage() {
  return <VerifyPage locale="es" />
}
