import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import BasicInfoPage from '@/app/basic-info/page'
import ContactInfoPage from '@/app/contact-info/page'
import { GetStartedForm } from '@/app/get-started/GetStartedForm'
import GuardianInfoPage from '@/app/guardian-info/page'
import { I18nProvider } from '@/components/i18n/I18nProvider'

vi.mock('next/navigation', () => ({
  usePathname: () => '/basic-info',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

function renderWithDraft(page: ReactNode, draft: Record<string, unknown>) {
  ;(localStorage.getItem as Mock).mockImplementation((key: string) =>
    key === 'doctor-note-form-draft' ? JSON.stringify(draft) : null
  )
  render(<I18nProvider>{page}</I18nProvider>)
}

function autocompleteOf(id: string) {
  return document.getElementById(id)?.getAttribute('autocomplete')
}

function dateOfBirthAutocomplete(name: string) {
  return ['month', 'day', 'year'].map((part) => autocompleteOf(`${name}-${part}`))
}

describe('intake autofill hints', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  })

  it('offers the visitor their own name and birthday when the note is for them', () => {
    renderWithDraft(<BasicInfoPage />, { recipient: 'myself' })

    expect(autocompleteOf('patientFirstName')).toBe('given-name')
    expect(autocompleteOf('patientLastName')).toBe('family-name')
    expect(dateOfBirthAutocomplete('patientDateOfBirth')).toEqual([
      'bday-month',
      'bday-day',
      'bday-year',
    ])
  })

  it('does not offer the visitor their own details for someone else', () => {
    renderWithDraft(<BasicInfoPage />, { recipient: 'someone_else' })

    expect(autocompleteOf('patientFirstName')).toBe('off')
    expect(autocompleteOf('patientLastName')).toBe('off')
    expect(dateOfBirthAutocomplete('patientDateOfBirth')).toEqual(['off', 'off', 'off'])
  })

  it('offers the guardian their own name', () => {
    renderWithDraft(<GuardianInfoPage />, { recipient: 'someone_else' })

    expect(autocompleteOf('guardianFirstName')).toBe('given-name')
    expect(autocompleteOf('guardianLastName')).toBe('family-name')
  })

  it('offers email, phone and state', () => {
    renderWithDraft(<ContactInfoPage />, {})
    expect(autocompleteOf('email')).toBe('email')
    expect(autocompleteOf('phone')).toBe('tel')

    renderWithDraft(<GetStartedForm detectedState={null} />, {})
    expect(screen.getByRole('combobox')).toHaveAttribute('autocomplete', 'address-level1')
  })
})
