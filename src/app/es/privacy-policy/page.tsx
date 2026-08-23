import PrivacyPolicyPage from '@/app/privacy-policy/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/privacy-policy',
  title: 'Privacy Policy',
  description:
    'OnlineDoctorNote privacy policy. Learn how we protect your personal health information and comply with HIPAA regulations.',
})

export default function SpanishPrivacyPolicyPage() {
  return <PrivacyPolicyPage locale="es" />
}
