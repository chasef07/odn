'use server'

import { revalidatePath } from 'next/cache'
import { pauseOfflineNotice, resumeOfflineNotice } from '@/db/sms-offline-notice'
import { adminAction } from '@/lib/admin-session'
import { now } from '@/lib/dates'
import { offlineNoticePauseEnd } from '@/lib/sms-support-offline'

export const turnOffOfflineNotice = adminAction(async () => {
  await pauseOfflineNotice(offlineNoticePauseEnd(now()))
  revalidatePath('/admin/support')
})

export const turnOnOfflineNotice = adminAction(async () => {
  await resumeOfflineNotice()
  revalidatePath('/admin/support')
})
