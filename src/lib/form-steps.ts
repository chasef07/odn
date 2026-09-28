export type Recipient = 'myself' | 'someone_else'

export interface FormStep {
  route: string
  includeForRecipient?: (recipient: Recipient) => boolean
}

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

export function getStepNumber(route: string, recipient: Recipient): number {
  return getStepIndex(route, recipient) + 1
}

export function getBackRoute(route: string, recipient: Recipient): string | null {
  const steps = getStepsForRecipient(recipient)
  const index = getStepIndex(route, recipient)
  return index > 0 ? steps[index - 1].route : null
}

export function getNextRoute(route: string, recipient: Recipient): string | null {
  const steps = getStepsForRecipient(recipient)
  const index = getStepIndex(route, recipient)
  return index < steps.length - 1 ? steps[index + 1].route : null
}
