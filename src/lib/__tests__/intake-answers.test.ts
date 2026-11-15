import { describe, expect, it } from 'vitest'
import { absenceReasonAnswer, notePurposeAnswer, symptomAnswers } from '../intake-answers'

describe('notePurposeAnswer', () => {
  it('appends the text the patient wrote for an Other purpose', () => {
    expect(notePurposeAnswer('other', ' Volunteering ')).toBe('Other: Volunteering')
  })

  it('says only Other when the Other text is missing or blank', () => {
    expect(notePurposeAnswer('other', null)).toBe('Other')
    expect(notePurposeAnswer('other', '  ')).toBe('Other')
  })

  it('names any other purpose by its label and skips leftover Other text', () => {
    expect(notePurposeAnswer('work', 'Volunteering')).toBe('Work')
    expect(notePurposeAnswer('legal', null)).toBe('legal')
  })
})

describe('absenceReasonAnswer', () => {
  it('appends the text the patient wrote for an Other reason', () => {
    expect(absenceReasonAnswer('Other', 'Dental procedure')).toBe('Other: Dental procedure')
  })

  it('says only Other when the Other text is missing', () => {
    expect(absenceReasonAnswer('Other', null)).toBe('Other')
  })

  it('skips leftover Other text on any other reason', () => {
    expect(absenceReasonAnswer('Accident or injury', 'Twisted ankle')).toBe('Accident or injury')
  })
})

describe('symptomAnswers', () => {
  it('spells out the Other symptom with the text the patient wrote', () => {
    expect(symptomAnswers(['Fall', 'Other'], 'Twisted ankle on stairs')).toEqual([
      'Fall',
      'Other: Twisted ankle on stairs',
    ])
  })

  it('says only Other when the Other text is missing', () => {
    expect(symptomAnswers(['Other'], null)).toEqual(['Other'])
  })

  it('skips leftover Other text when no symptom is Other', () => {
    expect(symptomAnswers(['Cough'], 'Twisted ankle')).toEqual(['Cough'])
  })

  it('reads a stored value that is not a list of strings as no symptoms', () => {
    expect(symptomAnswers(null, 'Twisted ankle')).toEqual([])
    expect(symptomAnswers({ symptom: 'Cough' }, null)).toEqual([])
    expect(symptomAnswers(['Cough', 3], null)).toEqual(['Cough'])
  })
})
