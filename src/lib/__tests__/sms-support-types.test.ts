import { describe, expect, it } from 'vitest'
import { supportPhoneThreads } from '../sms-support-types'

const ada = { patientFirstName: 'Ada', patientLastName: 'Lovelace' }
const grace = { patientFirstName: 'Grace', patientLastName: 'Hopper' }

function ticket(
  id: string,
  phoneE164: string,
  names: Partial<Record<'submission' | 'phonePatient', typeof ada>> = {}
) {
  return {
    id,
    phoneE164,
    submission: names.submission ?? null,
    phonePatient: names.phonePatient ?? null,
  }
}

describe('supportPhoneThreads', () => {
  it('keeps the first ticket of each phone in queue order', () => {
    const threads = supportPhoneThreads([
      ticket('a-open', '+15550000001'),
      ticket('b-open', '+15550000002'),
      ticket('a-closed', '+15550000001'),
      ticket('c-closed', '+15550000003'),
      ticket('b-closed', '+15550000002'),
    ])

    expect(threads.map((thread) => thread.ticket.id)).toEqual(['a-open', 'b-open', 'c-closed'])
  })

  it('names a thread from any linked submission before the phone match', () => {
    const [thread] = supportPhoneThreads([
      ticket('new', '+15550000001', { phonePatient: grace }),
      ticket('old', '+15550000001', { submission: ada }),
    ])

    expect(thread.ticket.id).toBe('new')
    expect(thread.patientName).toBe('Ada Lovelace')
  })

  it('falls back to the phone match, then to no name', () => {
    const threads = supportPhoneThreads([
      ticket('matched', '+15550000001', { phonePatient: grace }),
      ticket('unknown', '+15550000002'),
    ])

    expect(threads.map((thread) => thread.patientName)).toEqual([
      'Grace Hopper (matched by phone)',
      null,
    ])
  })
})
