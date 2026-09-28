export const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, '')

  if (phoneNumber.length <= 3) {
    return phoneNumber
  }

  if (phoneNumber.length <= 6) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
  }

  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

export function toE164UsPhone(value: string | null | undefined): string | null {
  if (!value) return null

  const digits = value.replace(/\D/g, '')
  const nationalDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits

  if (nationalDigits.length !== 10) return null

  return `+1${nationalDigits}`
}
