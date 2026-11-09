import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import { FormProgress } from '@/components/form-progress'
import { FUNNEL_VISITOR_KEY, useFunnelStep } from '@/components/useFunnelStep'

const storedVisitorId = '6f1c2a8e-4b7d-4c3a-9e2f-1a2b3c4d5e6f'

function withStorage(draft: Record<string, unknown>, visitorId: string | null = null) {
  ;(localStorage.getItem as Mock).mockImplementation((key: string) =>
    key === FUNNEL_VISITOR_KEY ? visitorId : JSON.stringify(draft)
  )
}

function withDraft(draft: Record<string, unknown>) {
  withStorage(draft)
}

function sentViews(): unknown[] {
  return (fetch as Mock).mock.calls.map(([url, init]) => {
    expect(url).toBe('/api/funnel-step')
    expect(init).toMatchObject({ method: 'POST', keepalive: true })
    return JSON.parse(init.body)
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
})

describe('FormProgress funnel step', () => {
  it('reports the step once under the stored visitor id', () => {
    withStorage({}, storedVisitorId)
    const { rerender } = render(<FormProgress route="/symptoms" />)
    rerender(<FormProgress route="/symptoms" />)

    expect(sentViews()).toEqual([{ visitorId: storedVisitorId, step: '/symptoms', locale: 'en' }])
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('creates and stores a visitor id when none is stored', () => {
    withStorage({})
    render(<FormProgress route="/get-started" />)

    const [view] = sentViews() as { visitorId: string }[]
    expect(view.visitorId).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.setItem).toHaveBeenCalledWith(FUNNEL_VISITOR_KEY, view.visitorId)
  })

  it('replaces a stored visitor id that is not a uuid', () => {
    withStorage({}, 'tampered')
    render(<FormProgress route="/review" />)

    const [view] = sentViews() as { visitorId: string }[]
    expect(view.visitorId).not.toBe('tampered')
    expect(localStorage.setItem).toHaveBeenCalledWith(FUNNEL_VISITOR_KEY, view.visitorId)
  })

  it('waits until the step is enabled', () => {
    withStorage({}, storedVisitorId)
    const { rerender } = renderHook(({ ready }) => useFunnelStep('/payment', ready), {
      initialProps: { ready: false },
    })
    expect(fetch).not.toHaveBeenCalled()

    rerender({ ready: true })
    expect(sentViews()).toEqual([{ visitorId: storedVisitorId, step: '/payment', locale: 'en' }])
  })

  it('sends nothing when storage is unavailable', () => {
    ;(localStorage.getItem as Mock).mockImplementation((key: string) => {
      if (key === FUNNEL_VISITOR_KEY) throw new Error('blocked')
      return '{}'
    })
    render(<FormProgress route="/review" />)

    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('FormProgress', () => {
  it('counts only the steps this draft will visit', () => {
    withDraft({ recipient: 'myself', absenceReason: "Doctor's appointment" })
    render(<FormProgress route="/additional-info" />)
    expect(screen.getByText('Step 8 of 9')).toBeInTheDocument()
    expect(screen.getByText('80% complete')).toBeInTheDocument()
  })

  it('counts the guardian step for someone else', () => {
    withDraft({ recipient: 'someone_else', absenceReason: 'Feeling sick' })
    render(<FormProgress route="/review" />)
    expect(screen.getByText('Step 11 of 11')).toBeInTheDocument()
  })

  it('starts at step one with an empty draft', () => {
    withDraft({})
    render(<FormProgress route="/get-started" />)
    expect(screen.getByText('Step 1 of 10')).toBeInTheDocument()
  })
})
