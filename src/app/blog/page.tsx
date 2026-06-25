import type { Metadata } from 'next'
import Script from 'next/script'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Blog - Health & Medical Documentation Tips',
  description:
    "Helpful articles about doctor's notes, telehealth, HIPAA compliance, and navigating medical documentation for work and school absences.",
  alternates: {
    canonical: '/blog',
  },
}

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

          <div id="soro-blog" />
        </div>
      </main>

      <Script
        src="https://app.trysoro.com/api/embed/940b7ab7-7241-4620-a495-71086c109581"
        strategy="afterInteractive"
      />

      <Footer />
    </div>
  )
}
