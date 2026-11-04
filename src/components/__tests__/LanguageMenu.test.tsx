import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { LanguageMenu } from '@/components/i18n/LanguageMenu'

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/review',
}))

function renderMenu() {
  render(
    <I18nProvider>
      <LanguageMenu />
    </I18nProvider>
  )
}

describe('LanguageMenu', () => {
  it('shows the current language and opens a list of every language', async () => {
    const user = userEvent.setup()
    renderMenu()

    const trigger = screen.getByRole('button', { name: 'Idioma: Español' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/review')
    expect(screen.getByRole('link', { name: 'Español' })).toHaveAttribute('aria-current', 'true')
    expect(document.documentElement).toHaveAttribute('lang', 'es-US')
  })

  it('closes the menu and tells the caller when a language is picked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <I18nProvider>
        <LanguageMenu onNavigate={onNavigate} />
      </I18nProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Idioma: Español' }))
    await user.click(screen.getByRole('link', { name: 'Español' }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Idioma: Español' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
