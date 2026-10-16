import { describe, expect, it } from 'vitest'
import {
  INTAKE_STEPS,
  type IntakeStep,
  intakeSubmissionSchema,
  backRoute,
  includesStep,
  nextRoute,
  parseIntake,
  stepNumber,
  stepsFor,
  totalSteps,
} from '@/lib/intake'
import { ABSENCE_REASONS } from '@/lib/form-constants'
import type { IntakeRule } from '@/lib/intake-rules'
import robots from '@/app/robots'

const today = new Date()
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const daysFromToday = (days: number) => {
  const date = new Date(today)
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}
const yearsAgo = (years: number) => {
  const date = new Date(today)
  date.setUTCFullYear(date.getUTCFullYear() - years)
  return isoDate(date)
}

const myself = {
  state: 'Virginia',
  recipient: 'myself',
  patientFirstName: 'John',
  patientLastName: 'Doe',
  patientDateOfBirth: '1990-01-01',
  email: 'john@example.com',
  phone: '(555) 123-4567',
  smsOptIn: true,
  notePurpose: 'work',
  firstDayOff: daysFromToday(-1),
  lastDayOff: daysFromToday(1),
  absenceReason: 'Feeling sick',
  symptoms: ['Fever or chills'],
  otherSymptomText: '',
  additionalInformation: '',
  offerCode: 'friends20',
}

const someoneElse = {
  ...myself,
  recipient: 'someone_else',
  patientDateOfBirth: yearsAgo(10),
  guardianFirstName: 'Jane',
  guardianLastName: 'Doe',
  guardianDateOfBirth: '1980-01-01',
}

const sick = { recipient: 'myself', absenceReason: 'Feeling sick' }
const guardianSick = { recipient: 'someone_else', absenceReason: 'Feeling sick' }
const appointment = { recipient: 'myself', absenceReason: "Doctor's appointment" }

describe('INTAKE_STEPS navigation', () => {
  it('lists every intake route once, review last', () => {
    expect(INTAKE_STEPS.map((step) => step.route)).toEqual([
      '/get-started',
      '/who-is-using',
      '/basic-info',
      '/guardian-info',
      '/contact-info',
      '/note-purpose',
      '/absence-dates',
      '/absence-reason',
      '/symptoms',
      '/additional-info',
      '/review',
    ])
  })

  it('includes guardian-info only for someone_else', () => {
    expect(stepsFor(sick).map((step) => step.route)).not.toContain('/guardian-info')
    expect(stepsFor(guardianSick).map((step) => step.route)).toContain('/guardian-info')
    expect(totalSteps(sick)).toBe(10)
    expect(totalSteps(guardianSick)).toBe(11)
  })

  it('skips symptoms for appointments and other reasons, and counts the steps that remain', () => {
    const skipReasons = ["Doctor's appointment", 'Other']
    expect(ABSENCE_REASONS).toEqual(expect.arrayContaining(skipReasons))
    for (const absenceReason of skipReasons) {
      const draft = { recipient: 'myself', absenceReason }
      expect(includesStep('/symptoms', draft)).toBe(false)
      expect(nextRoute('/absence-reason', draft)).toBe('/additional-info')
      expect(backRoute('/additional-info', draft)).toBe('/absence-reason')
      expect(totalSteps(draft)).toBe(9)
      expect(stepNumber('/additional-info', draft)).toBe(8)
      expect(stepNumber('/review', draft)).toBe(9)
    }
    expect(stepNumber('/additional-info', sick)).toBe(9)
    expect(includesStep('/symptoms', { recipient: 'myself' })).toBe(true)
  })

  it('numbers the steps a draft will visit', () => {
    expect(stepNumber('/get-started', sick)).toBe(1)
    expect(stepNumber('/contact-info', sick)).toBe(4)
    expect(stepNumber('/contact-info', guardianSick)).toBe(5)
    expect(stepNumber('/review', sick)).toBe(10)
    expect(stepNumber('/review', guardianSick)).toBe(11)
  })

  it('numbers an excluded step by its position in the table', () => {
    expect(stepNumber('/guardian-info', sick)).toBe(4)
    expect(stepNumber('/symptoms', appointment)).toBe(8)
  })

  it('walks forward and back through the included steps', () => {
    expect(nextRoute('/get-started', sick)).toBe('/who-is-using')
    expect(nextRoute('/basic-info', sick)).toBe('/contact-info')
    expect(nextRoute('/basic-info', guardianSick)).toBe('/guardian-info')
    expect(nextRoute('/guardian-info', guardianSick)).toBe('/contact-info')
    expect(nextRoute('/absence-reason', sick)).toBe('/symptoms')
    expect(nextRoute('/symptoms', sick)).toBe('/additional-info')
    expect(nextRoute('/additional-info', sick)).toBe('/review')
    expect(backRoute('/who-is-using', sick)).toBe('/get-started')
    expect(backRoute('/contact-info', sick)).toBe('/basic-info')
    expect(backRoute('/contact-info', guardianSick)).toBe('/guardian-info')
    expect(backRoute('/review', sick)).toBe('/additional-info')
  })

  it('keeps every intake route out of robots for every crawler rule', () => {
    const rules = robots().rules
    for (const rule of Array.isArray(rules) ? rules : [rules]) {
      const disallow = rule.disallow as string[]
      expect(INTAKE_STEPS.map((step) => step.route).filter((r) => !disallow.includes(r))).toEqual(
        []
      )
    }
  })

  it('throws for a step past either end', () => {
    expect(() => nextRoute('/review', sick)).toThrow('No intake step after /review')
    expect(() => backRoute('/get-started', sick)).toThrow('No intake step before /get-started')
  })
})

describe('parseIntake', () => {
  it('accepts a complete draft for myself and returns typed dates', () => {
    const result = parseIntake(myself)
    expect(result.kind).toBe('valid')
    if (result.kind !== 'valid') return
    expect(result.data.patientDateOfBirth).toEqual(new Date('1990-01-01T00:00:00.000Z'))
    expect(result.data.firstDayOff).toEqual(new Date(`${myself.firstDayOff}T00:00:00.000Z`))
    expect(result.data.guardianDateOfBirth).toBeNull()
    expect(result.data.symptoms).toEqual(['Fever or chills'])
    expect(result.data.otherSymptomText).toBeNull()
    expect(result.data.additionalInformation).toBeNull()
    expect(result.data.smsOptIn).toBe(true)
    expect(result.data).not.toHaveProperty('offerCode')
  })

  it('accepts a complete draft for someone else', () => {
    expect(parseIntake(someoneElse).kind).toBe('valid')
  })

  it('normalizes what the schemas transform', () => {
    const result = parseIntake({
      ...myself,
      patientFirstName: '  José ',
      patientLastName: 'Muñoz',
      email: ' Jose@Correo.ES ',
      phone: '+1 555 123 4567',
      additionalInformation: '  note  ',
    })
    expect(result.kind).toBe('valid')
    if (result.kind !== 'valid') return
    expect(result.data.patientFirstName).toBe('José')
    expect(result.data.email).toBe('jose@correo.es')
    expect(result.data.phone).toBe('(555) 123-4567')
    expect(result.data.additionalInformation).toBe('note')
  })

  it('accepts a skip reason without symptoms', () => {
    expect(
      parseIntake({ ...myself, absenceReason: "Doctor's appointment", symptoms: [] }).kind
    ).toBe('valid')
    expect(
      parseIntake({ ...myself, absenceReason: 'Other', otherAbsenceReason: 'Moving', symptoms: [] })
        .kind
    ).toBe('valid')
  })

  it('reports rule failures with the data still persistable', () => {
    const cases: Array<[Record<string, unknown>, string, IntakeRule, RegExp]> = [
      [{ ...myself, notePurpose: 'legal' }, 'notePurpose', 'purpose_legal', /legal matters/],
      [{ ...myself, state: 'CA' }, 'state', 'state_unsupported', /state from the list/],
      [
        { ...myself, patientDateOfBirth: yearsAgo(17) },
        'patientDateOfBirth',
        'under_18',
        /18 or older/,
      ],
      [
        { ...someoneElse, guardianDateOfBirth: yearsAgo(17) },
        'guardianDateOfBirth',
        'under_18',
        /18 years/,
      ],
      [
        { ...myself, lastDayOff: daysFromToday(10) },
        'lastDayOff',
        'absence_too_long',
        /7 consecutive days/,
      ],
      [{ ...myself, email: 'john@gmail.con' }, 'email', 'email_typo', /Did you mean "\.com"/],
      [{ ...myself, phone: '555123456' }, 'phone', 'phone_digits', /exactly 10 digits/],
      [{ ...myself, symptoms: [] }, 'symptoms', 'symptoms_none', /at least one option/],
      [
        { ...myself, absenceReason: 'illness' },
        'absenceReason',
        'unknown_option',
        /reason for your absence/,
      ],
      [
        { ...myself, notePurpose: 'other' },
        'otherNotePurpose',
        'purpose_other_text',
        /specify the purpose/,
      ],
      [
        { ...someoneElse, guardianFirstName: '' },
        'guardianFirstName',
        'required',
        /Guardian first name/,
      ],
      [{ ...myself, patientLastName: 'a'.repeat(51) }, 'patientLastName', 'too_long', /50/],
      [{ ...myself, patientLastName: 'X Æ A-12' }, 'patientLastName', 'name_characters', /letters/],
      [{ ...myself, notePurpose: 'jury' }, 'notePurpose', 'unknown_option', /purpose/],
    ]
    for (const [draft, field, rule, message] of cases) {
      const result = parseIntake(draft)
      expect(result.kind, field).toBe('rule_failure')
      if (result.kind !== 'rule_failure') continue
      expect(result.issues[0]).toEqual({
        rule,
        field,
        message: expect.stringMatching(message),
        route: expect.stringMatching(/^\//),
      })
      expect(result.data.state).toBe(draft.state)
    }
  })

  it('normalizes the fields of a step whose other field fails a rule', () => {
    const result = parseIntake({ ...myself, email: 'John@Gmail.con', phone: '+1 555 123 4567' })
    expect(result.kind).toBe('rule_failure')
    if (result.kind !== 'rule_failure') return
    expect(result.data.email).toBe('john@gmail.con')
    expect(result.data.phone).toBe('(555) 123-4567')
  })

  it('names the step that owns each failing field', () => {
    const result = parseIntake({ ...myself, state: 'CA', lastDayOff: daysFromToday(10) })
    expect(result.kind).toBe('rule_failure')
    if (result.kind !== 'rule_failure') return
    expect(result.issues.map((issue) => [issue.field, issue.route])).toEqual([
      ['state', '/get-started'],
      ['lastDayOff', '/absence-dates'],
    ])
  })

  it('drops the fields of steps the draft never visits', () => {
    const result = parseIntake({
      ...myself,
      guardianFirstName: 'Jane',
      guardianDateOfBirth: 'garbage',
      absenceReason: "Doctor's appointment",
      symptoms: 'x'.repeat(100000),
    })
    expect(result.kind).toBe('valid')
    if (result.kind !== 'valid') return
    expect(result.data.guardianFirstName).toBeNull()
    expect(result.data.guardianDateOfBirth).toBeNull()
    expect(result.data.symptoms).toBeNull()
  })

  it('stores a null optional field as null instead of failing the shape', () => {
    const result = parseIntake({
      ...myself,
      otherNotePurpose: null,
      guardianDateOfBirth: null,
      symptoms: null,
      smsOptIn: null,
      absenceReason: 'Other',
      otherAbsenceReason: 'Moving',
    })
    expect(result.kind).not.toBe('shape_failure')
    if (result.kind === 'shape_failure') return
    expect(result.data.otherNotePurpose).toBeNull()
    expect(result.data.guardianDateOfBirth).toBeNull()
    expect(result.data.symptoms).toBeNull()
    expect(result.data.smsOptIn).toBe(false)
  })

  it('reports a shape failure by the field that blocks storage, not by a rule', () => {
    const result = parseIntake({ ...myself, state: 'CA', phone: 5551234567 })
    expect(result.kind).toBe('shape_failure')
    if (result.kind !== 'shape_failure') return
    expect(result.issues).toEqual([
      {
        rule: 'required',
        field: 'phone',
        message: 'Phone number is required',
        route: '/contact-info',
      },
    ])
  })

  it('reports each failing field once', () => {
    const result = parseIntake({ ...myself, recipient: 'pet' })
    expect(result.kind).toBe('shape_failure')
    if (result.kind !== 'shape_failure') return
    expect(result.issues.filter((issue) => issue.field === 'recipient')).toHaveLength(1)
  })

  it('stores every field the step schemas collect, plus the SMS consent from the review step', () => {
    const stepFields = INTAKE_STEPS.flatMap((step: IntakeStep) =>
      step.schema ? Object.keys(step.schema.shape) : []
    )
    expect(new Set(Object.keys(intakeSubmissionSchema.shape))).toEqual(
      new Set([...stepFields, 'smsOptIn'])
    )
  })

  it('reports shape failures when a required column is missing or the wrong type', () => {
    const cases: Array<[unknown, string]> = [
      [{ ...myself, patientLastName: '' }, 'Last name is required'],
      [{ ...myself, phone: 5551234567 }, 'Phone number is required'],
      [{ ...myself, email: ['a@b.com'] }, 'Email is required'],
      [{ ...myself, recipient: 'pet' }, 'Please choose who this note is for'],
      [{ ...myself, firstDayOff: 'not-a-date' }, 'Please enter a valid first day off'],
      [{ ...myself, symptoms: 'Fever' }, 'Please select at least one option'],
      [{ state: 'Virginia', recipient: 'myself' }, 'First name is required'],
      [null, 'Form data is required'],
      ['{}', 'Form data is required'],
      [[], 'Form data is required'],
    ]
    for (const [draft, message] of cases) {
      const result = parseIntake(draft)
      expect(result.kind, message).toBe('shape_failure')
      if (result.kind !== 'shape_failure') continue
      expect(result.issues[0].message).toBe(message)
    }
  })

  it('never surfaces a zod default message first', () => {
    const drafts = [
      {},
      { recipient: 1 },
      { ...myself, state: 2, email: 3, phone: 4, notePurpose: 5, absenceReason: 6 },
      { ...myself, symptoms: {}, additionalInformation: 7, smsOptIn: 'yes' },
    ]
    for (const draft of drafts) {
      const result = parseIntake(draft)
      expect(result.kind).toBe('shape_failure')
      if (result.kind !== 'shape_failure') continue
      expect(result.issues[0].message).not.toMatch(/^Invalid|expected/i)
    }
  })
})
