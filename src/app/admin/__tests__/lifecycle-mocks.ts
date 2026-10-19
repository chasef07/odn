import { expect, type Mock } from 'vitest'
import type { Refusal, Transition } from '@/db/submission-lifecycle'

export function lifecycleMocks(mockPermit: Mock, mockTransition: Mock) {
  return {
    permits(transition: Transition, row: object) {
      mockPermit.mockResolvedValue({ ok: true, value: { transition, row } })
    },
    refuses(refusal: Refusal) {
      mockPermit.mockResolvedValue({ ok: false, refusal })
    },
    transitionsSucceed() {
      mockTransition.mockImplementation(async (step: { row: object }) => ({
        ok: true,
        value: step.row,
      }))
    },
    expectTransition(transition: Transition, input: object) {
      expect(mockTransition).toHaveBeenCalledWith(expect.objectContaining({ transition }), input)
    },
    expectNoTransition(transition: Transition) {
      expect(mockTransition).not.toHaveBeenCalledWith(
        expect.objectContaining({ transition }),
        expect.anything()
      )
    },
  }
}
