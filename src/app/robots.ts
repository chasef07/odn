import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onlinedoctornote.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/start',
          '/about',
          '/faq',
          '/blog',
          '/privacy-policy',
          '/terms-of-service',
        ],
        disallow: [
          '/api/',
          '/admin/',
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
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/start',
          '/privacy-policy',
          '/terms-of-service',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/get-started',
          '/payment/',
          '/*?',
        ],
      },
      {
        userAgent: 'Bingbot',
        allow: [
          '/',
          '/start',
          '/privacy-policy',
          '/terms-of-service',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/payment/',
        ],
      },
      // Control AI crawlers
      {
        userAgent: 'GPTBot', // ChatGPT crawler
        allow: [
          '/',
          '/privacy-policy',
          '/terms-of-service',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/payment/',
        ],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: [
          '/',
          '/privacy-policy',
          '/terms-of-service',
        ],
        disallow: ['/api/', '/admin/', '/payment/'],
      },
      {
        userAgent: 'anthropic-ai', // Claude crawler
        allow: [
          '/',
          '/privacy-policy',
          '/terms-of-service',
        ],
        disallow: ['/api/', '/admin/', '/payment/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: [
          '/',
          '/privacy-policy',
          '/terms-of-service',
        ],
        disallow: ['/api/', '/admin/', '/payment/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
