export const INTAKE_RULES = {
  required: 'always',
  too_long: 'flag',
  unknown_option: 'flag',
  name_characters: 'flag',
  date_invalid: 'always',
  date_future: 'always',
  date_before_1900: 'always',
  under_18: 'always',
  state_unsupported: 'flag',
  email_invalid: 'flag',
  email_typo: 'flag',
  phone_characters: 'flag',
  phone_digits: 'flag',
  purpose_legal: 'always',
  purpose_other_text: 'flag',
  absence_too_far_past: 'always',
  absence_reversed: 'always',
  absence_too_long: 'always',
  reason_other_text: 'flag',
  symptoms_none: 'flag',
  symptom_other_text: 'flag',
} as const satisfies Record<string, 'always' | 'flag'>

export type IntakeRule = keyof typeof INTAKE_RULES

export function rule(code: IntakeRule): { rule: IntakeRule } {
  return { rule: code }
}

export function isIntakeRule(value: unknown): value is IntakeRule {
  return typeof value === 'string' && value in INTAKE_RULES
}
