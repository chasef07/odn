import { describe, expect, it } from 'vitest'
import { db } from '../pool'
import { sql } from '../sql'
import { selectAll } from '../table'
import { patientFlags } from '../tables'
import { findPatientFlag, flagPatient, unflagPatient } from '../patient-flags'

const jane = {
  patientFirstName: 'Jane',
  patientLastName: 'Roe',
  patientDateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
}

const flaggedAt = new Date('2026-11-14T15:30:00.000Z')

async function flagJane() {
  return flagPatient(jane, { reason: 'Repeated requests', flaggedBy: 'doc@example.com', flaggedAt })
}

describe('flagPatient', () => {
  it('stores the flag with its reason, who flagged it and when, and returns it', async () => {
    const flag = await flagJane()

    expect(flag).toEqual({
      id: expect.any(String),
      ...jane,
      reason: 'Repeated requests',
      flaggedBy: 'doc@example.com',
      flaggedAt,
    })
    expect(await db.rows(sql`SELECT ${selectAll(patientFlags)} FROM patient_flags`)).toEqual([flag])
  })

  it('keeps one flag per patient and only replaces its reason when flagged again', async () => {
    const first = await flagJane()

    const second = await flagPatient(
      { ...jane, patientFirstName: 'JANE', patientLastName: 'roe' },
      {
        reason: 'Shared a fake employer letter',
        flaggedBy: 'other@example.com',
        flaggedAt: new Date('2026-11-15T09:00:00.000Z'),
      }
    )

    expect(second).toEqual({ ...first, reason: 'Shared a fake employer letter' })
    expect(await db.rows(sql`SELECT ${selectAll(patientFlags)} FROM patient_flags`)).toEqual([
      second,
    ])
  })
})

describe('findPatientFlag', () => {
  it('finds the flag for the same patient whatever the name case', async () => {
    const flag = await flagJane()

    expect(
      await findPatientFlag({ ...jane, patientFirstName: 'jane', patientLastName: 'ROE' })
    ).toEqual(flag)
  })

  it.each([
    ['first name', { patientFirstName: 'Janet' }],
    ['last name', { patientLastName: 'Doe' }],
    ['date of birth', { patientDateOfBirth: new Date('1990-05-16T00:00:00.000Z') }],
  ])('finds no flag for a patient with a different %s', async (_field, change) => {
    await flagJane()

    expect(await findPatientFlag({ ...jane, ...change })).toBeNull()
  })
})

describe('unflagPatient', () => {
  it('removes only that patient’s flag', async () => {
    await flagJane()
    const other = { ...jane, patientFirstName: 'Janet' }
    const otherFlag = await flagPatient(other, {
      reason: null,
      flaggedBy: 'doc@example.com',
      flaggedAt,
    })

    expect(await unflagPatient({ ...jane, patientFirstName: 'JANE' })).toBe(1)

    expect(await findPatientFlag(jane)).toBeNull()
    expect(await findPatientFlag(other)).toEqual(otherFlag)
  })

  it('removes nothing when the patient is not flagged', async () => {
    expect(await unflagPatient(jane)).toBe(0)
  })
})
