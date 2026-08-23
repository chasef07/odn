import TermsOfServicePage from '@/app/terms-of-service/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/terms-of-service',
  title: 'Terms of Service',
  description:
    'OnlineDoctorNote terms of service. Read our terms and conditions for using our online medical documentation service.',
})

export default function SpanishTermsPage() {
  return <TermsOfServicePage locale="es" />
}
