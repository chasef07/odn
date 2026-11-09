import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'

vi.mock('next/navigation', () => ({
  usePathname: () => '/who-is-using',
}))

function Group({ onSubmit }: { onSubmit: () => void }) {
  const { register, handleSubmit } = useForm<{ recipient: string }>()
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormRadioGroup
        fieldName="recipient"
        legend="Who is using this note?"
        options={[
          { value: 'myself', label: 'Myself' },
          { value: 'someone_else', label: 'Someone else' },
        ]}
        register={register('recipient')}
      />
    </form>
  )
}

describe('FormRadioGroup', () => {
  it('selects the option a pointer taps without submitting the form', async () => {
    const onSubmit = vi.fn()
    render(
      <I18nProvider>
        <Group onSubmit={onSubmit} />
      </I18nProvider>
    )

    await userEvent.setup().click(screen.getByText('Someone else'))

    expect(screen.getByRole('radio', { name: 'Someone else' })).toBeChecked()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
