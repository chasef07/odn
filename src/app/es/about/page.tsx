import AboutPage from '@/app/about/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/about',
  title: 'About Us | OnlineDoctorNote',
  description:
    'Learn about OnlineDoctorNote - our mission, values, and commitment to providing legitimate, doctor-signed medical documentation.',
})

export default function SpanishAboutPage() {
  return <AboutPage locale="es" />
}
