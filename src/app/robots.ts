import { MetadataRoute } from 'next'
import { publicEnv } from '@/lib/public-env'
import { INTAKE_STEPS } from '@/lib/intake'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicEnv.NEXT_PUBLIC_SITE_URL

  const formPages = [...INTAKE_STEPS.map((step) => step.route), '/payment/', '/approved']

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/faq', '/blog', '/privacy-policy', '/terms-of-service'],
        disallow: ['/api/', '/admin/', '/*?', ...formPages],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'anthropic-ai', 'Claude-Web'],
        allow: ['/', '/about', '/faq', '/blog', '/privacy-policy', '/terms-of-service'],
        disallow: ['/api/', '/admin/', '/start', '/*?', ...formPages],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
