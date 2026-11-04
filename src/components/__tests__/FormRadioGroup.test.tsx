import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'

vi.mock('next/navigation', () => ({
  usePathname: () => '/who-is-using',
}))

function Group({ onPick }: { onPick: (value: string) => void }) {
  const { register } = useForm<{ recipient: string }>()
  return (
    <FormRadioGroup
      fieldName="recipient"
      legend="Who is using this note?"
      options={[
        { value: 'myself', label: 'Myself' },
        { value: 'someone_else', label: 'Someone else' },
      ]}
      register={register('recipient')}
      onPick={onPick}
    />
  )
}

function renderGroup(onPick: (value: string) => void) {
  render(
    <I18nProvider>
      <Group onPick={onPick} />
    </I18nProvider>
  )
}

describe('FormRadioGroup', () => {
  it('picks the option a pointer taps', async () => {
    const onPick = vi.fn()
    renderGroup(onPick)

    await userEvent.setup().click(screen.getByText('Someone else'))

    expect(screen.getByRole('radio', { name: 'Someone else' })).toBeChecked()
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('someone_else'))
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('selects without picking when the radio itself is activated, as the keyboard does', async () => {
    const onPick = vi.fn()
    renderGroup(onPick)

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Myself' }))

    expect(screen.getByRole('radio', { name: 'Myself' })).toBeChecked()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(onPick).not.toHaveBeenCalled()
  })
})
