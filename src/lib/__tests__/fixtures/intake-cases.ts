import type { IntakeParseResult } from '@/lib/intake'
import { ABSENCE_REASONS, AVAILABLE_STATES, SYMPTOMS_BY_REASON } from '@/lib/form-constants'

type Verdict = IntakeParseResult['kind']

const ACCEPT: Verdict = 'valid'
const RULE: Verdict = 'rule_failure'
const SHAPE: Verdict = 'shape_failure'

export const now = new Date('2026-06-15T12:00:00Z')
const iso = (date: Date) => date.toISOString().slice(0, 10)
const daysFromToday = (days: number) => {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + days)
  return iso(date)
}
const bornYearsAgo = (years: number, dayShift = 0) => {
  const date = new Date(now)
  date.setUTCFullYear(date.getUTCFullYear() - years)
  date.setUTCDate(date.getUTCDate() + dayShift)
  return iso(date)
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
  attribution: { first: {}, last: {} },
}
const someoneElse = {
  ...myself,
  recipient: 'someone_else',
  patientDateOfBirth: bornYearsAgo(10),
  guardianFirstName: 'Jane',
  guardianLastName: 'Doe',
  guardianDateOfBirth: '1980-01-01',
}

type Case = [label: string, draft: unknown, expected: Verdict]
export const cases: Case[] = []
const add = (label: string, draft: unknown, expected: Verdict) =>
  cases.push([label, draft, expected])

add('ui baseline myself', myself, ACCEPT)
add('ui baseline someone_else', someoneElse, ACCEPT)

add('patient turned 18 today', { ...myself, patientDateOfBirth: bornYearsAgo(18) }, ACCEPT)
add('patient turns 18 tomorrow', { ...myself, patientDateOfBirth: bornYearsAgo(18, 1) }, RULE)
add('patient 18 and a day', { ...myself, patientDateOfBirth: bornYearsAgo(18, -1) }, ACCEPT)
add('patient 17', { ...myself, patientDateOfBirth: bornYearsAgo(17) }, RULE)
add('patient born today', { ...myself, patientDateOfBirth: bornYearsAgo(0) }, RULE)
add('patient born before 1900', { ...myself, patientDateOfBirth: bornYearsAgo(130) }, RULE)
add('patient DOB 1899-12-31', { ...myself, patientDateOfBirth: '1899-12-31' }, RULE)
add('patient DOB leap day', { ...myself, patientDateOfBirth: '2000-02-29' }, ACCEPT)
add('patient DOB not ISO', { ...myself, patientDateOfBirth: '01/01/1990' }, SHAPE)
add('child patient DOB tomorrow', { ...someoneElse, patientDateOfBirth: daysFromToday(1) }, RULE)
add('guardian turned 18 today', { ...someoneElse, guardianDateOfBirth: bornYearsAgo(18) }, ACCEPT)
add(
  'guardian turns 18 tomorrow',
  { ...someoneElse, guardianDateOfBirth: bornYearsAgo(18, 1) },
  RULE
)
add('guardian 17', { ...someoneElse, guardianDateOfBirth: bornYearsAgo(17) }, RULE)
add('guardian born before 1900', { ...someoneElse, guardianDateOfBirth: bornYearsAgo(130) }, RULE)
add('guardian names missing', { ...someoneElse, guardianFirstName: '', guardianLastName: '' }, RULE)
add('guardian DOB missing', { ...someoneElse, guardianDateOfBirth: '' }, RULE)

for (let start = -10; start <= 3; start++) {
  for (const length of [1, 7, 8]) {
    const tooOld = start < -8
    const tooLong = length > 7
    add(
      `absence starts ${start} days from today for ${length} days`,
      {
        ...myself,
        firstDayOff: daysFromToday(start),
        lastDayOff: daysFromToday(start + length - 1),
      },
      tooOld || tooLong ? RULE : ACCEPT
    )
  }
}
add(
  'absence reversed',
  { ...myself, firstDayOff: daysFromToday(0), lastDayOff: daysFromToday(-1) },
  RULE
)
add(
  'absence a year out',
  { ...myself, firstDayOff: daysFromToday(365), lastDayOff: daysFromToday(366) },
  ACCEPT
)
add('absence not-a-date', { ...myself, firstDayOff: 'not-a-date' }, SHAPE)
add('absence month 13', { ...myself, lastDayOff: '2026-13-01' }, SHAPE)
add('absence US format', { ...myself, firstDayOff: '10/15/2026' }, SHAPE)

for (const phone of [
  '5551234567',
  '(555) 123-4567',
  '555-123-4567',
  '555 123 4567',
  '555.123.4567',
  '+1 555 123 4567',
  '15551234567',
  '+15551234567',
  '1 (555) 123-4567',
  ' (555) 123-4567 ',
]) {
  add(`phone ${JSON.stringify(phone)}`, { ...myself, phone }, ACCEPT)
}
for (const phone of ['555123456', '55512345678', 'call me']) {
  add(`phone ${JSON.stringify(phone)}`, { ...myself, phone }, RULE)
}
add('phone as a number', { ...myself, phone: 5551234567 }, SHAPE)

for (const state of AVAILABLE_STATES) add(`state ${state}`, { ...myself, state }, ACCEPT)
add('state with spaces around it', { ...myself, state: ' Virginia ' }, ACCEPT)
for (const state of ['CA', 'VA', 'Puerto Rico', 'virginia', 'Narnia']) {
  add(`state ${JSON.stringify(state)}`, { ...myself, state }, RULE)
}
add('state missing', { ...myself, state: '' }, SHAPE)

for (const email of [
  'a@example.com',
  'A.B+tag@Example.COM',
  ' john@example.com ',
  'x@uni.edu',
  'x@mail.co.uk',
  'x@site.io',
  'x@site.xyz',
  'x@site.email',
  'x@site.online',
  'x@site.shop',
  'x@yandex.ru',
  'x@site.nl',
  'x@site.es',
  'x@site.mx',
  'x@site.museum',
  'x@ymail.com',
  'josé@example.com',
]) {
  add(`email ${JSON.stringify(email)}`, { ...myself, email }, ACCEPT)
}
for (const email of [
  'x@gmail.con',
  'x@gnail.com',
  'x@site.c',
  'x@localhost',
  'not-an-email',
  'a b@example.com',
]) {
  add(`email ${JSON.stringify(email)}`, { ...myself, email }, RULE)
}
add('email as an array', { ...myself, email: ['a@b.com'] }, SHAPE)

for (const notePurpose of ['work', 'school', 'both', 'travel']) {
  add(`note purpose ${notePurpose}`, { ...myself, notePurpose }, ACCEPT)
}
add(
  'note purpose other with text',
  { ...myself, notePurpose: 'other', otherNotePurpose: 'Gym' },
  ACCEPT
)
add('note purpose other without text', { ...myself, notePurpose: 'other' }, RULE)
add('note purpose legal', { ...myself, notePurpose: 'legal' }, RULE)
add('note purpose legal for someone else', { ...someoneElse, notePurpose: 'legal' }, RULE)
add('note purpose jury', { ...myself, notePurpose: 'jury' }, RULE)
add('note purpose empty', { ...myself, notePurpose: '' }, SHAPE)
add('note purpose null', { ...myself, notePurpose: null }, SHAPE)
add(
  'note purpose over 500 chars',
  { ...myself, notePurpose: 'other', otherNotePurpose: 'x'.repeat(501) },
  RULE
)

for (const name of [
  "O'Brien",
  'O\u2019Brien',
  'Mary-Jane',
  'José',
  'Muñoz',
  'Smith Jr.',
  'Nguyễn',
  '李',
]) {
  add(`last name ${name}`, { ...myself, patientLastName: name }, ACCEPT)
}
add('last name with digits', { ...myself, patientLastName: 'X Æ A-12' }, RULE)
add('last name of periods', { ...myself, patientLastName: '...' }, RULE)
add('last name with a tab', { ...myself, patientLastName: 'Doe\tSmith' }, RULE)
add('last name 51 chars', { ...myself, patientLastName: 'a'.repeat(51) }, RULE)
add('last name only spaces', { ...myself, patientLastName: '   ' }, SHAPE)
add('last name missing', { ...myself, patientLastName: undefined }, SHAPE)

for (const absenceReason of ABSENCE_REASONS) {
  const otherAbsenceReason = absenceReason === 'Other' ? 'Moving' : ''
  const skipsSymptoms = absenceReason === "Doctor's appointment" || absenceReason === 'Other'
  const symptoms = SYMPTOMS_BY_REASON[absenceReason].slice(0, 1)
  add(
    `${absenceReason} with symptoms`,
    { ...myself, absenceReason, otherAbsenceReason, symptoms },
    ACCEPT
  )
  add(
    `${absenceReason} without symptoms`,
    { ...myself, absenceReason, otherAbsenceReason, symptoms: [] },
    skipsSymptoms ? ACCEPT : RULE
  )
}
add('reason Other without text', { ...myself, absenceReason: 'Other', symptoms: [] }, RULE)
add('reason free text', { ...myself, absenceReason: 'illness' }, RULE)
add('reason missing', { ...myself, absenceReason: null }, SHAPE)
add('symptom Other without text', { ...myself, symptoms: ['Other'] }, RULE)
add(
  'symptom Other with text',
  { ...myself, symptoms: ['Other'], otherSymptomText: 'Dizzy' },
  ACCEPT
)
add('symptoms as a string', { ...myself, symptoms: 'Fever' }, SHAPE)

add('recipient invalid', { ...myself, recipient: 'pet' }, SHAPE)
add('recipient missing', { ...myself, recipient: undefined }, SHAPE)
add(
  'additional information 1001 chars',
  { ...myself, additionalInformation: 'x'.repeat(1001) },
  RULE
)
add('sms opt in as a string', { ...myself, smsOptIn: 'yes' }, SHAPE)
add(
  'state abbreviation, free-text reason, no symptoms',
  { ...myself, state: 'CA', absenceReason: 'illness', symptoms: undefined },
  RULE
)
add('empty draft', {}, SHAPE)

add(
  'guardian names blank',
  { ...someoneElse, guardianFirstName: '  ', guardianLastName: ' ' },
  RULE
)
add(
  'guardian fields absent',
  {
    ...someoneElse,
    guardianFirstName: undefined,
    guardianLastName: undefined,
    guardianDateOfBirth: undefined,
  },
  RULE
)
add('guardian DOB absent', { ...someoneElse, guardianDateOfBirth: undefined }, RULE)
add('patient DOB blank', { ...myself, patientDateOfBirth: '' }, SHAPE)
add('note purpose blank for someone else', { ...someoneElse, notePurpose: '' }, SHAPE)
add('state only spaces', { ...myself, state: '   ' }, SHAPE)
add('email only spaces', { ...myself, email: '   ' }, SHAPE)
