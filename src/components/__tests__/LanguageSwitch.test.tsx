import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { LanguageSwitch } from '@/components/i18n/LanguageSwitch'

let pathname = '/about'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

describe('LanguageSwitch', () => {
  beforeEach(() => {
    pathname = '/about'
  })

  it('offers the equivalent Spanish route from English', () => {
    render(
      <I18nProvider>
        <LanguageSwitch />
      </I18nProvider>
    )

    expect(screen.getByRole('link', { name: 'Switch site to Spanish' })).toHaveAttribute(
      'href',
      '/es/about'
    )
    expect(screen.getByText('Español')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'en-US')
  })

  it('offers the equivalent English route from Spanish', () => {
    pathname = '/es/review'
    render(
      <I18nProvider>
        <LanguageSwitch />
      </I18nProvider>
    )

    expect(screen.getByRole('link', { name: 'Cambiar el sitio a inglés' })).toHaveAttribute(
      'href',
      '/review'
    )
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'es-US')
  })
})
