import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import {
  englishAlternates,
  flowMetadata,
  localeFromPathname,
  localizedMetadata,
  localizePath,
  stripLocale,
  switchLocalePath,
  translate,
  translateReactTree,
} from '@/lib/i18n'

describe('Spanish localization primitives', () => {
  it('routes English and Spanish without changing the default route', () => {
    expect(localeFromPathname('/')).toBe('en')
    expect(localeFromPathname('/es/review')).toBe('es')
    expect(localizePath('/review', 'es')).toBe('/es/review')
    expect(localizePath('/api/create-payment-intent', 'es')).toBe('/api/create-payment-intent')
    expect(localizePath('/review?offer=SAVE#terms', 'es')).toBe('/es/review?offer=SAVE#terms')
    expect(stripLocale('/es/payment/success')).toBe('/payment/success')
    expect(switchLocalePath('/es/faq', 'en')).toBe('/faq')
  })

  it('falls back safely to English when a Spanish string is missing', () => {
    expect(translate('es', 'Deliberately missing test string')).toBe(
      'Deliberately missing test string'
    )
  })

  it('contains critical Spanish purchase-flow and validation copy', () => {
    expect(translate('es', 'Request My Note')).toBe('Solicitar mi nota')
    expect(translate('es', 'Continue to Payment')).toBe('Continuar al pago')
    expect(translate('es', 'Payment Successful')).toBe('Pago realizado correctamente')
    expect(translate('es', 'Please select your state')).toBe('Seleccione su estado')
    expect(translate('es', 'Legal matters are not eligible')).toBe(
      'Los asuntos legales no son elegibles'
    )
  })

  it('translates presentation while preserving form and payment contract values', () => {
    const tree = translateReactTree(
      <form action="/api/create-payment-intent">
        <input name="notePurpose" value="work" readOnly />
        <a href="/payment">Pay Now</a>
      </form>,
      'es'
    )

    expect(isValidElement(tree)).toBe(true)
    const form = tree as React.ReactElement<{
      action: string
      children: React.ReactElement<{ href?: string; children?: unknown }>[]
    }>
    const [input, link] = form.props.children
    expect(form.props.action).toBe('/api/create-payment-intent')
    expect(input.props).toMatchObject({ name: 'notePurpose', value: 'work' })
    expect(link.props.href).toBe('/es/payment')
    expect(link.props.children).toBe('Pagar ahora')
  })

  it('emits reciprocal hreflang and Spanish canonical metadata', () => {
    expect(englishAlternates('/faq')).toEqual({
      canonical: '/faq',
      languages: { 'en-US': '/faq', 'es-US': '/es/faq', 'x-default': '/faq' },
    })

    const metadata = localizedMetadata({
      path: '/faq',
      title: 'FAQ - Frequently Asked Questions',
      description: 'Everything you need to know about our service',
    })
    expect(metadata.alternates).toEqual({
      canonical: '/es/faq',
      languages: { 'en-US': '/faq', 'es-US': '/es/faq', 'x-default': '/faq' },
    })
    expect(metadata.openGraph).toMatchObject({ locale: 'es_US', url: '/es/faq' })

    const spanishFlowMetadata = localizedMetadata({
      path: '/review',
      title: 'Review',
      index: false,
    })
    expect(spanishFlowMetadata.alternates).toMatchObject({ canonical: '/es/review' })
    expect(spanishFlowMetadata.robots).toEqual({ index: false, follow: false })
  })

  it('builds noindex English intake-flow metadata', () => {
    expect(flowMetadata('/review', 'Review')).toEqual({
      title: 'Review',
      alternates: englishAlternates('/review'),
      robots: { index: false, follow: false },
    })
    expect(flowMetadata('/start')).not.toHaveProperty('title')
  })

  it('includes reciprocal English and Spanish entries in the sitemap', () => {
    const entries = sitemap()
    const englishFaq = entries.find((entry) => entry.url.endsWith('/faq'))
    const spanishFaq = entries.find((entry) => entry.url.endsWith('/es/faq'))

    expect(entries).toHaveLength(12)
    expect(englishFaq?.alternates?.languages?.['es-US']).toContain('/es/faq')
    expect(spanishFaq?.alternates?.languages?.['en-US']).toContain('/faq')
  })
})
