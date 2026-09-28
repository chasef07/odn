import React from 'react'
import type { Metadata } from 'next'
import { spanishTranslations } from '@/locales/es'

export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]

export function localeFromPathname(pathname: string): Locale {
  return pathname === '/es' || pathname.startsWith('/es/') ? 'es' : 'en'
}

export function stripLocale(pathname: string): string {
  if (pathname === '/es') return '/'
  return pathname.startsWith('/es/') ? pathname.slice(3) || '/' : pathname
}

export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/api/')) return path

  const [pathnameAndQuery, hash = ''] = path.split('#', 2)
  const [pathname, query = ''] = pathnameAndQuery.split('?', 2)
  const unlocalized = stripLocale(pathname)
  const localized =
    locale === 'es' ? (unlocalized === '/' ? '/es' : `/es${unlocalized}`) : unlocalized
  return `${localized}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}

export function switchLocalePath(pathname: string, locale: Locale): string {
  return localizePath(stripLocale(pathname), locale)
}

export function translate(locale: Locale, english: string): string {
  if (locale === 'en') return english

  const emailSuggestion = english.match(
    /^Did you mean "([^"]+)"\? Please check your email address\.$/
  )
  if (emailSuggestion) {
    return `¿Quiso decir "${emailSuggestion[1]}"? Revise su dirección de correo electrónico.`
  }

  const requiredName = english.match(/^(First name|Last name) is required$/)
  if (requiredName) {
    return `${requiredName[1] === 'First name' ? 'El nombre' : 'El apellido'} es obligatorio`
  }

  const nameLength = english.match(/^(First name|Last name) must be less than (\d+) characters$/)
  if (nameLength) {
    return `${nameLength[1] === 'First name' ? 'El nombre' : 'El apellido'} debe tener menos de ${nameLength[2]} caracteres`
  }

  const nameSpaces = english.match(/^(First name|Last name) cannot be only spaces$/)
  if (nameSpaces) {
    return `${nameSpaces[1] === 'First name' ? 'El nombre' : 'El apellido'} no puede contener solo espacios`
  }

  const pastDays = english.match(/^First day off cannot be more than (\d+) days in the past$/)
  if (pastDays) return `El primer día de ausencia no puede ser hace más de ${pastDays[1]} días`

  const consecutiveDays = english.match(/^Absence period cannot exceed (\d+) consecutive days$/)
  if (consecutiveDays) {
    return `El período de ausencia no puede superar ${consecutiveDays[1]} días consecutivos`
  }

  return spanishTranslations[english] || english
}

export function translateTextNode(locale: Locale, value: string): string {
  if (locale === 'en' || !value.trim()) return value
  const leading = value.match(/^\s*/)?.[0] || ''
  const trailing = value.match(/\s*$/)?.[0] || ''
  const english = value.trim().replace(/\s+/g, ' ')
  return `${leading}${translate(locale, english)}${trailing}`
}

const translatedProps = new Set(['alt', 'aria-label', 'placeholder', 'title'])

export function translateReactTree(node: React.ReactNode, locale: Locale): React.ReactNode {
  if (locale === 'en' || node === null || node === undefined || typeof node === 'boolean')
    return node
  if (typeof node === 'string') return translateTextNode(locale, node)
  if (typeof node === 'number') return node
  if (Array.isArray(node)) {
    return React.Children.map(node, (child, index) => {
      const translatedChild = translateReactTree(child, locale)
      if (React.isValidElement(translatedChild) && translatedChild.key === null) {
        return React.cloneElement(translatedChild, { key: `i18n-${index}` })
      }
      return translatedChild
    })
  }
  if (!React.isValidElement<Record<string, unknown>>(node)) return node

  const props: Record<string, unknown> = { ...node.props }
  for (const propName of translatedProps) {
    if (typeof props[propName] === 'string') {
      props[propName] = translate(locale, props[propName])
    }
  }
  if (typeof props.href === 'string') props.href = localizePath(props.href, locale)
  if ('children' in props)
    props.children = translateReactTree(props.children as React.ReactNode, locale)

  return React.cloneElement(node, props)
}

type LocalizedMetadataInput = {
  path: string
  title: string
  description?: string
  index?: boolean
}

export function localizedMetadata({
  path,
  title,
  description,
  index = true,
}: LocalizedMetadataInput): Metadata {
  const canonicalPath = stripLocale(path)
  const spanishPath = localizePath(canonicalPath, 'es')
  return {
    title: translate('es', title),
    description: description ? translate('es', description) : undefined,
    alternates: {
      canonical: spanishPath,
      languages: {
        'en-US': canonicalPath,
        'es-US': spanishPath,
        'x-default': canonicalPath,
      },
    },
    openGraph: {
      locale: 'es_US',
      alternateLocale: ['en_US'],
      url: spanishPath,
      title: translate('es', title),
      description: description ? translate('es', description) : undefined,
    },
    robots: index ? undefined : { index: false, follow: false },
  }
}

export function englishAlternates(path: string): Metadata['alternates'] {
  const canonicalPath = stripLocale(path)
  return {
    canonical: canonicalPath,
    languages: {
      'en-US': canonicalPath,
      'es-US': localizePath(canonicalPath, 'es'),
      'x-default': canonicalPath,
    },
  }
}

export function flowMetadata(path: string, title?: string): Metadata {
  return {
    ...(title ? { title } : {}),
    alternates: englishAlternates(path),
    robots: { index: false, follow: false },
  }
}

export function FlowLayout({ children }: { children: React.ReactNode }) {
  return children
}
