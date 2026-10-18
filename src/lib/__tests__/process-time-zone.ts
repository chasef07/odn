import { afterEach, beforeEach } from 'vitest'

export const PROCESS_TIME_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Asia/Tokyo',
  'Pacific/Kiritimati',
] as const

export function useProcessTimeZone(zone: string) {
  let original: string | undefined
  beforeEach(() => {
    original = process.env.TZ
    process.env.TZ = zone
  })
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })
}
