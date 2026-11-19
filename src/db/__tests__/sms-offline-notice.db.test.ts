import { describe, expect, it } from 'vitest'
import { db } from '../pool'
import { sql } from '../sql'
import { selectAll } from '../table'
import { smsOfflineNoticePause, smsOfflineNotices } from '../tables'
import {
  claimOfflineNotice,
  findOfflineNoticePausedUntil,
  pauseOfflineNotice,
  resumeOfflineNotice,
} from '../sms-offline-notice'

const phone = '+15551234567'
const night = new Date('2026-11-19T00:00:00.000Z')

async function claims() {
  return db.rows(
    sql`SELECT ${selectAll(smsOfflineNotices)} FROM sms_offline_notices ORDER BY phone_e164, night`
  )
}

describe('claimOfflineNotice', () => {
  it('claims the first notice for a phone and records the night', async () => {
    expect(await claimOfflineNotice(phone, night)).toBe(true)

    expect(await claims()).toEqual([{ phoneE164: phone, night }])
  })

  it('refuses a second claim for the same phone on the same night', async () => {
    await claimOfflineNotice(phone, night)

    expect(await claimOfflineNotice(phone, night)).toBe(false)
    expect(await claims()).toEqual([{ phoneE164: phone, night }])
  })

  it('claims again on the next night, keeping one row per phone', async () => {
    const nextNight = new Date('2026-11-20T00:00:00.000Z')
    await claimOfflineNotice(phone, night)

    expect(await claimOfflineNotice(phone, nextNight)).toBe(true)
    expect(await claims()).toEqual([{ phoneE164: phone, night: nextNight }])
  })

  it('refuses a claim for an earlier night than the one recorded', async () => {
    const nextNight = new Date('2026-11-20T00:00:00.000Z')
    await claimOfflineNotice(phone, nextNight)

    expect(await claimOfflineNotice(phone, night)).toBe(false)
    expect(await claims()).toEqual([{ phoneE164: phone, night: nextNight }])
  })

  it('claims separately for another phone on the same night', async () => {
    await claimOfflineNotice(phone, night)

    expect(await claimOfflineNotice('+15557654321', night)).toBe(true)
    expect(await claims()).toEqual([
      { phoneE164: phone, night },
      { phoneE164: '+15557654321', night },
    ])
  })
})

describe('offline notice pause', () => {
  async function pauses() {
    return db.rows(sql`SELECT ${selectAll(smsOfflineNoticePause)} FROM sms_offline_notice_pause`)
  }

  const until = new Date('2026-11-19T12:00:00.000Z')

  it('reads no pause when none was set', async () => {
    expect(await findOfflineNoticePausedUntil(new Date('2026-11-19T10:00:00.000Z'))).toBeNull()
  })

  it('reads the pause before it ends and none from its end on', async () => {
    await pauseOfflineNotice(until)

    expect(await findOfflineNoticePausedUntil(new Date('2026-11-19T11:59:59.999Z'))).toEqual(until)
    expect(await findOfflineNoticePausedUntil(until)).toBeNull()
    expect(await findOfflineNoticePausedUntil(new Date('2026-11-20T05:00:00.000Z'))).toBeNull()
  })

  it('keeps one pause and moves its end when paused again', async () => {
    await pauseOfflineNotice(new Date('2026-11-19T12:00:00.000Z'))
    await pauseOfflineNotice(new Date('2026-11-20T12:00:00.000Z'))

    expect(await findOfflineNoticePausedUntil(until)).toEqual(new Date('2026-11-20T12:00:00.000Z'))
    expect(await pauses()).toEqual([
      { id: true, pausedUntil: new Date('2026-11-20T12:00:00.000Z') },
    ])
  })

  it('clears the pause when resumed', async () => {
    await pauseOfflineNotice(new Date('2026-11-19T12:00:00.000Z'))

    await resumeOfflineNotice()

    expect(await findOfflineNoticePausedUntil(new Date('2026-11-19T10:00:00.000Z'))).toBeNull()
    expect(await pauses()).toEqual([])
  })

  it('refuses a second pause row', async () => {
    await expect(
      db.affected(
        sql`INSERT INTO sms_offline_notice_pause (id, paused_until) VALUES (false, now())`
      )
    ).rejects.toThrow()
  })
})
