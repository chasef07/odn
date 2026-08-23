import FAQPage from '@/app/faq/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/faq',
  title: 'FAQ - Frequently Asked Questions',
  description:
    "Get answers to common questions about online doctor's notes. Learn about our service, pricing, delivery time, and money-back guarantee.",
})

export default function SpanishFAQPage() {
  return <FAQPage locale="es" />
}
