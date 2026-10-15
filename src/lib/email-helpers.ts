export function getRecipientName(notePurpose: string): string {
  if (notePurpose === 'work') return 'employer'
  if (notePurpose === 'school') return 'school'
  if (notePurpose === 'both') return 'employer or school'
  if (notePurpose === 'travel') return 'travel provider'

  return 'employer or school'
}

export function getAbsenceFromText(notePurpose: string): string {
  if (notePurpose === 'work') return 'from work'
  if (notePurpose === 'school') return 'from school'
  if (notePurpose === 'both') return 'from work and school'
  if (notePurpose === 'travel') return 'for travel'

  return ''
}

export function getPdfActivitiesText(notePurpose: string): string {
  if (notePurpose === 'work') return 'from work / work-related activities'
  if (notePurpose === 'school') return 'from school / school-related activities'
  if (notePurpose === 'both') return 'from work and school / work and school-related activities'
  if (notePurpose === 'travel') return 'for travel'

  return ''
}
