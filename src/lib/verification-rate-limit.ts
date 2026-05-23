type Bucket = {
  count: number
  resetAt: number
}

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 12

const buckets = new Map<string, Bucket>()

export function checkVerificationLookupLimit(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return false
  }

  bucket.count += 1
  return true
}

export function getRateLimitKey(ipAddress: string | null): string | null {
  const normalizedIp = ipAddress?.trim()
  return normalizedIp || null
}
