import { z } from 'zod'
import { parseDateOnly, utcDateFromDateOnly } from '@/lib/dates'
import type { FormData } from '@/lib/form-storage'
import { INTAKE_RULES, isIntakeRule, rule, type IntakeRule } from '@/lib/intake-rules'
import { formatPhoneNumber, toNationalDigits } from '@/lib/phone-utils'
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
  schema?: z.ZodObject<z.ZodRawShape>
  include?: (draft: IntakeDraft) => boolean
}

const SYMPTOM_SKIP_REASONS: ReadonlySet<string> = new Set(["Doctor's appointment", 'Other'])

export const INTAKE_STEPS = [
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
    include: (draft) =>
      typeof draft.absenceReason !== 'string' || !SYMPTOM_SKIP_REASONS.has(draft.absenceReason),
  },
  { route: '/additional-info', schema: additionalInfoSchema },
  { route: '/review' },
] as const satisfies readonly IntakeStep[]

export type IntakeRoute = (typeof INTAKE_STEPS)[number]['route']

function included(step: IntakeStep, draft: IntakeDraft): boolean {
  return step.include?.(draft) ?? true
}

function tableIndex(route: IntakeRoute): number {
  return INTAKE_STEPS.findIndex((step) => step.route === route)
}

function stepFields(step: IntakeStep): string[] {
  return step.schema ? Object.keys(step.schema.shape) : []
}

const FIELD_ROUTE = new Map<string, IntakeRoute>()
for (const step of INTAKE_STEPS) {
  for (const field of stepFields(step)) {
    if (!FIELD_ROUTE.has(field)) FIELD_ROUTE.set(field, step.route)
  }
}

export function stepsFor(draft: IntakeDraft): IntakeStep[] {
  return INTAKE_STEPS.filter((step) => included(step, draft))
}

export function includesStep(route: IntakeRoute, draft: IntakeDraft): boolean {
  return included(INTAKE_STEPS[tableIndex(route)], draft)
}

export function stepNumber(route: IntakeRoute, draft: IntakeDraft): number {
  return INTAKE_STEPS.slice(0, tableIndex(route)).filter((step) => included(step, draft)).length + 1
}

export function totalSteps(draft: IntakeDraft): number {
  return stepsFor(draft).length
}

export function nextRoute(route: IntakeRoute, draft: IntakeDraft): IntakeRoute {
  const next = INTAKE_STEPS.slice(tableIndex(route) + 1).find((step) => included(step, draft))
  if (!next) throw new Error(`No intake step after ${route}`)
  return next.route
}

export function backRoute(route: IntakeRoute, draft: IntakeDraft): IntakeRoute {
  const previous = INTAKE_STEPS.slice(0, tableIndex(route))
    .reverse()
    .find((step) => included(step, draft))
  if (!previous) throw new Error(`No intake step before ${route}`)
  return previous.route
}

function isoDate(value: string, ctx: z.RefinementCtx): Date {
  const day = parseDateOnly(value)
  if (day) return utcDateFromDateOnly(day)
  ctx.addIssue({
    code: 'custom',
    message: 'Expected a YYYY-MM-DD date',
    params: rule('date_invalid'),
  })
  return z.NEVER
}

const MISSING = 'Required field is missing'
const requiredDate = z.string({ error: MISSING }).transform(isoDate)
const optionalDate = z
  .string({ error: 'Expected a YYYY-MM-DD date' })
  .nullish()
  .transform((value, ctx) => (value ? isoDate(value, ctx) : null))
const requiredText = z.string({ error: MISSING }).trim().min(1, MISSING)
const optionalText = z
  .string({ error: 'Expected text' })
  .nullish()
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
  email: requiredText.toLowerCase(),
  phone: requiredText.transform((value) =>
    toNationalDigits(value).length === 10 ? formatPhoneNumber(value) : value
  ),
  notePurpose: requiredText,
  otherNotePurpose: optionalText,
  firstDayOff: requiredDate,
  lastDayOff: requiredDate,
  absenceReason: requiredText,
  otherAbsenceReason: optionalText,
  symptoms: z
    .array(z.string({ error: 'Expected text' }), { error: 'Expected a list of text' })
    .nullish()
    .transform((value) => value ?? null),
  otherSymptomText: optionalText,
  additionalInformation: optionalText,
  smsOptIn: z
    .boolean({ error: 'Expected true or false' })
    .nullish()
    .transform((value) => value === true),
})

export type IntakeSubmission = z.output<typeof intakeSubmissionSchema>

export interface IntakeIssue {
  rule: IntakeRule
  field: string
  message: string
  route: IntakeRoute
}

export type IntakeParseResult =
  | { kind: 'valid'; data: IntakeSubmission }
  | { kind: 'rule_failure'; data: IntakeSubmission; issues: IntakeIssue[] }
  | { kind: 'shape_failure'; issues: IntakeIssue[] }

const ZOD_RULES: Partial<Record<z.core.$ZodIssue['code'], IntakeRule>> = {
  invalid_type: 'required',
  too_small: 'required',
  too_big: 'too_long',
  invalid_value: 'unknown_option',
}

function ruleOf(issue: z.core.$ZodIssue, field: string): IntakeRule {
  const code = issue.code === 'custom' ? issue.params?.rule : ZOD_RULES[issue.code]
  if (isIntakeRule(code)) return code
  throw new Error(`Intake issue on ${field} has no rule code (zod ${issue.code})`)
}

function toIssues(error: z.ZodError): IntakeIssue[] {
  return error.issues.map((issue) => {
    const field = issue.path.join('.') || 'form'
    return {
      rule: ruleOf(issue, field),
      field,
      message: issue.message,
      route: FIELD_ROUTE.get(field) ?? '/review',
    }
  })
}

export function checkoutBlockers(issues: IntakeIssue[], enforced: boolean): IntakeIssue[] {
  return enforced ? issues : issues.filter((issue) => INTAKE_RULES[issue.rule] === 'always')
}

export function loggedIssues(
  issues: IntakeIssue[]
): Pick<IntakeIssue, 'rule' | 'field' | 'route'>[] {
  return issues.map(({ rule, field, route }) => ({ rule, field, route }))
}

function dedupe(issues: IntakeIssue[]): IntakeIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.field}\n${issue.rule}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parseIntake(input: unknown): IntakeParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      kind: 'shape_failure',
      issues: [
        { rule: 'required', field: 'form', message: 'Form data is required', route: '/review' },
      ],
    }
  }
  const draft = input as IntakeDraft

  const ruleIssues: IntakeIssue[] = []
  const normalized: Record<string, unknown> = { ...draft }
  for (const step of INTAKE_STEPS as readonly IntakeStep[]) {
    if (!step.schema) continue
    if (!included(step, draft)) {
      for (const field of stepFields(step)) normalized[field] = undefined
      continue
    }
    const result = step.schema.safeParse(draft)
    if (result.success) {
      Object.assign(normalized, result.data)
      continue
    }
    ruleIssues.push(...toIssues(result.error))
  }

  const shape = intakeSubmissionSchema.safeParse(normalized)
  if (!shape.success) {
    const issues = toIssues(shape.error).map(
      (issue) => ruleIssues.find((rule) => rule.field === issue.field) ?? issue
    )
    return { kind: 'shape_failure', issues: dedupe(issues) }
  }
  if (ruleIssues.length > 0) {
    return { kind: 'rule_failure', data: shape.data, issues: dedupe(ruleIssues) }
  }
  return { kind: 'valid', data: shape.data }
}
