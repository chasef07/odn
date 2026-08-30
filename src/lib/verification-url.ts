const PRODUCTION_VERIFICATION_ORIGIN = 'https://phealthclinic.com'
const VERIFICATION_HOSTNAMES = new Set(['phealthclinic.com', 'www.phealthclinic.com'])
const ONLINE_DOCTOR_HOSTNAMES = new Set(['onlinedoctornote.com', 'www.onlinedoctornote.com'])

function normalizeHostname(value: string | null | undefined): string {
  return (value || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
}

function normalizeOrigin(value: string): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error('VERIFICATION_BASE_URL must be a valid absolute URL')
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('VERIFICATION_BASE_URL must be an HTTP(S) origin without a path')
  }

  return url.origin
}

export function getVerificationBaseUrl(): string {
  const configuredUrl = process.env.VERIFICATION_BASE_URL?.trim()
  if (configuredUrl) return normalizeOrigin(configuredUrl)

  if (process.env.NODE_ENV === 'production') return PRODUCTION_VERIFICATION_ORIGIN

  return normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.BETTER_AUTH_URL?.trim() ||
      'http://localhost:3000'
  )
}

export function getVerificationUrl(verificationSlug: string): string {
  return `${getVerificationBaseUrl()}/verify/${verificationSlug}`
}

export function isVerificationHostname(hostname: string | null | undefined): boolean {
  return VERIFICATION_HOSTNAMES.has(normalizeHostname(hostname))
}

export function isOnlineDoctorHostname(hostname: string | null | undefined): boolean {
  return ONLINE_DOCTOR_HOSTNAMES.has(normalizeHostname(hostname))
}

export function isVerificationPath(pathname: string): boolean {
  return /^\/(?:es\/)?verify(?:\/|$)/.test(pathname)
}
