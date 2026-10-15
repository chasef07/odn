const US_COUNTRY_CODE = '1'

export function toNationalDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith(US_COUNTRY_CODE) ? digits.slice(1) : digits
}

export const formatPhoneNumber = (value: string): string => {
  const phoneNumber = toNationalDigits(value)

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

  const nationalDigits = toNationalDigits(value)

  if (nationalDigits.length !== 10) return null

  return `+${US_COUNTRY_CODE}${nationalDigits}`
}
