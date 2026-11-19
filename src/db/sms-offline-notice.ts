import { db } from './pool'
import { sql } from './sql'
import { insert, select, set } from './table'
import { smsOfflineNoticePause, smsOfflineNotices } from './tables'

export async function claimOfflineNotice(phoneE164: string, night: Date): Promise<boolean> {
  const claimed = await db.affected(
    sql`${insert(smsOfflineNotices, { phoneE164, night })} ON CONFLICT (phone_e164) DO UPDATE SET ${set(smsOfflineNotices, { night })} WHERE sms_offline_notices.night < ${night}`
  )
  return claimed === 1
}

export async function findOfflineNoticePausedUntil(at: Date): Promise<Date | null> {
  const pause = await db.one(
    sql`SELECT ${select(smsOfflineNoticePause, ['pausedUntil'])} FROM sms_offline_notice_pause WHERE paused_until > ${at}`
  )
  return pause?.pausedUntil ?? null
}

export async function pauseOfflineNotice(pausedUntil: Date): Promise<void> {
  await db.affected(
    sql`${insert(smsOfflineNoticePause, { pausedUntil })} ON CONFLICT (id) DO UPDATE SET ${set(smsOfflineNoticePause, { pausedUntil })}`
  )
}

export async function resumeOfflineNotice(): Promise<void> {
  await db.affected(sql`DELETE FROM sms_offline_notice_pause`)
}
