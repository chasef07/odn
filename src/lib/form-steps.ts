export type Recipient = 'myself' | 'someone_else'

export interface FormStep {
  route: string
  /**
   * When present, the step is only part of the wizard for recipients that
   * satisfy this predicate. Steps without it are always included.
   */
  includeForRecipient?: (recipient: Recipient) => boolean
}

/**
 * Ordered intake wizard steps. `guardian-info` is only shown when the note is
 * requested for someone else, which shifts every later step down by one for the
 * `myself` flow. Deriving step numbers and back/next routes from this single
 * source keeps the pages in sync instead of hardcoding indices per page.
 */
export const FORM_STEPS: readonly FormStep[] = [
  { route: '/get-started' },
  { route: '/who-is-using' },
  { route: '/basic-info' },
  { route: '/guardian-info', includeForRecipient: (recipient) => recipient === 'someone_else' },
  { route: '/contact-info' },
  { route: '/note-purpose' },
  { route: '/absence-dates' },
  { route: '/absence-reason' },
  { route: '/symptoms' },
  { route: '/additional-info' },
  { route: '/review' },
]

/**
 * The wizard steps that apply to a given recipient, in order.
 */
export function getStepsForRecipient(recipient: Recipient): FormStep[] {
  return FORM_STEPS.filter((step) => step.includeForRecipient?.(recipient) ?? true)
}

function getStepIndex(route: string, recipient: Recipient): number {
  const index = getStepsForRecipient(recipient).findIndex((step) => step.route === route)
  if (index === -1) {
    throw new Error(`Unknown form step route: ${route}`)
  }
  return index
}

/**
 * 1-based step number for the progress indicator.
 */
export function getStepNumber(route: string, recipient: Recipient): number {
  return getStepIndex(route, recipient) + 1
}

/**
 * Route of the previous wizard step, or null if this is the first step.
 */
export function getBackRoute(route: string, recipient: Recipient): string | null {
  const steps = getStepsForRecipient(recipient)
  const index = getStepIndex(route, recipient)
  return index > 0 ? steps[index - 1].route : null
}

/**
 * Route of the next wizard step, or null if this is the last step.
 */
export function getNextRoute(route: string, recipient: Recipient): string | null {
  const steps = getStepsForRecipient(recipient)
  const index = getStepIndex(route, recipient)
  return index < steps.length - 1 ? steps[index + 1].route : null
}
