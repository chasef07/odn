import BlogPage from '@/app/blog/page'
import { localizedMetadata } from '@/lib/i18n'

export const metadata = localizedMetadata({
  path: '/blog',
  title: 'Blog - Health & Medical Documentation Tips',
  description:
    "Helpful articles about doctor's notes, telehealth, HIPAA compliance, and navigating medical documentation for work and school absences.",
})

export default function SpanishBlogPage() {
  return <BlogPage locale="es" />
}
