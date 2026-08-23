import VerifySlugPage from '@/app/verify/[slug]/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/verify',
  title: 'Document Verification | Platinum Health Clinic',
  index: false,
})

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SpanishVerifySlugPage(props: { params: Promise<{ slug: string }> }) {
  return <VerifySlugPage {...props} locale="es" />
}
