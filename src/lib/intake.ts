import { z } from 'zod'
import { parseIsoDateOnlyAsUTCDate } from '@/lib/date-only'
import type { FormData } from '@/lib/form-storage'
import {
  absenceDatesSchema,
  absenceReasonSchema,
  additionalInfoSchema,
  contactSchema,
  guardianSchema,
  notePurposeSchema,
  patientSchema,
  recipientSchema,
  stateSchema,
  symptomsSchema,
} from '@/lib/validation-schemas'

export type IntakeDraft = Partial<Record<keyof FormData, unknown>>

export interface IntakeStep {
  route: string
  schema?: z.ZodType
  include?: (draft: IntakeDraft) => boolean
}

export const SYMPTOM_SKIP_REASONS: ReadonlySet<unknown> = new Set(["Doctor's appointment", 'Other'])

export const INTAKE_STEPS: readonly IntakeStep[] = [
  { route: '/get-started', schema: stateSchema },
  { route: '/who-is-using', schema: recipientSchema },
  { route: '/basic-info', schema: patientSchema },
  {
    route: '/guardian-info',
    schema: guardianSchema,
    include: (draft) => draft.recipient === 'someone_else',
  },
  { route: '/contact-info', schema: contactSchema },
  { route: '/note-purpose', schema: notePurposeSchema },
  { route: '/absence-dates', schema: absenceDatesSchema },
  { route: '/absence-reason', schema: absenceReasonSchema },
  {
    route: '/symptoms',
    schema: symptomsSchema,
    include: (draft) => !SYMPTOM_SKIP_REASONS.has(draft.absenceReason),
  },
  { route: '/additional-info', schema: additionalInfoSchema },
  { route: '/review' },
]

function included(step: IntakeStep, draft: IntakeDraft): boolean {
  return step.include?.(draft) ?? true
}

function tableIndex(route: string): number {
  const index = INTAKE_STEPS.findIndex((step) => step.route === route)
  if (index === -1) throw new Error(`Unknown intake step: ${route}`)
  return index
}

export function stepsFor(draft: IntakeDraft): IntakeStep[] {
  return INTAKE_STEPS.filter((step) => included(step, draft))
}

export function includesStep(route: string, draft: IntakeDraft): boolean {
  return included(INTAKE_STEPS[tableIndex(route)], draft)
}

export function stepNumber(route: string, draft: IntakeDraft): number {
  return INTAKE_STEPS.slice(0, tableIndex(route)).filter((step) => included(step, draft)).length + 1
}

export function totalSteps(draft: IntakeDraft): number {
  return stepsFor(draft).length
}

export function nextRoute(route: string, draft: IntakeDraft): string {
  const next = INTAKE_STEPS.slice(tableIndex(route) + 1).find((step) => included(step, draft))
  if (!next) throw new Error(`No intake step after ${route}`)
  return next.route
}

export function backRoute(route: string, draft: IntakeDraft): string {
  const previous = INTAKE_STEPS.slice(0, tableIndex(route))
    .reverse()
    .find((step) => included(step, draft))
  if (!previous) throw new Error(`No intake step before ${route}`)
  return previous.route
}

function isoDate(value: string, ctx: z.RefinementCtx): Date {
  const date = parseIsoDateOnlyAsUTCDate(value)
  if (date) return date
  ctx.addIssue({ code: 'custom', message: 'Expected a YYYY-MM-DD date' })
  return z.NEVER
}

const MISSING = 'Required field is missing'
const requiredDate = z.string({ error: MISSING }).transform(isoDate)
const optionalDate = z
  .string({ error: 'Expected a YYYY-MM-DD date' })
  .optional()
  .transform((value, ctx) => (value ? isoDate(value, ctx) : null))
const requiredText = z.string({ error: MISSING }).trim().min(1, MISSING)
const optionalText = z
  .string({ error: 'Expected text' })
  .optional()
  .transform((value) => value?.trim() || null)

export const intakeSubmissionSchema = z.object({
  state: requiredText,
  recipient: z.enum(['myself', 'someone_else'], { error: MISSING }),
  patientFirstName: requiredText,
  patientLastName: requiredText,
  patientDateOfBirth: requiredDate,
  guardianFirstName: optionalText,
  guardianLastName: optionalText,
  guardianDateOfBirth: optionalDate,
  email: requiredText,
  phone: requiredText,
  notePurpose: requiredText,
  otherNotePurpose: optionalText,
  firstDayOff: requiredDate,
  lastDayOff: requiredDate,
  absenceReason: requiredText,
  otherAbsenceReason: optionalText,
  symptoms: z
    .array(z.string({ error: 'Expected text' }), { error: 'Expected a list of text' })
    .optional()
    .transform((value) => value ?? null),
  otherSymptomText: optionalText,
  additionalInformation: optionalText,
  smsOptIn: z
    .boolean({ error: 'Expected true or false' })
    .optional()
    .transform((value) => value === true),
})

export type IntakeSubmission = z.output<typeof intakeSubmissionSchema>

export interface IntakeIssue {
  field: string
  message: string
}

export type IntakeParseResult =
  | { kind: 'valid'; data: IntakeSubmission }
  | { kind: 'rule_failure'; data: IntakeSubmission; issues: IntakeIssue[] }
  | { kind: 'shape_failure'; issues: IntakeIssue[] }

function toIssues(error: z.ZodError): IntakeIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'form',
    message: issue.message,
  }))
}

export function parseIntake(input: unknown): IntakeParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { kind: 'shape_failure', issues: [{ field: 'form', message: 'Form data is required' }] }
  }
  const draft = input as IntakeDraft

  const issues: IntakeIssue[] = []
  const normalized: Record<string, unknown> = { ...draft }
  for (const step of stepsFor(draft)) {
    if (!step.schema) continue
    const result = step.schema.safeParse(draft)
    if (result.success) Object.assign(normalized, result.data)
    else issues.push(...toIssues(result.error))
  }

  const shape = intakeSubmissionSchema.safeParse(normalized)
  if (!shape.success) {
    return { kind: 'shape_failure', issues: [...issues, ...toIssues(shape.error)] }
  }
  if (issues.length > 0) return { kind: 'rule_failure', data: shape.data, issues }
  return { kind: 'valid', data: shape.data }
}
