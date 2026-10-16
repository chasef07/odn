import { env } from '@/lib/env'

const VERIFICATION_HOSTNAMES = new Set(['phealthclinic.com', 'www.phealthclinic.com'])
const ONLINE_DOCTOR_HOSTNAMES = new Set(['onlinedoctornote.com', 'www.onlinedoctornote.com'])

function normalizeHostname(value: string | null | undefined): string {
  return (value || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
}

export function getVerificationBaseUrl(): string {
  return env.VERIFICATION_BASE_URL
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
