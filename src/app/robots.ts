import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onlinedoctornote.com'

  const formPages = [
    '/get-started',
    '/basic-info',
    '/guardian-info',
    '/contact-info',
    '/note-purpose',
    '/absence-dates',
    '/absence-reason',
    '/symptoms',
    '/additional-info',
    '/review',
    '/payment/',
    '/approved',
    '/who-is-using',
  ]

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
