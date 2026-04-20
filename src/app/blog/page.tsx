import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Blog - Health & Medical Documentation Tips',
  description:
    "Helpful articles about doctor's notes, telehealth, HIPAA compliance, and navigating medical documentation for work and school absences.",
}

const posts = [
  {
    slug: 'when-do-you-need-a-doctors-note',
    title: "When Do You Need a Doctor's Note for Work or School?",
    excerpt:
      'Learn when employers and schools typically require medical documentation for absences and how to handle these situations professionally.',
    date: 'January 15, 2026',
    readTime: '4 min read',
  },
  {
    slug: 'understanding-hipaa-and-your-medical-records',
    title: 'Understanding HIPAA and Your Medical Records',
    excerpt:
      'Your guide to understanding HIPAA regulations, what information is protected, and your rights regarding medical privacy.',
    date: 'January 10, 2026',
    readTime: '5 min read',
  },
  {
    slug: 'telehealth-vs-in-person-visits',
    title: 'Telehealth vs. In-Person Doctor Visits: What You Need to Know',
    excerpt:
      'Compare the benefits of telehealth services with traditional in-person visits and learn when each option makes the most sense.',
    date: 'January 5, 2026',
    readTime: '3 min read',
  },
  {
    slug: 'mental-health-days-at-work',
    title: 'Taking Mental Health Days: A Guide for Employees',
    excerpt:
      'Mental health is just as important as physical health. Learn how to approach taking time off for your mental wellbeing.',
    date: 'December 28, 2025',
    readTime: '4 min read',
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
              Blog
            </h1>
            <p className="text-lg text-gray-600">
              Helpful resources and guides for navigating medical documentation
            </p>
          </div>

          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-300 hover:border-gray-200 hover:shadow-md md:p-8"
              >
                <div className="mb-3 flex items-center gap-3 text-sm text-gray-500">
                  <time>{post.date}</time>
                  <span className="text-gray-300">|</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="mb-3 text-xl font-semibold text-gray-900 transition-colors group-hover:text-[#009ed9] md:text-2xl">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="mb-4 text-gray-600">{post.excerpt}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center text-sm font-medium text-[#009ed9] transition-colors hover:text-[#00b4f5]"
                >
                  Read more
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
