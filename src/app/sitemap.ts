import { MetadataRoute } from 'next'
import { publicEnv } from '@/lib/public-env'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = publicEnv.NEXT_PUBLIC_SITE_URL
  const currentDate = new Date()

  const pages = [
    { path: '', changeFrequency: 'daily' as const, priority: 1.0 },
    { path: '/about', changeFrequency: 'monthly' as const, priority: 0.9 },
    { path: '/faq', changeFrequency: 'weekly' as const, priority: 0.8 },
    { path: '/blog', changeFrequency: 'weekly' as const, priority: 0.7 },
    { path: '/privacy-policy', changeFrequency: 'monthly' as const, priority: 0.5 },
    { path: '/terms-of-service', changeFrequency: 'monthly' as const, priority: 0.5 },
  ]

  return pages.flatMap(({ path, changeFrequency, priority }) => {
    const englishUrl = `${baseUrl}${path}`
    const spanishUrl = `${baseUrl}/es${path}`
    const languages = { 'en-US': englishUrl, 'es-US': spanishUrl, 'x-default': englishUrl }

    return [
      {
        url: englishUrl,
        lastModified: currentDate,
        changeFrequency,
        priority,
        alternates: { languages },
      },
      {
        url: spanishUrl,
        lastModified: currentDate,
        changeFrequency,
        priority,
        alternates: { languages },
      },
    ]
  }) satisfies MetadataRoute.Sitemap
}
