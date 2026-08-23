import HomePage from '@/app/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/',
  title: "Get a Doctor's Note for Work or School from the Comfort of Your Home",
  description:
    "Get an official doctor's note for work or school in minutes. Board-certified physicians, HIPAA compliant, valid nationwide. Only $24.95 with money-back guarantee.",
})

export default function SpanishHomePage() {
  return <HomePage locale="es" />
}
